import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { VERSIONS } from "../src/versions.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { dataHome } from "../src/consent.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { removeTree } from "./remove-tree.ts";

setDefaultTimeout(120_000);
const root = join(import.meta.dir, "..");
const area = mkdtempSync(join(tmpdir(), "pregate-guided-update-"));
const binary = join(area, ENGINE_FILE);
const driver = join(area, "guided-driver" + (WINDOWS ? ".exe" : ""));
const old028 = join(dataHome(), "0.2.8", ENGINE_FILE);

beforeAll(() => {
  compileBinary(hostTarget(), binary);
  const entry = join(area, "driver.ts");
  writeFileSync(entry, `import { updateAndContinue } from ${JSON.stringify(join(root, "src/guided-update.ts"))};
import { VERSIONS } from ${JSON.stringify(join(root, "src/versions.ts"))};
if (process.argv[2] === "legacy") VERSIONS.engine = "0.2.7";
updateAndContinue().then(result => { console.log(result.text); process.exit(result.code); });\n`);
  const compiled = Bun.spawnSync([process.execPath, "build", entry, "--compile", "--minify", ...(WINDOWS ? [] : ["--bytecode"]),
    "--no-compile-autoload-bunfig", "--no-compile-autoload-dotenv", "--define=PREGATE_TEST_BUILD=false", `--target=bun-${hostTarget()}`, `--outfile=${driver}`],
  { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  if (compiled.exitCode !== 0) throw new Error(compiled.stderr.toString());
}, 150_000);
afterAll(() => removeTree(area));

let serial = 0;
function fixture(engine = binary) {
  const directory = join(area, String(++serial)), project = join(directory, "project"), tools = join(directory, "bin");
  mkdirSync(project, { recursive: true }); mkdirSync(tools);
  const path = WINDOWS ? pathWithoutHarnesses([tools]) : `${tools}:/usr/bin:/bin`;
  mkdirSync(join(directory, "home", ".claude"), { recursive: true });
  const env = { ...process.env, HOME: join(directory, "home"), CODEX_HOME: join(directory, "codex"), GROK_HOME: join(directory, "grok"),
    CLAUDE_CONFIG_DIR: join(directory, "claude"), XDG_DATA_HOME: join(directory, "data"), XDG_STATE_HOME: join(directory, "state"),
    PATH: path, ...(WINDOWS ? { Path: path } : {}), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", LOG: join(directory, "gh.log") };
  const run = (command: string[], cwd = project) => {
    const out = Bun.spawnSync(command, { cwd, env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 60_000 });
    return { code: out.exitCode, text: out.stdout.toString() + out.stderr.toString() };
  };
  expect(run([engine, "setup"]).code).toBe(0);
  expect(run([engine, "init", "--preset", "integrity-only", "--yes"]).code).toBe(0);
  const data = join(env.XDG_DATA_HOME, "pregate");
  const snapshot = () => [...["preset.json", "pregate.lock.json"].map(name => readFileSync(join(project, ".pregate", name), "utf8")),
    ...readdirSync(join(data, "consent")).sort().map(name => readFileSync(join(data, "consent", name), "utf8"))];
  const gh = (text: string) => {
    const path = join(tools, "gh"); writeFileSync(path, "#!/bin/sh\n" + text); chmodSync(path, 0o755);
  };
  const curl = (text: string) => {
    const path = join(tools, "curl"); writeFileSync(path, "#!/bin/sh\n" + text); chmodSync(path, 0o755);
  };
  curl("exit 22\n"); // No real network requests in the authenticated fixture cases.
  const helper = (mode?: string, cwd = project) => run([driver, ...(mode ? [mode] : [])], cwd);
  return { directory, project, data, tools, env, run, gh, curl, helper, snapshot };
}

function serve(f: ReturnType<typeof fixture>, version: string, release?: string, failure = "") {
  const download = failure || `prev=; for a; do [ "$prev" = --dir ] && out=$a; prev=$a; done\nprev=; for a; do [ "$prev" = --pattern ] && cp '${release}'/"$a" "$out/"; prev=$a; done`;
  f.gh([`echo "gh $*" >> "$LOG"`, `case "$1 $2" in`, `"release view") echo 'v${version}' ;;`, `"release download") ${download} ;;`, "*) exit 1 ;;", "esac", ""].join("\n"));
}

function release(f: ReturnType<typeof fixture>, version: string, body: string, badChecksum = false) {
  const directory = join(f.directory, "release"), payload = join(directory, "payload"); mkdirSync(payload, { recursive: true });
  const executable = join(payload, ENGINE_FILE); writeFileSync(executable, "#!/bin/sh\n" + body); chmodSync(executable, 0o755);
  const archive = `pregate-${version}-${hostTarget()}.tar.gz`;
  expect(f.run(["tar", "-czf", join(directory, archive), "-C", payload, ENGINE_FILE]).code).toBe(0);
  const hash = badChecksum ? "0".repeat(64) : createHash("sha256").update(readFileSync(join(directory, archive))).digest("hex");
  writeFileSync(join(directory, "SHA256SUMS"), `${hash}  ${archive}\n`);
  return directory;
}

test.skipIf(WINDOWS)("global guided update retains an installed guide and runs the exact production engine with no approval shortcut", () => {
  const f = fixture(), before = f.snapshot(); serve(f, VERSIONS.engine);
  const out = f.helper();
  expect(out.code, out.text).toBe(0);
  expect(out.text).toContain("Global update and guided project session finished.");
  expect(out.text).toContain("Static checks:");
  expect(readFileSync(join(f.data, "bin/pregate"), "utf8")).toContain(`version=${VERSIONS.engine}`);
  expect(f.snapshot()).toEqual(before);
  expect(readFileSync(f.env.LOG, "utf8")).not.toContain("release download");
});

test.skipIf(WINDOWS)("an older latest release cannot downgrade the current coordinator or rewrite its contract", () => {
  const f = fixture(), before = f.snapshot(), launcher = readFileSync(join(f.data, "bin/pregate"), "utf8"); serve(f, "0.0.0");
  const out = f.helper();
  expect(out.code, out.text).toBe(0); expect(out.text).toContain("no downgrade or download was started");
  expect(f.snapshot()).toEqual(before); expect(readFileSync(join(f.data, "bin/pregate"), "utf8")).toBe(launcher);
  expect(readFileSync(f.env.LOG, "utf8")).not.toContain("release download");
});

test.skipIf(WINDOWS)("anonymous latest lookup continues the installed guide without gh or changing project consent", () => {
  const f = fixture(), before = f.snapshot();
  f.curl(`out=; prev=; for arg; do [ "$prev" = --output ] && out=$arg; prev=$arg; done\necho '{"tag_name":"v${VERSIONS.engine}","draft":false,"prerelease":false}' >"$out"\n`);
  const out = f.helper();
  expect(out.code, out.text).toBe(0); expect(out.text).toContain("Global update and guided project session finished.");
  expect(f.snapshot()).toEqual(before); expect(existsSync(f.env.LOG)).toBe(false);
});

test.skipIf(WINDOWS)("query authentication/offline errors name recovery and preserve contracts and the launcher", () => {
  const f = fixture(), before = f.snapshot(), launcher = readFileSync(join(f.data, "bin/pregate"), "utf8");
  for (const reason of ["HTTP 401: authentication required", "offline: network unreachable"]) {
    f.gh(`echo '${reason}' >&2; exit 1\n`);
    const out = f.helper(); expect(out.code).toBe(1); expect(out.text).toContain(reason); expect(out.text).toContain("gh auth status");
    expect(f.snapshot()).toEqual(before); expect(readFileSync(join(f.data, "bin/pregate"), "utf8")).toBe(launcher);
  }
});

test.skipIf(WINDOWS)("download failure and wrong checksum leave the current engine, contract and consent usable", () => {
  const f = fixture(), before = f.snapshot(), launcher = readFileSync(join(f.data, "bin/pregate"), "utf8"), next = "9.9.9";
  serve(f, next, undefined, "echo 'download offline' >&2; exit 1");
  const unavailable = f.helper(); expect(unavailable.code).toBe(1); expect(unavailable.text).toContain("download offline");
  const archive = release(f, next, `echo 'pregate ${next}'\n`, true); serve(f, next, archive);
  const invalid = f.helper(); expect(invalid.code).toBe(1); expect(invalid.text).toContain("differs from SHA256SUMS");
  expect(existsSync(join(f.data, next, ENGINE_FILE))).toBe(false);
  expect(f.snapshot()).toEqual(before); expect(readFileSync(join(f.data, "bin/pregate"), "utf8")).toBe(launcher);
});

test.skipIf(WINDOWS)("a missing engine after installation gives a concrete recovery command without touching project policy", () => {
  const f = fixture(), before = f.snapshot(), next = "9.9.9";
  const archive = release(f, next, `case "$1" in --version) echo 'pregate ${next}' ;; setup) rm "$0" ;; esac\n`); serve(f, next, archive);
  const out = f.helper(undefined, f.directory);
  expect(out.code).toBe(1); expect(out.text).toContain(`Engine ${next} is missing`); expect(out.text).toContain(`pregate update --engine ${next}`);
  expect(f.snapshot()).toEqual(before);
});

test.skipIf(WINDOWS)("a failed help probe is reported as engine failure rather than a legacy guided-capability fallback", () => {
  const f = fixture(), before = f.snapshot(), next = "9.9.9";
  const archive = release(f, next, `case "$1" in --version) echo 'pregate ${next}' ;; guide) echo 'usage: pregate'; exit 2 ;; esac\n`); serve(f, next, archive);
  const out = f.helper();
  expect(out.code).toBe(1); expect(out.text).toContain("could not answer guide --help (exit 2)");
  expect(out.text).not.toContain("predates guided choices"); expect(f.snapshot()).toEqual(before);
});

test.skipIf(WINDOWS || !existsSync(old028))("the immutable published 0.2.8 engine falls back to its own migration preview and exact digest approval", () => {
  const f = fixture(old028);
  const preset = join(f.project, ".pregate/preset.json"), old = JSON.parse(readFileSync(preset, "utf8")); old.engine = "0.2.7";
  writeFileSync(preset, JSON.stringify(old));
  const before = f.snapshot(); serve(f, "0.2.8");
  const out = f.helper("legacy");
  expect(out.code, out.text).toBe(0); expect(out.text).toContain("predates guided choices"); expect(out.text).toContain("Digest:");
  expect(out.text).toMatch(/pregate approve [0-9a-f]{12}$/m);
  expect(f.snapshot()).toEqual(before);
  expect(readFileSync(join(f.data, "0.2.8", ENGINE_FILE))).toEqual(readFileSync(old028));
});
