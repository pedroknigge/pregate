import { afterAll, beforeAll, expect, test } from "bun:test";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { compile } from "../src/compile.ts";
import { canonical } from "../src/disk.ts";
import { LOCK, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { submissionOwner } from "../src/issue-submission.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { REPO } from "../src/product.ts";
import { key, record } from "../src/state.ts";
import { removeTree } from "./remove-tree.ts";

const repository = join(import.meta.dir, "..");
const area = canonical(mkdtempSync(join(tmpdir(), "pregate-issue-transport-")));
const bin = join(area, "bin");
const engine = join(area, ENGINE_FILE);
const worker = join(area, "worker.ts");
let sequence = 0;

beforeAll(() => {
  mkdirSync(bin);
  const producer = join(area, "gh.ts");
  writeFileSync(producer, `import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
const action = process.argv[3], mode = process.env.PREGATE_GH_CASE;
appendFileSync(process.env.PREGATE_GH_CALLS!, action + "\\n");
writeFileSync(process.env.PREGATE_GH_PID!, String(process.pid));
if (process.platform !== "win32") process.on("SIGTERM", () => {});
if (action === "list") {
  if (mode === "reconcile") {
    console.log(JSON.stringify([{ url: "https://github.com/pedroknigge/pregate/issues/42",
      body: readFileSync(process.env.PREGATE_GH_BODY!, "utf8") }]));
  } else if (mode === "stdout" || mode === "stderr" || mode === "exact") {
    const limit = 16 * 1024 * 1024, extra = mode === "exact" ? 0 : 1;
    process.stdout.write("[]" + " ".repeat(mode === "stderr" ? 0 : limit - 2 + extra));
    if (mode !== "stdout") process.stderr.write(" ".repeat(limit + extra));
    setTimeout(() => process.exit(0), mode === "exact" ? 0 : 7000);
  } else console.log("[]");
} else if (action === "create") {
  const body = process.argv[process.argv.indexOf("--body-file") + 1]!;
  writeFileSync(process.env.PREGATE_GH_BODY!, readFileSync(body, "utf8"));
  process.stdout.write("https://github.com/pedroknigge/pregate/issues/42\\n");
  if (mode === "deadline") setTimeout(() => process.exit(0), 22000);
} else process.exit(9);
`);
  const built = Bun.spawnSync([process.execPath, "build", producer, "--compile", "--minify",
    "--no-compile-autoload-bunfig", "--no-compile-autoload-dotenv",
    `--outfile=${join(bin, process.platform === "win32" ? "gh.exe" : "gh")}`],
  { cwd: repository, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 60_000 });
  expect(built.exitCode, built.stderr.toString()).toBe(0);
  compileBinary(hostTarget(), engine);
  writeFileSync(worker, `import { run } from ${JSON.stringify(join(repository, "src/cli.ts"))};
process.chdir(process.argv[2]!);
process.exit(await run(process.argv.slice(3)));
`);
}, 120_000);
afterAll(() => removeTree(area));

async function killedWithGh(child: ChildProcess, exited: Promise<unknown>, ghPid: () => number | undefined, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } finally {
    child.kill("SIGKILL");
    await exited;
    // The CLI owns gh, not its parent test. Clean up the known fixture child after killing its owner.
    const pid = ghPid();
    if (pid !== undefined) killFixtureGh(pid);
  }
}

// On Windows the job object may already have ended it with its owner (ESRCH).
function killFixtureGh(pid: number): void {
  try { process.kill(pid, "SIGKILL"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e; }
}

function underStateHome(home: string, saved: string | undefined, work: () => void): void {
  try {
    process.env.XDG_STATE_HOME = home;
    work();
  } finally {
    if (saved === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = saved;
  }
}

function project(kind: "source" | "compiled", scenario: string) {
  const root = canonical(join(area, String(++sequence), "repo"));
  const local = join(root, "local");
  mkdirSync(join(root, ".pregate"), { recursive: true });
  const preset = readFileSync(join(repository, PRESET), "utf8");
  const contract = compile(preset, sourcesOf(repository), VERSIONS);
  if ("errors" in contract) throw new Error(contract.errors.join("\n"));
  expect(contract.lock.rules.filter((rule) => rule.id.startsWith("core/"))).toHaveLength(68);
  writeFileSync(join(root, PRESET), preset);
  writeFileSync(join(root, LOCK), contract.text);
  const env = { ...process.env, PATH: bin, HOME: join(local, "home"), USERPROFILE: join(local, "home"),
    XDG_DATA_HOME: join(local, "data"), XDG_STATE_HOME: join(local, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    PREGATE_GH_CASE: scenario, PREGATE_GH_CALLS: join(local, "calls"), PREGATE_GH_PID: join(local, "pid"),
    PREGATE_GH_BODY: join(local, "published-body") };
  underStateHome(env.XDG_STATE_HOME, process.env.XDG_STATE_HOME, () => {
    record(key({ harness: "codex", id: String(sequence) }),
      { at: Date.now(), versions: VERSIONS, callId: "denied", turn: "one", agentId: null,
        kind: "pre-edit", root, path: join(root, "src/a.ts"), verdict: "deny", halted: false,
        form: "syntax", shadowed: false, violations: [], afterSha: null, astHash: null }, null);
  });
  const invoke = (args: string[], mode = scenario) => {
    const child = spawnSync(kind === "source" ? process.execPath : engine,
      kind === "source" ? [worker, root, ...args] : args,
      { cwd: kind === "source" ? repository : root, env: { ...env, PREGATE_GH_CASE: mode },
        stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 25_000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 });
    expect(child.error, child.stderr).toBeUndefined();
    expect(child.signal, child.stderr).toBeNull();
    return { code: child.status, text: child.stdout + child.stderr };
  };
  const drafted = invoke(["issue", "draft", "--last"]);
  expect(drafted.code, drafted.text).toBe(0);
  const id = /^Digest: ([0-9a-f]{64})$/m.exec(drafted.text)![1]!;
  const data = join(env.XDG_DATA_HOME, "pregate/issues");
  const draft = JSON.parse(readFileSync(join(data, `${id}.json`), "utf8"));
  const start = () => spawn(kind === "source" ? process.execPath : engine,
    kind === "source" ? [worker, root, "issue", "submit", id, "--yes"] : ["issue", "submit", id, "--yes"],
    { cwd: kind === "source" ? repository : root, env, stdio: "ignore" });
  return { invoke, start, root, env, id, draftFile: join(data, `${id}.json`),
    receipt: join(data, `${draft.fingerprint}.submitted.json`),
    pending: join(data, `${draft.fingerprint}.submitting`) };
}

function calls(path: string): string[] { return readFileSync(path, "utf8").trim().split("\n"); }

test.each(["source", "compiled"] as const)("%s issue transport boundary: deadline rejects late success and reconciles without a second create", (kind) => {
  const p = project(kind, "deadline");
  const began = performance.now();
  const submitted = p.invoke(["issue", "submit", p.id, "--yes"]);
  expect(submitted.code, submitted.text).toBe(1);
  expect(submitted.text).toContain("15000 ms");
  expect(submitted.text).toContain("Publication outcome is uncertain");
  expect(submitted.text).toContain("reconciles the existing issue");
  expect(performance.now() - began).toBeLessThan(19_000);
  expect(() => process.kill(Number(readFileSync(p.env.PREGATE_GH_PID, "utf8")), 0)).toThrow();
  expect(existsSync(p.receipt)).toBe(false);
  expect(existsSync(p.draftFile)).toBe(true);
  expect(submissionOwner(p.pending)).toMatchObject({ phase: "creating", state: "dead" });
  expect(p.invoke(["issue", "submit", p.id, "--yes"], "uncertain").code).toBe(1);
  expect(submissionOwner(p.pending)).toMatchObject({ phase: "creating", state: "dead" });
  expect(p.invoke(["issue", "submit", p.id, "--yes"], "reconcile").text).toContain("Already reported:");
  expect(readFileSync(p.receipt, "utf8").trim()).toBe(`https://github.com/${REPO}/issues/42`);
  expect(submissionOwner(p.pending)).toBeNull();
  expect(p.invoke(["issue", "submit", p.id, "--yes"]).code).toBe(0);
  expect(calls(p.env.PREGATE_GH_CALLS)).toEqual(["list", "create", "list", "list"]);
}, 30_000);

test.each([["source", "stdout"], ["source", "stderr"], ["compiled", "stdout"], ["compiled", "stderr"]] as const)(
  "%s issue transport boundary: excessive %s terminates lookup and cannot create an issue", (kind, channel) => {
    const p = project(kind, channel);
    const began = performance.now();
    const submitted = p.invoke(["issue", "submit", p.id, "--yes"]);
    expect(submitted.code, submitted.text).toBe(1);
    expect(submitted.text).toContain("output budget");
    expect(performance.now() - began).toBeLessThan(5000);
    expect(() => process.kill(Number(readFileSync(p.env.PREGATE_GH_PID, "utf8")), 0)).toThrow();
    expect(existsSync(p.receipt)).toBe(false);
    expect(existsSync(p.draftFile)).toBe(true);
    expect(submissionOwner(p.pending)).toBeNull();
    expect(calls(p.env.PREGATE_GH_CALLS)).toEqual(["list"]);
  }, 15_000);

test.each(["source", "compiled"] as const)("%s issue transport boundary: exact independent stdout and stderr budgets remain valid", (kind) => {
  const p = project(kind, "exact");
  const submitted = p.invoke(["issue", "submit", p.id, "--yes"]);
  expect(submitted.code, submitted.text).toBe(0);
  expect(readFileSync(p.receipt, "utf8").trim()).toBe(`https://github.com/${REPO}/issues/42`);
  expect(submissionOwner(p.pending)).toBeNull();
  expect(calls(p.env.PREGATE_GH_CALLS)).toEqual(["list", "create"]);
}, 15_000);

test.each(["source", "compiled"] as const)("%s issue transport boundary: killed publishing CLI reconciles the same effect without recreating", async (kind) => {
  const p = project(kind, "deadline"), child = p.start(), exited = once(child, "exit");
  const began = performance.now();
  let ghPid: number | undefined;
  await killedWithGh(child, exited, () => ghPid, async () => {
    while (!existsSync(p.env.PREGATE_GH_BODY)) {
      if (child.exitCode !== null || performance.now() - began > 10_000) throw new Error("Fixture publication did not begin");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    ghPid = Number(readFileSync(p.env.PREGATE_GH_PID, "utf8"));
    expect(submissionOwner(p.pending)).toMatchObject({ phase: "creating", state: "alive" });
  });
  expect(existsSync(p.receipt)).toBe(false);
  expect(submissionOwner(p.pending)).toMatchObject({ phase: "creating", state: "dead" });
  expect(p.invoke(["issue", "submit", p.id, "--yes"], "uncertain").code).toBe(1);
  expect(submissionOwner(p.pending)).toMatchObject({ phase: "creating", state: "dead" });
  expect(p.invoke(["issue", "submit", p.id, "--yes"], "reconcile").code).toBe(0);
  expect(readFileSync(p.receipt, "utf8").trim()).toBe(`https://github.com/${REPO}/issues/42`);
  expect(submissionOwner(p.pending)).toBeNull();
  expect(calls(p.env.PREGATE_GH_CALLS)).toEqual(["list", "create", "list", "list"]);
  expect(() => process.kill(ghPid!, 0)).toThrow();
}, 15_000);

test("issue transport boundary: actual creation-phase mutation exposes duplicate effects", async () => {
  const p = project("source", "deadline");
  let changes = 0;
  const mutated = await Bun.build({ entrypoints: [worker], target: "bun", outdir: join(area, "mutation"), naming: "worker.js",
    plugins: [{ name: "lost-creation-phase", setup(build) {
      build.onLoad({ filter: /[\\/\\\\]issue-submission\.ts$/ }, ({ path }) => {
        const source = readFileSync(path, "utf8"), next = source.replace('phase: "creating"', 'phase: "checking"');
        if (next === source) throw new Error("Expected the actual creation transition");
        changes++;
        return { contents: next, loader: "ts" };
      });
    } }] });
  expect(mutated.success, JSON.stringify(mutated.logs)).toBe(true);
  expect(changes).toBe(1);
  const first = spawnSync(process.execPath, [join(area, "mutation/worker.js"), p.root, "issue", "submit", p.id, "--yes"],
    { cwd: repository, env: p.env, stdio: ["ignore", "pipe", "pipe"], timeout: 25_000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 });
  expect(first.error).toBeUndefined();
  expect(first.signal).toBeNull();
  expect(first.status).toBe(1);
  expect(first.stdout.toString()).toContain("15000 ms");
  expect(submissionOwner(p.pending)).toMatchObject({ phase: "checking", state: "dead" });
  expect(p.invoke(["issue", "submit", p.id, "--yes"], "uncertain").code).toBe(0);
  expect(calls(p.env.PREGATE_GH_CALLS)).toEqual(["list", "create", "list", "create"]);
}, 30_000);
