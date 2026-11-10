import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WINDOWS } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

// assets/ci-github.yml is what `pregate install --ci github` writes. The install step must
// take the engine version from the base commit, not the pull request's lock, and must
// verify the cosign bundles before it unpacks.

const CHECKOUT = "actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0";

function installScript(yaml: string, root: string): string {
  const lines = yaml.replaceAll("@ROOT@", root).split("\n");
  const nameAt = lines.findIndex((line) => line.includes("name: Install the engine the base branch pins"));
  if (nameAt < 0) throw new Error("install step missing");
  const runAt = lines.findIndex((line, index) => index > nameAt && /^\s*run:\s*\|/.test(line));
  const indent = (lines[runAt + 1] ?? "").match(/^( *)/)?.[1]?.length ?? 0;
  const body: string[] = [];
  for (let i = runAt + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") { body.push(""); continue; }
    if (indent === 0 || !line.startsWith(" ".repeat(indent))) break;
    body.push(line.slice(indent));
  }
  return `${body.join("\n")}\n`;
}

if (!WINDOWS) test("the CI template installs the base branch engine and verifies cosign", async () => {
  const yaml = readFileSync(join(import.meta.dir, "../assets/ci-github.yml"), "utf8");
  expect(yaml).toContain(CHECKOUT);
  expect(yaml).not.toContain("releases repository is private");
  expect(yaml).toContain('git show "$BASE:$lock"');
  expect(yaml).not.toContain("jq -r .engine .pregate/pregate.lock.json");

  const area = mkdtempSync(join(tmpdir(), "pregate-ci-template-"));
  try {
    const repo = join(area, "repo");
    const app = join(repo, "app");
    mkdirSync(join(app, ".pregate"), { recursive: true });
    mkdirSync(join(repo, ".pregate"), { recursive: true });
    writeFileSync(join(repo, ".pregate/pregate.lock.json"), '{"engine":"1.2.3"}\n');
    writeFileSync(join(app, ".pregate/pregate.lock.json"), '{"engine":"0.0.2"}\n');
    const git = (...args: string[]) => {
      const child = Bun.spawnSync(["git", "-c", "user.name=Pregate CI", "-c", "user.email=pregate-ci@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: repo, stderr: "pipe" });
      if (child.exitCode !== 0) throw new Error(child.stderr.toString());
    };
    git("init", "-q");
    git("add", ".");
    git("commit", "-qm", "base");
    const base = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repo, stdout: "pipe" }).stdout.toString().trim();
    writeFileSync(join(app, ".pregate/pregate.lock.json"), '{"engine":"9.9.9"}\n');
    writeFileSync(join(repo, ".pregate/pregate.lock.json"), '{"engine":"8.8.8"}\n');
    git("add", ".");
    git("commit", "-qm", "head");

    const good = await runTemplate({ area, cwd: app, base, script: installScript(yaml, "app"), cosignExit: "0" });
    expect(good.code, good.text).toBe(0);
    expect(good.gh).toContain("v0.0.2");
    expect(good.gh).not.toContain("v9.9.9");
    expect(good.gh).not.toContain("v8.8.8");
    expect(good.gh).not.toContain("v1.2.3");
    expect(good.cosign).toContain("SHA256SUMS.bundle");
    expect(good.cosign).toContain("pregate-0.0.2-linux-x64.tar.gz.bundle");
    expect(good.cosign.match(/verify-blob/g)).toHaveLength(2);
    expect(readFileSync(good.envFile, "utf8")).toContain("PREGATE=");
    expect(readFileSync(join(good.runner, "pregate"), "utf8")).toContain("ok");

    const bad = await runTemplate({ area, cwd: app, base, script: installScript(yaml, "app"), cosignExit: "1" });
    expect(bad.code).not.toBe(0);
    expect(bad.text).toContain("cosign");
    const extracted = join(bad.runner, "pregate");
    expect(await Bun.file(extracted).exists()).toBe(false);
  } finally {
    removeTree(area);
  }
});

async function runTemplate(input: { area: string; cwd: string; base: string; script: string; cosignExit: string }): Promise<{ code: number; text: string; gh: string; cosign: string; envFile: string; runner: string }> {
  const { area, cwd, base, script, cosignExit } = input;
  const id = `run-${cosignExit}-${Math.random().toString(36).slice(2)}`;
  const bin = join(area, id, "bin");
  const runner = join(area, id, "runner");
  const envFile = join(area, id, "github-env");
  const ghLog = join(area, id, "gh.log");
  const cosignLog = join(area, id, "cosign.log");
  mkdirSync(bin, { recursive: true });
  mkdirSync(runner);
  writeFileSync(envFile, "");
  writeFileSync(join(bin, "gh"), `#!/bin/sh
printf '%s\\n' "$*" >> ${JSON.stringify(ghLog)}
tag=
for arg in "$@"; do
  case "$arg" in
    v*) tag=$arg ;;
  esac
done
ver=\${tag#v}
name="pregate-\${ver}-linux-x64.tar.gz"
src=$(mktemp -d)
printf 'ok\\n' > "$src/pregate"
chmod 755 "$src/pregate"
tar -czf "$name" -C "$src" pregate
rm -rf "$src"
printf 'bundle\\n' > "$name.bundle"
printf 'bundle\\n' > SHA256SUMS.bundle
sum=$(sha256sum "$name" | awk '{print $1}')
printf '%s  %s\\n' "$sum" "$name" > SHA256SUMS
`);
  writeFileSync(join(bin, "cosign"), `#!/bin/sh
printf '%s\\n' "$*" >> ${JSON.stringify(cosignLog)}
echo "cosign verify-blob failed" >&2
exit ${cosignExit}
`);
  chmodSync(join(bin, "gh"), 0o755);
  chmodSync(join(bin, "cosign"), 0o755);
  const file = join(area, id, "install.sh");
  writeFileSync(file, script);
  const proc = Bun.spawn(["bash", file], {
    cwd,
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: join(area, id, "home"),
      BASE: base,
      RUNNER_TEMP: runner,
      GITHUB_ENV: envFile,
      GH_TOKEN: "test-token",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return {
    code,
    text: stdout + stderr,
    gh: await Bun.file(ghLog).text().catch(() => ""),
    cosign: await Bun.file(cosignLog).text().catch(() => ""),
    envFile,
    runner,
  };
}
