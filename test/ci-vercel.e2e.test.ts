import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { WINDOWS } from "../src/platform.ts";
import { VERSIONS } from "../src/versions.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled binary talks to a local stand-in for the GitHub API, then the Vercel build
// recipe runs that same binary. Ready passes. Error, Canceled, pending-that-never-finishes,
// and a missing required status fail. A repository with no Actions workflow does not wait
// for Actions. One with both fails unless both pass.

setDefaultTimeout(300_000);

const area = mkdtempSync(join(tmpdir(), "pregate-ci-vercel-"));
const binary = join(area, "pregate");
const EN = "Vercel \u2013 app";

beforeAll(() => compileBinary(hostTarget(), binary, true));
afterAll(() => removeTree(area));

test("the compiled binary recognizes Vercel statuses and check runs, with and without Actions", async () => {
  let pendingHits = 0;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      const url = new URL(request.url);
      const match = /^\/repos\/acme\/web\/commits\/([0-9a-f]+)\/(statuses|check-runs)/.exec(url.pathname);
      if (!match) return new Response("missing", { status: 404 });
      const sha = match[1]!;
      const kind = match[2]!;
      if (sha === "bbbbbbb" && request.headers.get("authorization") !== "Bearer fixture-token") {
        return new Response("unauthorized", { status: 401 });
      }
      if (sha === "9999999") return new Response("nope", { status: 500 });
      if (sha === "aaaaaaa") return new Response("not-json", { status: 200 });
      if (kind === "check-runs") return Response.json(checksFor(sha));
      if (sha === "4444444") return Response.json([status("Vercel", "pending", "Building")]);
      if (sha === "ccccccc") {
        pendingHits += 1;
        const ready = pendingHits >= 2;
        return Response.json([status("Vercel", ready ? "success" : "pending", ready ? "Ready" : "Building")]);
      }
      return Response.json(statusesFor(sha));
    },
  });
  try {
    const api = `http://127.0.0.1:${server.port}`;
    const vercelOnly = fixtureRepo("vercel-only");
    const both = fixtureRepo("both");
    const env = (token = ""): Record<string, string> => ({
      PREGATE_GITHUB_API: api,
      PREGATE_GITHUB_REPOSITORY: "acme/web",
      GH_TOKEN: token,
      GITHUB_TOKEN: token,
    });

    const ready = await run(binary, vercelOnly, ["ci", "status", "--sha", "1111111", "--json"], env());
    expect(ready.code, ready.text).toBe(0);
    const readyReport = JSON.parse(ready.text) as { verdict: string; providers: { id: string; required: boolean; verdict: string }[] };
    expect(readyReport.verdict).toBe("pass");
    expect(readyReport.providers.find((provider) => provider.id === "vercel")).toMatchObject({ required: true, verdict: "pass" });
    expect(readyReport.providers.find((provider) => provider.id === "github-actions")).toMatchObject({ required: false });

    const errored = await run(binary, vercelOnly, ["ci", "status", "--sha", "2222222"], env());
    expect(errored.code).toBe(1);
    expect(errored.text).toContain("fail");
    expect(errored.text).toContain("Error");

    const canceled = await run(binary, vercelOnly, ["ci", "status", "--sha", "3333333", "--json"], env());
    expect(canceled.code).toBe(1);
    expect(JSON.parse(canceled.text).verdict).toBe("fail");

    const missing = await run(binary, vercelOnly, ["ci", "status", "--sha", "5555555"], env());
    expect(missing.code).toBe(1);
    expect(missing.text).toContain("missing");

    const stillPending = await run(binary, vercelOnly, ["ci", "status", "--sha", "4444444"], env());
    expect(stillPending.code).toBe(1);
    expect(stillPending.text).toContain("pending");
    const waited = await run(binary, vercelOnly, ["ci", "wait", "--sha", "ccccccc", "--timeout", "5", "--interval", "0"], env());
    expect(waited.code, waited.text).toBe(0);
    expect(waited.text).toContain("CI passed");

    const bothPass = await run(binary, both, ["ci", "status", "--sha", "6666666", "--json"], env());
    expect(bothPass.code, bothPass.text).toBe(0);
    const bothReport = JSON.parse(bothPass.text) as { verdict: string; providers: { id: string; verdict: string }[] };
    expect(bothReport.verdict).toBe("pass");
    expect(bothReport.providers.map((provider) => `${provider.id}:${provider.verdict}`).sort()).toEqual([
      "github-actions:pass", "vercel:pass",
    ]);

    const vercelFails = await run(binary, both, ["ci", "status", "--sha", "7777777"], env());
    expect(vercelFails.code).toBe(1);
    expect(vercelFails.text).toContain("vercel: fail");

    const actionsMissing = await run(binary, both, ["ci", "status", "--sha", "8888888"], env());
    expect(actionsMissing.code).toBe(1);
    expect(actionsMissing.text).toContain("github-actions: missing");

    const unavailable = await run(binary, vercelOnly, ["ci", "status", "--sha", "9999999"], env());
    expect(unavailable.code).toBe(1);
    expect(unavailable.text).toContain("500");
    const malformed = await run(binary, vercelOnly, ["ci", "status", "--sha", "aaaaaaa"], env());
    expect(malformed.code).toBe(1);
    expect(malformed.text).toContain("malformed");

    const authed = await run(binary, vercelOnly, ["ci", "status", "--sha", "bbbbbbb"], env("fixture-token"));
    expect(authed.code, authed.text).toBe(0);

    const detected = await run(binary, both, ["ci", "detect"], env());
    expect(detected.code).toBe(0);
    expect(detected.text).toContain("github-actions");
    expect(detected.text).toContain("vercel");
    const only = await run(binary, vercelOnly, ["ci", "detect"], env());
    expect(only.text).toContain("vercel");
    expect(only.text).not.toContain("github-actions");

    const unknown = await run(binary, vercelOnly, ["ci", "status", "--sha", "1111111"], {
      ...env(), PREGATE_GITHUB_REPOSITORY: "not a repo",
    });
    expect(unknown.code).toBe(1);
    expect(unknown.text).toContain("GitHub repository");
  } finally {
    server.stop(true);
  }
});

if (!WINDOWS) test("the Vercel build recipe fails the build on deny and passes when the tree is clean", async () => {
  const repo = join(area, "build");
  const bin = join(area, "fake-bin");
  const stage = join(area, "curl-stage");
  const curlLog = join(area, "curl.log");
  const cosignLog = join(area, "cosign.log");
  mkdirSync(join(repo, "src"), { recursive: true });
  mkdirSync(join(repo, ".pregate"), { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(repo, "src/ok.ts"), "export function total(items: number[]): number {\n  return items.reduce((sum, item) => sum + item, 0);\n}\n");
  writeFileSync(join(repo, "package.json"), `${JSON.stringify({
    scripts: { build: "node -e \"require('fs').writeFileSync('built.txt','ok')\"" },
  }, null, 2)}\n`);
  writeFileSync(join(repo, ".pregate/preset.json"), policyFixture(JSON.stringify({
    name: "vercel-build", version: "1.0.0", engine: VERSIONS.engine,
    sources: [
      { ns: "core", kind: "builtin", version: VERSIONS.core },
      { ns: "typescript", kind: "library", version: "1.3.0" },
    ],
    methodologies: ["core/pregate-integrity", "typescript/discipline"],
    scope: { include: ["src/**"] }, enforcement: "enforce", ratchet: { mode: "no-new" },
  })));
  const gitConfig = join(area, "gitconfig");
  writeFileSync(gitConfig, "");
  const gitEnv = {
    GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_COUNT: "0",
    GIT_AUTHOR_NAME: "Pregate CI", GIT_AUTHOR_EMAIL: "pregate-ci@example.com",
    GIT_COMMITTER_NAME: "Pregate CI", GIT_COMMITTER_EMAIL: "pregate-ci@example.com",
  };
  const git = (...args: string[]) => {
    const child = Bun.spawnSync(["git", "-c", "commit.gpgsign=false", ...args], { cwd: repo, env: { ...process.env, ...gitEnv }, stderr: "pipe" });
    if (child.exitCode !== 0) throw new Error(child.stderr.toString());
  };
  git("init", "-q");
  git("add", ".");
  const compiled = await run(binary, repo, ["preset", "compile"], gitEnv);
  expect(compiled.code, compiled.text).toBe(0);
  const installed = await run(binary, repo, ["install", "--ci", "vercel"], gitEnv);
  expect(installed.code, installed.text).toBe(0);
  expect(installed.text).toContain("pregate-vercel-build.sh");
  const command = JSON.parse(readFileSync(join(repo, "vercel.json"), "utf8")) as { buildCommand: string };
  expect(command.buildCommand).toBe("bash scripts/pregate-vercel-build.sh -- npm run build");
  git("add", ".");
  git("commit", "-qm", "clean");
  git("update-ref", "refs/remotes/origin/main", "HEAD");

  writeFileSync(join(bin, "curl"), `#!/bin/bash
set -eu
out=""
url=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-o" ]; then out=$arg; fi
  case "$arg" in
    http://*|https://*) url=$arg ;;
  esac
  prev=$arg
done
printf '%s\\n' "$url" >> "$CURL_LOG"
mkdir -p "$CURL_STAGE"
ver=$(printf '%s' "$url" | sed -n 's|.*/download/v\\([^/]*\\)/.*|\\1|p')
name="pregate-\${ver}-linux-x64.tar.gz"
if [ ! -f "$CURL_STAGE/archive.tar.gz" ]; then
  src=$(mktemp -d)
  cp "$PREGATE_FIXTURE_BIN" "$src/pregate"
  chmod 755 "$src/pregate"
  tar -czf "$CURL_STAGE/archive.tar.gz" -C "$src" pregate
  rm -rf "$src"
  sum=$(sha256sum "$CURL_STAGE/archive.tar.gz" | awk '{print $1}')
  printf '%s  %s\\n' "$sum" "$name" > "$CURL_STAGE/SHA256SUMS"
fi
case "$url" in
  */SHA256SUMS) cp "$CURL_STAGE/SHA256SUMS" "$out" ;;
  *.tar.gz) cp "$CURL_STAGE/archive.tar.gz" "$out" ;;
  *) printf 'bundle\\n' > "$out" ;;
esac
`);
  writeFileSync(join(bin, "cosign"), `#!/bin/sh
printf '%s\\n' "$*" >> "$COSIGN_LOG"
exit "\${COSIGN_EXIT:-0}"
`);
  chmodSync(join(bin, "curl"), 0o755);
  chmodSync(join(bin, "cosign"), 0o755);
  const buildEnv = (cosignExit: string): Record<string, string> => ({
    ...gitEnv,
    PATH: `${bin}:${process.env.PATH}`,
    CURL_LOG: curlLog,
    CURL_STAGE: stage,
    COSIGN_LOG: cosignLog,
    COSIGN_EXIT: cosignExit,
    PREGATE_FIXTURE_BIN: binary,
    VERCEL: "1",
    VERCEL_ENV: "preview",
  });
  const build = (cosignExit: string) => {
    writeFileSync(curlLog, "");
    writeFileSync(cosignLog, "");
    return Bun.spawnSync(["bash", "scripts/pregate-vercel-build.sh", "--", "npm", "run", "build"], {
      cwd: repo, env: { ...process.env, ...buildEnv(cosignExit) }, stdout: "pipe", stderr: "pipe",
    });
  };

  const rejected = build("1");
  expect(rejected.exitCode, rejected.stderr.toString()).not.toBe(0);
  expect(existsSync(join(repo, "built.txt"))).toBe(false);
  expect(readFileSync(cosignLog, "utf8")).toContain("verify-blob");

  const passed = build("0");
  expect(passed.exitCode, `${passed.stdout}\n${passed.stderr}`).toBe(0);
  expect(readFileSync(join(repo, "built.txt"), "utf8")).toBe("ok");
  const firstUrls = readFileSync(curlLog, "utf8").split("\n").filter(Boolean);
  expect(firstUrls.some((url) => url.endsWith(".tar.gz"))).toBe(true);
  rmSync(join(repo, "built.txt"));

  const cached = build("0");
  expect(cached.exitCode, `${cached.stdout}\n${cached.stderr}`).toBe(0);
  const secondUrls = readFileSync(curlLog, "utf8").split("\n").filter(Boolean);
  expect(secondUrls.some((url) => url.endsWith("/SHA256SUMS"))).toBe(true);
  expect(secondUrls.some((url) => url.endsWith(".tar.gz"))).toBe(false);
  rmSync(join(repo, "built.txt"));

  writeFileSync(join(repo, "src/bad.ts"), "export function total(items: number[]) {\n  return items.reduce((sum, item) => sum + item, 0);\n}\n");
  git("add", "src/bad.ts");
  git("commit", "-qm", "deny");
  const denied = build("0");
  expect(denied.exitCode, `${denied.stdout}\n${denied.stderr}`).not.toBe(0);
  expect(denied.stderr.toString() + denied.stdout.toString()).toContain("check --ratchet");
  expect(existsSync(join(repo, "built.txt"))).toBe(false);
});

function fixtureRepo(name: "vercel-only" | "both"): string {
  const dir = join(area, name);
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "scripts/pregate-vercel-build.sh"), "#!/bin/bash\n");
  if (name === "both") {
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(join(dir, ".github/workflows/pregate.yml"), readFileSync(join(import.meta.dir, "../assets/ci-github.yml"), "utf8"));
  }
  return dir;
}

function status(context: string, state: string, description: string): unknown {
  return { context, state, description, target_url: "https://example.vercel.app" };
}

function statusesFor(sha: string): unknown[] {
  if (sha === "1111111" || sha === "bbbbbbb" || sha === "8888888") return [status("Vercel", "success", "Ready")];
  if (sha === "2222222") return [status(EN, "failure", "Error")];
  if (sha === "3333333") return [status("Vercel", "error", "Canceled")];
  if (sha === "6666666") return [status(EN, "success", "Ready")];
  if (sha === "7777777") return [status("Vercel", "failure", "Error")];
  return [];
}

function checksFor(sha: string): unknown {
  if (sha === "6666666" || sha === "7777777") {
    return {
      total_count: 1,
      check_runs: [{
        name: "pregate", status: "completed", conclusion: "success", html_url: "https://github.com/acme/web/runs/1",
        output: { title: "pass", summary: "" }, app: { slug: "github-actions" },
      }],
    };
  }
  return { total_count: 0, check_runs: [] };
}

async function run(bin: string, cwd: string, args: string[], extra: Record<string, string>): Promise<{ code: number; text: string }> {
  // Async spawn keeps the test server's event loop free while this process calls it.
  const child = Bun.spawn([bin, ...args], {
    cwd, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, ...extra },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  return { code: code ?? 1, text: `${stdout}${stderr}` };
}
