import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { packTemplate } from "../src/pack-template.ts";
import { VERSIONS } from "../src/versions.ts";
import { slash } from "../src/paths.ts";

function commandPath(dir: string): string {
  const path = slash(realpathSync(dir));
  return /^[\w./-]+$/.test(path) ? path : JSON.stringify(path);
}
import { librarySource } from "../src/library.ts";
import type { Preset } from "../src/types.ts";

// Each case spawns the compiled engine several times; on Windows a spawn costs 0.3-1 s.
setDefaultTimeout(60_000);

const area = mkdtempSync(join(tmpdir(), "pregate-adoption-"));
const binary = join(area, ENGINE_FILE);
// Compiling the engine takes longer than bun's 5 s hook default on Windows runners.
beforeAll(() => compileBinary(hostTarget(), binary, true), 120_000);
afterAll(() => rmSync(area, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

function project(name: string) {
  const root = join(area, name);
  mkdirSync(root);
  const machine = join(area, name + "-machine");
  mkdirSync(machine, { recursive: true });
  const env = { ...process.env, HOME: join(machine, "home"), CODEX_HOME: join(machine, "codex"), GROK_HOME: join(machine, "grok"),
    XDG_DATA_HOME: join(machine, "data"), XDG_STATE_HOME: join(machine, "state"), CI: "1" };
  const cli = (args: string[], extra = {}) => {
    // A pipe can deliver a short read of a large audit report. Capture the bytes in files.
    const out = join(machine, "stdout"), err = join(machine, "stderr");
    const outFd = openSync(out, "w"), errFd = openSync(err, "w");
    let result: ReturnType<typeof Bun.spawnSync>;
    try {
      result = Bun.spawnSync([binary, ...args], { cwd: root, env: { ...env, ...extra }, stdout: outFd, stderr: errFd, timeout: 20_000 });
    } finally {
      closeSync(outFd); closeSync(errFd);
    }
    const stdout = readFileSync(out, "utf8"), stderr = readFileSync(err, "utf8");
    return { code: result.exitCode, text: stdout + stderr, stdout, stderr };
  };
  expect(cli(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  const contract = () => ["preset.json", "pregate.lock.json"].map((file) => readFileSync(join(root, ".pregate", file), "utf8"));
  const plan = (value: unknown) => { writeFileSync(join(root, "plan.json"), JSON.stringify(value)); return "plan.json"; };
  return { root, env, cli, contract, plan };
}

test("agent practices adoption keeps source registration and individual rule selection separate", () => {
  const p = project("agent-practices");
  const before = p.contract();
  const preview = p.cli(["pack", "add", "--library", "agent-practices", "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(p.contract()).toEqual(before);
  expect(p.cli(["pack", "add", "--library", "agent-practices", "--source-only", "--yes"]).code).toBe(0);
  const registered = JSON.parse(p.contract()[1]!);
  expect(registered.rules.some((r: { id: string }) => r.id.startsWith("agent-practices/"))).toBe(false);
  expect(p.cli(["pack", "enable", "agent-practices/launch-safety", "--only", "PRACTICE-002,PRACTICE-003", "--yes"]).code).toBe(0);
  const selected = JSON.parse(p.contract()[1]!).rules.filter((r: { id: string }) => r.id.startsWith("agent-practices/"));
  expect(selected.map((r: { id: string }) => r.id).sort()).toEqual(["agent-practices/PRACTICE-002", "agent-practices/PRACTICE-003"]);
  const status = p.cli(["fitness", "status", "--json"]);
  expect(status.code).toBe(1);
  const requirements = JSON.parse(status.text).requirements.filter((r: { rule: string }) => r.rule.startsWith("agent-practices/"));
  expect(requirements).toHaveLength(2);
  expect(requirements.every((r: { status: string }) => r.status === "unverified")).toBe(true);
});

test("pack add selects the pack's complete methodologies in the same review; preview ones wait for pack enable", () => {
  const p = project("add-selects"), before = p.contract();
  const practices = p.cli(["pack", "add", "--library", "agent-practices", "--preview"]);
  expect(practices.code, practices.text).toBe(0);
  expect(practices.text).toContain("Selected: none. Skipped: agent-practices/");
  expect(practices.text).toContain("(preview methodology)");
  const preview = p.cli(["pack", "add", "--library", "python", "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(preview.text).toMatch(/^Selected: python\/quality\./m);
  expect(preview.text).toContain("Skipped: python/architecture (");
  expect(p.contract()).toEqual(before);
  const digest = preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
  expect(p.cli(["approve", "--yes", "--digest", digest]).code).toBe(0);
  const preset = JSON.parse(p.contract()[0]!);
  expect(preset.methodologies).toContain("python/quality");
  expect(JSON.parse(p.contract()[1]!).rules.some((r: { id: string }) => r.id.startsWith("python/"))).toBe(true);
  const enabled = p.cli(["pack", "enable", "testing/tdd", "--preview"]);
  expect(enabled.code, enabled.text).toBe(0);
  expect(enabled.text).toContain('"ns": "testing"');
});

test("agent practices source and chosen methodology enter one digest-bound review", () => {
  const p = project("agent-practices-batch"), before = p.contract();
  const file = p.plan({ sources: [{ kind: "library", ns: "agent-practices" }], methodologies: ["agent-practices/launch-safety"] });
  const preview = p.cli(["pack", "apply", file, "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(p.contract()).toEqual(before);
  const digest = preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
  expect(p.cli(["approve", "--yes", "--digest", digest]).code).toBe(0);
  const rules = JSON.parse(p.contract()[1]!).rules.filter((r: { id: string }) => r.id.startsWith("agent-practices/"));
  expect(rules).toHaveLength(6);
  expect(rules.every((r: { check: string }) => r.check.startsWith("agent-practices/launch-safety/"))).toBe(true);
});

test("one installed-engine update migrates old pins and proposes malformed override recovery without delegating or changing policy before approval", () => {
  const p = project("project-update");
  expect(p.cli(["pack", "apply", p.plan({ sources: ["testing", "pstack", "dcouplr"].map(ns => ({ kind: "library", ns })), methodologies: ["testing/tdd"] }), "--yes"]).code).toBe(0);
  const preset = JSON.parse(p.contract()[0]!);
  preset.scope = { include: ["src/**", "test/**"], exclude: ["src/generated/**"] };
  const coreId = "core/CORE-INV-001";
  preset.overrides = { "testing/TDD-FOCUS-001": { severity: "deny", enforcement: "shadow", params: { paths: ["test/**"], exclude: ["test/legacy/**"] }, note: "Team scope" }, [coreId]: "off", "core/CORE-INV-002": { note: "Keep the reviewed rationale" } };
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset));
  expect(p.cli(["preset", "compile"]).code).toBe(0);
  const previous = JSON.parse(p.contract()[1]!);
  const focus = previous.rules.find((rule: { id: string }) => rule.id === "testing/TDD-FOCUS-001");
  preset.engine = "0.0.0";
  preset.sources[0].version = "0.0.0";
  preset.sources.find((source: { ns: string }) => source.ns === "pstack").version = "1.0.0";
  preset.sources.find((source: { ns: string }) => source.ns === "dcouplr").version = "1.15.0";
  preset.overrides["testing/TDD-FOCUS-001"] = "enforce";
  previous.engine = "0.0.0"; previous.core = "0.0.0";
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset));
  writeFileSync(join(p.root, ".pregate/pregate.lock.json"), JSON.stringify(previous));
  const before = p.contract();
  const diagnosis = p.cli(["preset", "diagnose", "--json"]);
  expect(diagnosis.code).toBe(0);
  expect(JSON.parse(diagnosis.text)).toMatchObject({ installed: VERSIONS, project: { engine: "0.0.0", lockEngine: "0.0.0", core: "0.0.0" } });
  expect(JSON.parse(diagnosis.text).errors.join("\n")).toContain("/overrides/testing~1TDD-FOCUS-001");
  const pstackVersion = JSON.parse(librarySource("pstack")!["source.json"]!).version;
  expect(JSON.parse(diagnosis.text).errors.join("\n")).toContain(`pstack: 1.0.0 -> ${pstackVersion}`);
  const dcouplrVersion = JSON.parse(librarySource("dcouplr")!["source.json"]!).version;
  expect(JSON.parse(diagnosis.text).errors.join("\n")).toContain(`dcouplr: 1.15.0 -> ${dcouplrVersion}`);
  expect(p.cli(["preset", "schema"]).text).toContain('"enforcement"');
  const preview = p.cli(["update", "--project", "--preview"]);
  expect(preview.code).toBe(0);
  expect(preview.text).toContain("Repair overrides.testing/TDD-FOCUS-001");
  expect(preview.text).toContain(`pstack: 1.0.0 -> ${pstackVersion}`);
  expect(preview.text).toContain(`dcouplr: 1.15.0 -> ${dcouplrVersion}`);
  expect(p.contract()).toEqual(before);
  expect(p.cli(["pack", "update", "pstack", "--preview"]).code).toBe(0);
  expect(p.contract()).toEqual(before);
  const currentPreview = p.cli(["approve", "--preview"]);
  const digest = currentPreview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
  expect(p.cli(["approve", "--yes", "--digest", "0".repeat(64)]).code).toBe(1);
  expect(p.contract()).toEqual(before);
  expect(p.cli(["approve", "--yes", "--digest", digest]).code).toBe(0);
  const accepted = JSON.parse(p.contract()[0]!);
  expect(accepted.engine).toBe(VERSIONS.engine);
  expect(accepted.sources[0].version).toBe(VERSIONS.core);
  expect(accepted.scope).toEqual(preset.scope);
  expect(accepted.methodologies).toEqual(preset.methodologies);
  expect(accepted.overrides[coreId]).toBe("off");
  expect(accepted.overrides["core/CORE-INV-002"]).toEqual({ note: "Keep the reviewed rationale" });
  expect(accepted.overrides["testing/TDD-FOCUS-001"]).toEqual({ severity: focus.severity, enforcement: "enforce", params: focus.params });
  expect(p.cli(["check", "--stdin", "--path", "src/a.ts"]).code).toBe(0);
  const repeated = p.cli(["pack", "update", "--all", "--preview"]);
  expect(repeated.code).toBe(0);
  expect(repeated.text).toContain("already current");
  expect(p.contract()).toEqual([JSON.stringify(accepted, null, 2) + "\n", p.contract()[1]!]);
}, 120_000); // Windows adoption runs exceed 30 s.

test("a project pinning a newer bundled pack than this engine carries is never proposed for a downgrade", () => {
  const p = project("newer-bundled");
  expect(p.cli(["pack", "apply", p.plan({ sources: ["testing", "pstack"].map(ns => ({ kind: "library", ns })), methodologies: ["testing/tdd"] }), "--yes"]).code).toBe(0);
  const bundled = JSON.parse(librarySource("testing")!["source.json"]!).version as string;
  const [major, minor, patch] = bundled.split(".").map(Number);
  const pinned = `${major}.${minor}.${patch! + 1}`;
  const pstackVersion = JSON.parse(librarySource("pstack")!["source.json"]!).version;
  const [preset, lock] = p.contract().map((text) => JSON.parse(text));
  preset.sources.find((source: { ns: string }) => source.ns === "testing").version = pinned;
  preset.sources.find((source: { ns: string }) => source.ns === "pstack").version = "1.0.0";
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset, null, 2) + "\n");
  writeFileSync(join(p.root, ".pregate/pregate.lock.json"), JSON.stringify(lock, null, 2) + "\n");
  const before = p.contract();
  const line = `testing ${pinned} is newer than this engine's ${bundled}; update the engine (pregate update) or approve with the engine that prepared it`;
  for (const args of [["update", "--project", "--preview"], ["pack", "update", "testing", "--preview"], ["pack", "update", "--all", "--preview"], ["guide", "--preview"]]) {
    const result = p.cli(args);
    expect(result.code).toBe(0);
    expect(result.text).toContain(line);
    expect(result.text).toContain(`pstack: 1.0.0 -> ${pstackVersion}`);
    expect(result.text).not.toContain(`testing: ${pinned} -> ${bundled}`);
    expect(result.text).not.toContain("WARNING: this may weaken protection");
    expect(result.text).not.toContain("Digest:");
    expect(p.contract()).toEqual(before);
  }
  expect(JSON.parse(p.cli(["preset", "diagnose", "--json"]).text).errors).toContain(line);
});

test("a newer engine or core pin is held, never downgraded, and a held project is never reported current or applied", () => {
  const p = project("newer-engine");
  const current = project("newer-engine-peer");
  const [preset, lock] = p.contract().map((text) => JSON.parse(text));
  preset.engine = "99.0.0"; lock.engine = "99.0.0";
  preset.sources.find((source: { kind: string }) => source.kind === "builtin").version = "99.0.0";
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset, null, 2) + "\n");
  writeFileSync(join(p.root, ".pregate/pregate.lock.json"), JSON.stringify(lock, null, 2) + "\n");
  const before = p.contract();
  const lines = [`Engine 99.0.0 is newer than this engine's ${VERSIONS.engine};`, `Core 99.0.0 is newer than this engine's ${VERSIONS.core};`];
  for (const [args, code] of [[["update", "--project", "--preview"], 0], [["update", "--project", "--yes"], 1], [["pack", "update", "core", "--yes"], 1]] as const) {
    const result = p.cli([...args]);
    expect(result.code).toBe(code);
    for (const line of lines) expect(result.text).toContain(line);
    expect(result.text).not.toContain("Engine: 99.0.0 ->");
    expect(result.text).not.toContain("Core: 99.0.0 ->");
    expect(result.text).not.toContain("Digest:");
    expect(p.contract()).toEqual(before);
  }
  const held = `1 projects pin a newer engine, core or pack than this engine and are not current: ${slash(realpathSync(p.root))}.`;
  const preview = p.cli(["update", "--projects", p.root, current.root, "--preview"]);
  expect(preview.code).toBe(0);
  expect(preview.text).toContain(held);
  expect(preview.text).toContain("1 projects are current. No project contracts changed.");
  expect(preview.text).not.toContain("All 2 projects are current");
  expect(p.cli(["guide", "--preview", "--projects", p.root, current.root]).text).toContain(held);
  const applied = p.cli(["update", "--projects", p.root, current.root, "--yes"]);
  expect(applied.code).toBe(1);
  expect(applied.text).toContain(held);
  expect(applied.text).not.toContain(`Current ${slash(realpathSync(p.root))}: already current`);
  expect(p.contract()).toEqual(before);
  const diagnosis = JSON.parse(p.cli(["preset", "diagnose", "--json"]).text).errors.join("\n");
  for (const line of lines) expect(diagnosis).toContain(line);
});

test("explicit project paths migrate together from another directory, preserve custom policy and disabled consent, and repeat without rewriting", () => {
  const a = project("multi project a");
  const b = project("multi project b");
  expect(a.cli(["pack", "init", "team"]).code).toBe(0);
  expect(a.cli(["pack", "add", "--path", ".pregate/packs/team", "--yes"]).code).toBe(0);
  for (const p of [a, b]) {
    const preset = JSON.parse(p.contract()[0]!);
    preset.engine = "0.0.0";
    preset.scope = { include: ["app/**", "components/**"], exclude: ["app/generated/**"] };
    preset.overrides = { "core/CORE-INV-003": "off" };
    writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset));
  }
  expect(b.cli(["disable", "--yes"], a.env).code).toBe(0);
  const before = [a.contract(), b.contract()];
  const paths = [a.root, b.root, join(a.root, ".pregate")];
  const preview = a.cli(["update", "--projects", ...paths, "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(preview.text).toContain("2 project reviews prepared");
  expect([a.contract(), b.contract()]).toEqual(before);
  const applied = a.cli(["update", "--projects", ...paths, "--yes"]);
  expect(applied.code, applied.text).toBe(0);
  expect(applied.text).toContain("2/2 project contracts updated");
  for (const p of [a, b]) {
    const preset = JSON.parse(p.contract()[0]!);
    expect(preset.engine).toBe(VERSIONS.engine);
    expect(preset.scope).toEqual({ include: ["app/**", "components/**"], exclude: ["app/generated/**"] });
    expect(preset.overrides).toEqual({ "core/CORE-INV-003": "off" });
  }
  expect(JSON.parse(a.contract()[0]!).sources).toContainEqual({ ns: "team", kind: "path", path: ".pregate/packs/team" });
  expect(JSON.parse(b.cli(["status", "--json"], a.env).text).consent).toBe(false);
  expect(a.cli(["approve", "--preview"]).code).toBe(1);
  const after = [a.contract(), b.contract()];
  expect(a.cli(["update", "--projects", ...paths, "--yes"]).text).toContain("already current");
  expect([a.contract(), b.contract()]).toEqual(after);
  for (const p of [a, b]) {
    for (const file of ["preset.json", "pregate.lock.json"]) {
      const path = join(p.root, ".pregate", file);
      writeFileSync(path, readFileSync(path, "utf8").replaceAll("\n", "\r\n"));
    }
  }
  const crlf = [a.contract(), b.contract()];
  expect(a.cli(["update", "--projects", ...paths, "--yes"]).text).toContain("already current");
  expect([a.contract(), b.contract()]).toEqual(crlf);
}, 60000);

test("one batch code from the multi-project preview approves every project from a third directory, once", () => {
  const a = project("batch project a");
  const b = project("batch project b");
  for (const p of [a, b]) {
    const preset = JSON.parse(p.contract()[0]!);
    preset.engine = "0.0.0";
    writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset));
  }
  expect(b.cli(["disable", "--yes"], a.env).code).toBe(0);
  const preview = a.cli(["update", "--projects", a.root, b.root, "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  const code = /^Approve all 2 project updates: ! pregate approve ([0-9a-f]{12})$/m.exec(preview.text)?.[1];
  expect(code, preview.text).toBeDefined();
  // Only the batch code is offered, with the Cursor terminal line the per-project codes carried.
  expect(preview.text.match(/pregate approve [0-9a-f]{12}/g), preview.text).toEqual([`pregate approve ${code}`]);
  expect(preview.text).toContain("Cursor needs a separate terminal");
  const third = join(area, "batch third");
  mkdirSync(third);
  const approve = () => {
    const result = Bun.spawnSync([binary, "approve", code!, "--no-commit"], { cwd: third, env: a.env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    return { code: result.exitCode, text: result.stdout.toString() + result.stderr.toString() };
  };
  const applied = approve();
  expect(applied.code, applied.text).toBe(0);
  expect(applied.text).toContain("2/2 project contracts updated.");
  for (const p of [a, b]) expect(JSON.parse(p.contract()[0]!).engine).toBe(VERSIONS.engine);
  expect(JSON.parse(b.cli(["status", "--json"], a.env).text).consent).toBe(false);
  const again = approve();
  expect(again.code).toBe(1);
  expect(again.text).toContain("No pending project review or batch review matches");
});

test("project update names sibling worktrees that pin another engine, with the exact review command", () => {
  const p = project("worktree-main");
  const git = (...args: string[]) => expect(Bun.spawnSync(["git", "-c", "user.name=W", "-c", "user.email=w@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd: p.root, stdout: "pipe", stderr: "pipe" }).exitCode).toBe(0);
  git("init", "-q");
  git("add", ".");
  git("commit", "-qm", "contract");
  const sibling = join(area, "worktree-sibling");
  git("worktree", "add", "-q", sibling);
  expect(p.cli(["update", "--project", "--preview"]).text).not.toContain("Other worktrees");
  const lock = JSON.parse(readFileSync(join(sibling, ".pregate/pregate.lock.json"), "utf8"));
  writeFileSync(join(sibling, ".pregate/pregate.lock.json"), JSON.stringify({ ...lock, engine: "0.0.0" }));
  const preview = p.cli(["update", "--project", "--preview"]);
  expect(preview.text).toContain(`Other worktrees of this repository pin another engine: ${slash(realpathSync(sibling))}.`);
  expect(preview.text).toContain(`Review them together: pregate update --projects ${commandPath(sibling)} --preview`);
});

test("multi-project --yes applies and commits each prepared project; --no-commit leaves the files uncommitted", () => {
  const repos = ["batch commit a", "batch commit b"].map((name) => project(name));
  const git = (root: string, ...args: string[]) => Bun.spawnSync(["git", "-c", "user.name=W", "-c", "user.email=w@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd: root, stdout: "pipe", stderr: "pipe" }).stdout.toString();
  const pin = () => {
    for (const p of repos) {
      const preset = JSON.parse(p.contract()[0]!); preset.engine = "0.0.0";
      writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset));
      git(p.root, "add", "."); git(p.root, "commit", "-qm", "pin 0.0.0");
    }
  };
  for (const p of repos) {
    git(p.root, "init", "-q");
    // update --yes commits through the product, which reads this repo's identity, not the helper's -c.
    git(p.root, "config", "user.name", "W");
    git(p.root, "config", "user.email", "w@example.com");
    git(p.root, "config", "commit.gpgsign", "false");
  }
  pin();
  const [a, b] = repos as [ReturnType<typeof project>, ReturnType<typeof project>];
  const preview = a.cli(["update", "--projects", a.root, b.root, "--preview"]);
  expect(preview.text).toContain("2 project reviews prepared; 0 already current. No project contracts changed.");
  const applied = a.cli(["update", "--projects", a.root, b.root, "--yes"]);
  expect(applied.code, applied.text).toBe(0);
  for (const p of repos) {
    expect(applied.text).toContain(`Updated ${slash(realpathSync(p.root))}: Committed 1 file (.pregate/) as `);
    expect(git(p.root, "status", "--porcelain")).toBe("");
    expect(git(p.root, "log", "-1", "--format=%s")).toStartWith("chore: apply reviewed PREGATE contract ");
  }
  expect(applied.text).toContain("2/2 project contracts updated; 0 already current.");
  pin();
  const kept = a.cli(["update", "--projects", a.root, b.root, "--yes", "--no-commit"]);
  expect(kept.code, kept.text).toBe(0);
  for (const p of repos) {
    expect(kept.text).toContain(`Updated ${slash(realpathSync(p.root))}: Approved contract applied and lock compiled.`);
    expect(git(p.root, "status", "--porcelain")).toContain(".pregate/preset.json");
  }
  const current = a.cli(["update", "--projects", a.root, b.root, "--preview"]);
  expect(current.text).toContain("All 2 projects are current. No project contracts changed.");
});

test("a single-project update preview names other registered projects that pin older engines", () => {
  const main = project("registry main");
  const other = project("registry other");
  const newer = project("registry newer");
  for (const [p, engine] of [[other, "0.0.0"], [newer, "99.0.0"]] as const) {
    const path = join(p.root, ".pregate/pregate.lock.json");
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), engine }));
    expect(p.cli(["enable", "--yes"], main.env).code).toBe(0);
  }
  const preview = main.cli(["update", "--project", "--preview"]);
  expect(preview.text).toContain(`1 other registered projects pin older engines: ${slash(realpathSync(other.root))}.`);
  expect(preview.text).toContain(`Review them together: pregate update --projects ${JSON.stringify(slash(realpathSync(other.root)))} --preview`);
  expect(preview.text).not.toContain("registry newer");
});

test("multi-project update validates every path and candidate before applying any contract", () => {
  const a = project("multi-valid");
  const b = project("multi-invalid");
  const preset = JSON.parse(a.contract()[0]!); preset.engine = "0.0.0";
  writeFileSync(join(a.root, ".pregate/preset.json"), JSON.stringify(preset));
  const invalid = JSON.parse(b.contract()[0]!); invalid.sources.push({ ns: "missing-pack", kind: "library", version: "1.0.0" });
  writeFileSync(join(b.root, ".pregate/preset.json"), JSON.stringify(invalid));
  const before = [a.contract(), b.contract()];
  for (const args of [[a.root, b.root, "--yes"], [a.root, join(area, "absent"), "--yes"], [a.root, "--preview", "--yes"], ["--preview"], [a.root, "--version", "0.2.5"],
    [a.root, "--preview", "--no-commit"], [a.root, "--no-commit"], [a.root, "--yes", "--yes"]]) {
    expect(a.cli(["update", "--projects", ...args]).code).toBe(1);
    expect([a.contract(), b.contract()]).toEqual(before);
  }
  // A preview reports each project: one broken project does not hide the review of another.
  const preview = a.cli(["update", "--projects", a.root, b.root, "--preview"]);
  expect(preview.code).toBe(1);
  expect(preview.text).toContain(`1 project reviews failed: ${slash(realpathSync(b.root))}.`);
  expect(preview.text).toContain("1 project reviews prepared; 0 already current. No project contracts changed.");
  expect([a.contract(), b.contract()]).toEqual(before);
});

test("cross-project activation denies agent commands even from an inactive cwd while preview and quoted data remain allowed", () => {
  const p = project("multi-agent-boundary");
  const outside = join(area, "inactive cwd"); mkdirSync(outside);
  const before = p.contract();
  const installed = join(p.env.XDG_DATA_HOME, "pregate", VERSIONS.engine, ENGINE_FILE);
  mkdirSync(dirname(installed), { recursive: true }); copyFileSync(binary, installed);
  const hook = (command: string) => Bun.spawnSync([installed, "hook", "pre", "--harness", "claude-code"], {
    cwd: outside, env: p.env, stdout: "pipe", stderr: "pipe", timeout: 5000,
    stdin: Buffer.from(JSON.stringify({ hook_event_name: "PreToolUse", session_id: "neutral-upgrade", tool_use_id: "bulk-update", cwd: outside, tool_name: "Bash", tool_input: { command } })),
  });
  for (const command of [`pregate update --projects ${JSON.stringify(p.root)} --yes`, `env pregate update --projects ${JSON.stringify(p.root)} --yes`, `sh -c 'pregate update --projects ${JSON.stringify(p.root)} --yes'`]) {
    expect(hook(command).exitCode).toBe(2);
    expect(p.contract()).toEqual(before);
  }
  for (const command of [`pregate update --projects ${JSON.stringify(p.root)} --preview`, 'echo "pregate update --projects"']) {
    const out = hook(command);
    expect(out.exitCode, out.stderr.toString()).toBe(0);
  }
});

test("project update rejects an unknown pack, unrelated malformed config and stale approval without changing the contract", () => {
  const p = project("update-rejections");
  const original = p.contract();
  for (const change of [
    (preset: Preset) => { preset.sources.push({ ns: "missing-pack", kind: "library", version: "1.0.0" }); },
    (preset: Preset) => { Object.assign(preset, { unrecognized: true }); },
    (preset: Preset) => { Object.assign(preset, { overrides: { "not/a-rule": "enforce" } }); },
  ]) {
    const preset = JSON.parse(original[0]!);
    change(preset);
    writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset));
    const before = p.contract();
    expect(p.cli(["update", "--project", "--preview"]).code).toBe(1);
    expect(p.contract()).toEqual(before);
  }
  const old = JSON.parse(original[0]!); old.engine = "0.0.0";
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(old));
  const preview = p.cli(["pack", "update", "--all", "--preview"]);
  expect(preview.code).toBe(0);
  const digest = preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
  writeFileSync(join(p.root, ".pregate/preset.json"), original[0] + "\n");
  const before = p.contract();
  expect(p.cli(["approve", "--yes", "--digest", digest]).code).toBe(1);
  expect(p.contract()).toEqual(before);
  for (const args of [["--project", "--yes", "--preview"], ["--project", "--version", "0.2.5"], ["--project", "--project"], ["--all", "--all", "--preview"]]) {
    expect(p.cli([args[0] === "--all" ? "pack" : "update", ...(args[0] === "--all" ? ["update"] : []), ...args]).code).toBe(1);
    expect(p.contract()).toEqual(before);
  }
});

test("compiled agy recovery reaches the current engine with a redirecting lock and never activates it", () => {
  const p = project("agy-old-lock");
  const preset = JSON.parse(p.contract()[0]!);
  const lock = JSON.parse(p.contract()[1]!);
  preset.engine = "0.0.0"; lock.engine = "0.2.6";
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset));
  writeFileSync(join(p.root, ".pregate/pregate.lock.json"), JSON.stringify(lock));
  const before = p.contract();
  for (const args of [["update", "--help"], ["pack", "update", "-h"], ["fitness", "bind", "--help"]]) {
    expect(p.cli(args).code).toBe(0);
    expect(p.contract()).toEqual(before);
  }
  const installed = join(p.env.XDG_DATA_HOME, "pregate", VERSIONS.engine, ENGINE_FILE);
  mkdirSync(dirname(installed), { recursive: true });
  copyFileSync(binary, installed);
  const hook = (command: string) => Bun.spawnSync([installed, "hook", "pre", "--harness", "agy"], {
    cwd: p.root, env: p.env, stdout: "pipe", stderr: "pipe", timeout: 5000,
    stdin: Buffer.from(JSON.stringify({ conversationId: "upgrade-replay", workspacePaths: [p.root], stepIdx: 1,
      toolCall: { name: "run_command", args: { Cwd: p.root, CommandLine: command } } })),
  });
  for (const command of ["pregate update --project --preview", "pregate pack update --all --preview", "pregate update --help"]) {
    const out = hook(command);
    expect(out.exitCode, out.stderr.toString()).toBe(0);
    expect(out.stdout.toString()).toBe("");
    expect(p.contract()).toEqual(before);
  }
  expect(hook("pregate approve --yes").exitCode).toBe(3);
  expect(hook("pregate check --all").exitCode).toBe(3);
  for (const args of [["update", "--help", "--yes"], ["pack", "update", "--help", "--yes"], ["unknown", "--help"]]) {
    expect(p.cli(args).code).toBe(1);
    expect(p.contract()).toEqual(before);
  }
  const preview = p.cli(["update", "--project", "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(preview.text).toContain("Digest:");
  expect(p.contract()).toEqual(before);
});

test("five packs and methodologies enter one reviewed candidate; stale review and an invalid member apply nothing", () => {
  const p = project("batch");
  const namespaces = ["typescript", "react", "nextjs", "drizzle", "supabase"];
  const methodologies = ["typescript/strict-types", "react/components", "nextjs/routing", "drizzle/queries", "supabase/client"];
  const file = p.plan({ sources: namespaces.map((ns) => ({ kind: "library", ns })), methodologies });
  const before = p.contract();
  const preview = p.cli(["pack", "apply", file, "--preview"]);
  expect(preview.code).toBe(0);
  expect(p.contract()).toEqual(before);
  const digest = preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
  expect(p.cli(["approve", "--yes", "--digest", "0".repeat(64)]).code).toBe(1);
  expect(p.contract()).toEqual(before);
  expect(p.cli(["approve", "--yes", "--digest", digest]).code).toBe(0);
  const preset = JSON.parse(p.contract()[0]!);
  expect(preset.sources.map((source: { ns: string }) => source.ns)).toEqual(["core", ...namespaces]);
  expect(preset.methodologies).toEqual(["core/pregate-integrity", ...methodologies]);
  const lock = JSON.parse(p.contract()[1]!);
  expect(lock.rules.filter((rule: { id: string }) => rule.id.startsWith("core/"))).toHaveLength(68);
  const accepted = p.contract();
  const invalid = p.plan({ sources: [{ kind: "library", ns: "python" }, { kind: "library", ns: "missing-pack" }], methodologies: ["python/quality"] });
  expect(p.cli(["pack", "apply", invalid, "--preview"]).code).toBe(1);
  expect(p.contract()).toEqual(accepted);
  for (const value of [{ sources: [], methodologies: [], extra: true }, { sources: [{ kind: "builtin", ns: "core" }], methodologies },
    { sources: [], methodologies: ["unknown/methodology"] }, { sources: [{ kind: "library", ns: "python", unexpected: true }], methodologies }]) {
    expect(p.cli(["pack", "apply", p.plan(value), "--preview"]).code).toBe(1);
    expect(p.contract()).toEqual(accepted);
  }
});

test("a custom batch validates fixtures and rejects changed sources after review", () => {
  const p = project("custom");
  const source = join(p.root, "team-pack");
  for (const [path, text] of Object.entries(packTemplate("team"))) {
    mkdirSync(dirname(join(source, path)), { recursive: true });
    writeFileSync(join(source, path), text);
  }
  const file = p.plan({ sources: [{ kind: "path", path: "team-pack" }], methodologies: ["team/team"] });
  const before = p.contract();
  const preview = p.cli(["pack", "apply", file, "--preview"]);
  expect(preview.code).toBe(0);
  const digest = preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
  const manifest = join(source, "methodologies/team.json");
  const data = JSON.parse(readFileSync(manifest, "utf8"));
  data.invariants[0].why += " Changed after review.";
  writeFileSync(manifest, JSON.stringify(data));
  expect(p.cli(["approve", "--yes", "--digest", digest]).code).toBe(1);
  expect(p.contract()).toEqual(before);
  writeFileSync(join(source, "checks/complexity/fn-max-params/fixtures/fail/three/files/src/a.ts"), "export const valid = 1;\n");
  expect(p.cli(["pack", "apply", file, "--preview"]).code).toBe(1);
  expect(p.contract()).toEqual(before);
  // An invalid definition must fail before proposal or any contract write.
  writeFileSync(join(source, "checks/complexity/fn-max-params/check.json"), "{}");
  expect(p.cli(["pack", "apply", file, "--preview"]).code).toBe(1);
  expect(p.contract()).toEqual(before);
});

test("scan is advisory and its selected plan can activate five detected packs together", () => {
  const p = project("scan");
  writeFileSync(join(p.root, "package.json"), JSON.stringify({ dependencies: {
    next: "16.0.0", react: "19.0.0", "drizzle-orm": "1.0.0", "@supabase/supabase-js": "2.0.0",
  } }));
  writeFileSync(join(p.root, "tsconfig.json"), "{}");
  const before = p.contract();
  const inspected = p.cli(["scan", "--json"]);
  expect(inspected.code).toBe(0);
  const result = JSON.parse(inspected.text);
  expect(result.recommendations.map((item: { ns: string }) => item.ns)).toEqual(["drizzle", "nextjs", "react", "supabase", "typescript"]);
  expect(result.limits).toContain("Dependency and folder detection is advisory; no pack is activated.");
  expect(p.contract()).toEqual(before);
  const plan = p.cli(["scan", "--plan"]);
  expect(plan.code).toBe(0);
  const preview = p.cli(["pack", "apply", p.plan(JSON.parse(plan.text)), "--preview"]);
  expect(preview.code).toBe(0);
  expect(p.contract()).toEqual(before);
  const digest = preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
  expect(p.cli(["approve", "--yes", "--digest", digest]).code).toBe(0);
  expect(JSON.parse(p.contract()[0]!).sources).toHaveLength(6);
  expect(p.cli(["scan", "--json", "--plan"]).code).toBe(1);
});

test("scan proposes missing source roots and packs in one review; scope-only changes also require approval", () => {
  const p = project("scope-and-packs");
  const preset = JSON.parse(p.contract()[0]!);
  preset.scope = { include: ["lib/**"], exclude: ["app/generated/**"] };
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset));
  expect(p.cli(["preset", "compile"]).code).toBe(0);
  for (const path of ["lib/orders.ts", "app/page.tsx", "components/order.tsx", "tests/order.test.ts", "app/generated/api.ts", "proxy.ts"]) {
    mkdirSync(dirname(join(p.root, path)), { recursive: true });
    writeFileSync(join(p.root, path), "export const value = 1;\n");
  }
  writeFileSync(join(p.root, "package.json"), '{"dependencies":{"next":"16.0.0","react":"19.0.0"}}');
  const before = p.contract();
  const scan = p.cli(["scan", "--json"]);
  expect(scan.code, scan.text).toBe(0);
  const result = JSON.parse(scan.text);
  expect(result.coverage).toMatchObject({ inventoried: 6, inScope: 1 });
  expect(result.plan.scope).toEqual({ include: ["lib/**", "app/**", "components/**", "proxy.ts", "tests/**"], exclude: ["app/generated/**"] });
  const preview = p.cli(["pack", "apply", p.plan(result.plan), "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(p.contract()).toEqual(before);
  const digest = preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
  expect(p.cli(["approve", "--yes", "--digest", digest]).code).toBe(0);
  expect(JSON.parse(p.contract()[0]!).scope).toEqual(result.plan.scope);
  const coverage = JSON.parse(p.cli(["scan", "--json"]).text).coverage;
  expect(coverage).toMatchObject({ inventoried: 6, sourceLikeInventoried: 6, inScope: 5, outsideScope: [], excluded: ["app/generated/api.ts"], unsupported: [] });
  expect(coverage.roles.find((role: { role: string }) => role.role === "vendor/generated")).toMatchObject({ parserSupported: 1, inScope: 0, excluded: 1, unsupported: 0 });
  expect(coverage.roles.find((role: { role: string }) => role.role === "tests")).toMatchObject({ parserSupported: 1, inScope: 1, excluded: 0, unsupported: 0 });
  const accepted = p.contract();
  const scopeOnly = { sources: [], methodologies: [], scope: { include: ["**"], exclude: ["app/generated/**"] } };
  expect(p.cli(["pack", "apply", p.plan(scopeOnly), "--preview"]).code).toBe(0);
  expect(p.contract()).toEqual(accepted);
  Object.assign(scopeOnly.scope, { unexpected: true });
  expect(p.cli(["pack", "apply", p.plan(scopeOnly), "--preview"]).code).toBe(1);
  expect(p.contract()).toEqual(accepted);
});

test("fresh-machine restore fetches the committed revision and hash, preserves consent and rejects a tampered lock", () => {
  const p = project("restore");
  const remote = join(p.root, "remote");
  for (const [path, text] of Object.entries(packTemplate("team"))) {
    mkdirSync(dirname(join(remote, path)), { recursive: true });
    writeFileSync(join(remote, path), text);
  }
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: remote, stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) throw new Error(result.stderr.toString());
    return result.stdout.toString().trim();
  };
  git("init", "-q"); git("add", "."); git("commit", "-qm", "first");
  const first = git("rev-parse", "HEAD");
  const file = p.plan({ sources: [{ kind: "git", url: remote, ref: first }], methodologies: ["team/team"] });
  expect(p.cli(["pack", "apply", file, "--yes"]).code).toBe(0);
  const before = p.contract();
  writeFileSync(join(remote, "README.md"), "Second revision\n");
  git("add", "."); git("commit", "-qm", "second");
  const fresh = { XDG_DATA_HOME: join(p.root, "fresh-data") };
  expect(p.cli(["pack", "list"], fresh).code).toBe(1);
  const restored = p.cli(["pack", "restore"], fresh);
  expect(restored.code).toBe(0);
  expect(restored.text).toContain("consent unchanged");
  expect(p.contract()).toEqual(before);
  expect(existsSync(join(fresh.XDG_DATA_HOME, "pregate/consent"))).toBe(false);
  expect(p.cli(["pack", "list"], fresh).code).toBe(0);
  expect(JSON.parse(p.contract()[1]!).gitSources[0].ref).toBe(first);
  const tampered = JSON.parse(before[1]!);
  tampered.gitSources[0].hash = "0".repeat(64);
  writeFileSync(join(p.root, ".pregate/pregate.lock.json"), JSON.stringify(tampered));
  const corruptBefore = p.contract();
  expect(p.cli(["pack", "restore"], { XDG_DATA_HOME: join(p.root, "bad-data") }).code).toBe(1);
  expect(p.contract()).toEqual(corruptBefore);
  expect(existsSync(join(p.root, "bad-data/pregate/packs/pins"))).toBe(false);
});

test("readiness packs inventory all supplied rules and enforce a real isolation assertion after reviewed adoption", () => {
  const p = project("readiness");
  for (const file of ["src/documents.cjs", "quality/verify.cjs"]) {
    mkdirSync(dirname(join(p.root, file)), { recursive: true });
    writeFileSync(join(p.root, file), readFileSync(join(import.meta.dir, "../docs/examples/readiness-verification", file + ".fixture")));
  }
  const namespaces = ["enterprise-ready", "consumer-saas", "next-website"];
  expect(p.cli(["pack", "apply", p.plan({ sources: namespaces.map((ns) => ({ kind: "library", ns })), methodologies: namespaces.map((ns) => ns + "/readiness") }), "--yes"]).code).toBe(0);
  const lock = JSON.parse(p.contract()[1]!);
  for (const [ns, count] of [["enterprise-ready", 57], ["consumer-saas", 39], ["next-website", 54]] as const) {
    expect(lock.rules.filter((rule: { id: string }) => rule.id.startsWith(ns + "/"))).toHaveLength(count);
  }
  const initial = p.cli(["audit", "--json", "--strict"]);
  expect(initial.code).toBe(2);
  expect(JSON.parse(initial.text).fitness).toHaveLength(214);
  const fingerprint = p.cli(["fitness", "fingerprint", "quality/verify.cjs"]);
  expect(fingerprint.code).toBe(0);
  const preset = JSON.parse(p.contract()[0]!);
  const binding = { command: [process.execPath, "quality/verify.cjs"], inputs: ["quality/verify.cjs"], verificationHash: fingerprint.text.trim(), timeoutMs: 1000,
    rationale: "Bounded read/write document-service assertion: rejects other tenants and users, absent rows and returned-reference mutation. Does not cover authentication, database queries, sessions, exports or the full product." };
  writeFileSync(join(p.root, "binding.json"), JSON.stringify({ why: binding.rationale, patch: [
    { op: Object.hasOwn(preset, "fitness") ? "replace" : "add", path: "/fitness", value: { "ENTERPRISE-014": binding, "CONSUMER-022": binding } },
    { op: Object.hasOwn(preset, "overrides") ? "replace" : "add", path: "/overrides", value: { ...preset.overrides, "ENTERPRISE-014": { enforcement: "enforce" }, "CONSUMER-022": { enforcement: "enforce" } } },
  ] }));
  expect(p.cli(["preset", "apply", "binding.json", "--yes"]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(1);
  const verified = p.cli(["fitness", "run", "--all"]);
  if (verified.code !== 0) throw new Error(verified.text);
  expect(verified.code).toBe(0);
  const current = p.cli(["audit", "--json", "--strict"]);
  expect(current.code).toBe(2);
  expect(JSON.parse(current.text).fitness.filter((rule: { status: string }) => rule.status === "pass")).toHaveLength(2);
  const source = join(p.root, "src/documents.cjs"), original = readFileSync(source, "utf8");
  writeFileSync(source, original.replace("row.tenant !== tenant || ", ""));
  expect(p.cli(["fitness", "status"]).code).toBe(1);
  expect(p.cli(["fitness", "run", "--all"]).code).toBe(1);
  expect(p.cli(["check", "--all"]).code).toBe(1);
  writeFileSync(source, original);
  expect(p.cli(["fitness", "run", "--all"]).code).toBe(0);
  const verifier = join(p.root, "quality/verify.cjs");
  writeFileSync(verifier, 'require("node:fs").writeFileSync("bypass.txt", "unreviewed verifier");\n');
  expect(p.cli(["fitness", "run", "--all"]).code).toBe(1);
  expect(existsSync(join(p.root, "bypass.txt"))).toBe(false);
});

test.each([
  ["delivery", "DCP-DELIVERY-001", "complete-order", "kernel.event.raiseLocalBlocking", 10],
  ["logging", "DCP-LOGGING-005", "shutdown", "logger.flush?.()", 6],
  ["queue-runtime", "DCP-QUEUE-RUNTIME-001", "accept", "queue.enqueue(item)", 8],
  ["saga-runtime", "DCP-SAGA-RUNTIME-008", "stop-owned-saga", "Promise.allSettled(inFlight)", 8],
  ["utility-runtime", "DCP-UTILITY-RUNTIME-008", "enqueue-priority", "queue.enqueue(priority, item)", 8],
] as const)("dcouplr %s gates enforce an application completion assertion after reviewed binding", (method, requirement, caller, operation, count) => {
  const p = project(`dcouplr-${method}`);
  for (const file of [`src/${caller}.cjs`, "quality/verify.cjs"]) {
    mkdirSync(dirname(join(p.root, file)), { recursive: true });
    writeFileSync(join(p.root, file), readFileSync(join(import.meta.dir, `../docs/examples/dcouplr-${method.endsWith("-runtime") ? method.slice(0, -8) : method}`, file + ".fixture")));
  }
  expect(p.cli(["pack", "apply", p.plan({ sources: [{ kind: "library", ns: "dcouplr" }], methodologies: [`dcouplr/${method}`] }), "--yes"]).code).toBe(0);
  const initial = p.cli(["audit", "--json", "--strict"]);
  expect(initial.code).toBe(2);
  const selected = JSON.parse(initial.text).fitness.filter((r: { requirement: string }) => r.requirement.startsWith(`DCP-${method.toUpperCase()}-`));
  expect(selected).toHaveLength(count);
  expect(selected.every((r: { status: string }) => r.status === "unverified")).toBe(true);
  const fingerprint = p.cli(["fitness", "fingerprint", "quality/verify.cjs"]);
  expect(fingerprint.code).toBe(0);
  const preset = JSON.parse(p.contract()[0]!);
  const binding = { command: [process.execPath, "quality/verify.cjs"], inputs: ["quality/verify.cjs"], verificationHash: fingerprint.text.trim(), timeoutMs: 1000,
    rationale: `One application ${method} completion path waits for its injected boundary and rejects its failure. Deferred completion and missing-await controls cover this caller only, not configured adapters or all application paths.` };
  writeFileSync(join(p.root, "binding.json"), JSON.stringify({ why: binding.rationale, patch: [
    { op: Object.hasOwn(preset, "fitness") ? "replace" : "add", path: "/fitness", value: { [requirement]: binding } },
    { op: Object.hasOwn(preset, "overrides") ? "replace" : "add", path: "/overrides", value: { ...preset.overrides, [requirement]: { enforcement: "enforce" } } },
  ] }));
  expect(p.cli(["preset", "apply", "binding.json", "--yes"]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(1);
  expect(p.cli(["fitness", "run", requirement]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(0);
  const verified = JSON.parse(p.cli(["fitness", "status", "--json"]).text).requirements;
  expect(verified.filter((r: { status: string }) => r.status === "pass")).toHaveLength(1);
  expect(verified.filter((r: { status: string }) => r.status === "unverified")).toHaveLength(64 + count - 1);
  const source = join(p.root, `src/${caller}.cjs`), original = readFileSync(source, "utf8");
  writeFileSync(source, original.replace(`await ${operation}`, operation));
  expect(p.cli(["check", "--all"]).code).toBe(1);
  expect(p.cli(["fitness", "run", requirement]).code).toBe(1);
  expect(p.cli(["check", "--all"]).code).toBe(1);
  writeFileSync(source, original);
  expect(p.cli(["fitness", "run", requirement]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(0);
  if (["queue-runtime", "utility-runtime"].includes(method)) {
    writeFileSync(source, original.replace("if (!accepted) throw new Error('Queue did not admit work');", ""));
    expect(p.cli(["fitness", "run", requirement]).code).toBe(1);
    expect(p.cli(["check", "--all"]).code).toBe(1);
    writeFileSync(source, original);
    expect(p.cli(["fitness", "run", requirement]).code).toBe(0);
    expect(p.cli(["check", "--all"]).code).toBe(0);
  }
  if (method === "saga-runtime") {
    writeFileSync(source, original.replace("Promise.allSettled(inFlight)", "Promise.all(inFlight)"));
    expect(p.cli(["fitness", "run", requirement]).code).toBe(1);
    expect(p.cli(["check", "--all"]).code).toBe(1);
    writeFileSync(source, original);
    expect(p.cli(["fitness", "run", requirement]).code).toBe(0);
    expect(p.cli(["check", "--all"]).code).toBe(0);
  }
});

test("factory input evidence rejects validation and shared-input regressions after reviewed adoption", () => {
  const p = project("dcouplr-factory-runtime"), requirement = "DCP-FACTORY-RUNTIME-003";
  for (const file of ["src/create-invoice.cjs", "quality/verify.cjs"]) {
    mkdirSync(dirname(join(p.root, file)), { recursive: true });
    writeFileSync(join(p.root, file), readFileSync(join(import.meta.dir, "../docs/examples/dcouplr-factory", file + ".fixture")));
  }
  expect(p.cli(["pack", "apply", p.plan({sources:[{kind:"library",ns:"dcouplr"}],methodologies:["dcouplr/factory-runtime"]}), "--yes"]).code).toBe(0);
  const initial = JSON.parse(p.cli(["audit", "--json"]).text).fitness;
  expect(initial.filter((r: {requirement:string}) => r.requirement.startsWith("DCP-FACTORY-RUNTIME-"))).toHaveLength(8);
  expect(initial.every((r: {status:string}) => r.status === "unverified")).toBe(true);
  const fingerprint = p.cli(["fitness", "fingerprint", "quality/verify.cjs"]);
  expect(fingerprint.code).toBe(0);
  const binding = {command:[process.execPath,"quality/verify.cjs"],inputs:["quality/verify.cjs"],verificationHash:fingerprint.text.trim(),timeoutMs:1000,
    rationale:"One application invoice creator rejects invalid and inherited amounts before injected resolution and retains its admitted amount under caller mutation. Not all factories or the configured billing adapter."};
  writeFileSync(join(p.root, "binding.json"), JSON.stringify({why:binding.rationale,patch:[
    {op:"add",path:"/fitness",value:{[requirement]:binding}}, {op:"add",path:"/overrides",value:{[requirement]:{enforcement:"enforce"}}},
  ]}));
  expect(p.cli(["preset", "apply", "binding.json", "--yes"]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(1);
  expect(p.cli(["fitness", "run", requirement]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(0);
  const source = join(p.root, "src/create-invoice.cjs"), original = readFileSync(source, "utf8");
  for (const broken of [original.replace(/  if[^\n]+\n    throw[^\n]+\n/, ""), original.replace("billing.charge(amount)", "billing.charge(input.amount)")]) {
    expect(broken).not.toBe(original); writeFileSync(source, broken);
    expect(p.cli(["check", "--all"]).code).toBe(1);
    expect(p.cli(["fitness", "run", requirement]).code).toBe(1);
    expect(p.cli(["check", "--all"]).code).toBe(1);
    writeFileSync(source, original);
    expect(p.cli(["fitness", "run", requirement]).code).toBe(0);
    expect(p.cli(["check", "--all"]).code).toBe(0);
  }
});

test("inspection export evidence denies removed redaction after reviewed adoption", () => {
  const p = project("dcouplr-observability"), requirement = "DCP-OBSERVABILITY-006";
  for (const file of ["src/export-inspection.cjs", "quality/verify.cjs"]) {
    mkdirSync(dirname(join(p.root, file)), { recursive: true });
    writeFileSync(join(p.root, file), readFileSync(join(import.meta.dir, "../docs/examples/dcouplr-observability", file + ".fixture")));
  }
  expect(p.cli(["pack", "apply", p.plan({sources:[{kind:"library",ns:"dcouplr"}],methodologies:["dcouplr/observability"]}), "--yes"]).code).toBe(0);
  const initial = JSON.parse(p.cli(["audit", "--json"]).text).fitness;
  expect(initial.filter((r: {requirement:string}) => r.requirement.startsWith("DCP-OBSERVABILITY-"))).toHaveLength(8);
  expect(initial.every((r: {status:string}) => r.status === "unverified")).toBe(true);
  const fingerprint = p.cli(["fitness", "fingerprint", "quality/verify.cjs"]);
  expect(fingerprint.code).toBe(0);
  const binding = {command:[process.execPath,"quality/verify.cjs"],inputs:["quality/verify.cjs"],verificationHash:fingerprint.text.trim(),timeoutMs:1000,
    rationale:"One bounded application inspection export excludes raw, activity and detail fields and returns validated fresh numeric values. Not capture storage, server access or other exports."};
  writeFileSync(join(p.root, "binding.json"), JSON.stringify({why:binding.rationale,patch:[
    {op:"add",path:"/fitness",value:{[requirement]:binding}}, {op:"add",path:"/overrides",value:{[requirement]:{enforcement:"enforce"}}},
  ]}));
  expect(p.cli(["preset", "apply", "binding.json", "--yes"]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(1);
  expect(p.cli(["fitness", "run", requirement]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(0);
  const source = join(p.root, "src/export-inspection.cjs"), original = readFileSync(source, "utf8");
  const broken = original.replace("return { sequence, timestamp };", "return { sequence, timestamp, detail: event.detail };");
  expect(broken).not.toBe(original); writeFileSync(source, broken);
  expect(p.cli(["check", "--all"]).code).toBe(1);
  expect(p.cli(["fitness", "run", requirement]).code).toBe(1);
  expect(p.cli(["check", "--all"]).code).toBe(1);
  writeFileSync(source, original);
  expect(p.cli(["fitness", "run", requirement]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(0);
}, 120_000); // Windows adoption runs exceed 30 s.

test("original source invariants can be adopted together and enforce real domain-state and resource-budget assertions", () => {
  const p = project("source-invariants");
  mkdirSync(join(p.root, "src")); mkdirSync(join(p.root, "quality"));
  const domain = 'exports.createOrder = lines => { if (!lines.length || lines.length > 4) throw new Error("invalid order"); return Object.freeze({lines: Object.freeze([...lines])}); };\n// Linear aggregation, bounded to four immutable lines by construction.\nexports.total = order => order.lines.reduce((sum, line) => sum + line, 0);\n';
  const source = join(p.root, "src/order.cjs"), verifier = join(p.root, "quality/verify.cjs");
  writeFileSync(source, domain);
  writeFileSync(verifier, 'const assert = require("node:assert/strict"); const {createOrder,total} = require("../src/order.cjs");\nconst input = [1]; const order = createOrder(input);\ninput.push(2); assert.equal(total(order), 1);\nassert.throws(() => order.lines.push(2), TypeError);\nassert.equal(total(createOrder([1,2,3,4])), 10);\nassert.throws(() => createOrder(process.argv[2] === "state" ? [] : [1,2,3,4,5]), /invalid order/);\n');
  const namespaces = ["maintainability", "pstack"];
  const methodologies = ["maintainability/future-humans", "maintainability/engineering", "pstack/principles", "pstack/operations", "pstack/playbooks", "pstack/workspace"];
  expect(p.cli(["pack", "apply", p.plan({ sources: namespaces.map(ns => ({ kind: "library", ns })), methodologies }), "--yes"]).code).toBe(0);
  const initial = p.cli(["audit", "--json", "--strict"]);
  expect(initial.code).toBe(2);
  const requirements = JSON.parse(initial.stdout).fitness;
  expect(requirements).toHaveLength(350); // 64 core + 286 authored optional clauses; grouped source numbers share one obligation.
  expect(requirements.filter((r: { requirement: string }) => r.requirement === "PS-71-74")).toHaveLength(1);
  expect(requirements.some((r: { requirement: string }) => r.requirement === "PS-72")).toBe(false);
  expect(requirements.every((r: { status: string }) => r.status === "unverified")).toBe(true);
  const fingerprint = p.cli(["fitness", "fingerprint", "quality/verify.cjs"]);
  expect(fingerprint.code).toBe(0);
  const binding = { inputs: ["quality/verify.cjs"], verificationHash: fingerprint.text.trim(), timeoutMs: 1000,
    rationale: "Bounded Order constructor and aggregation assertion: construction rejects empty orders and more than four lines, snapshots and freezes input, and admits a linear total over at most four immutable lines. Checks this sample API only, not every product state or algorithm." };
  const preset = JSON.parse(p.contract()[0]!);
  writeFileSync(join(p.root, "binding.json"), JSON.stringify({ why: binding.rationale, patch: [
    { op: Object.hasOwn(preset, "fitness") ? "replace" : "add", path: "/fitness", value: {
      "FH-88": { ...binding, command: [process.execPath, "quality/verify.cjs", "state"] },
      "SE-92": { ...binding, command: [process.execPath, "quality/verify.cjs", "budget"] },
    } },
    { op: Object.hasOwn(preset, "overrides") ? "replace" : "add", path: "/overrides", value: {
      ...preset.overrides, "FH-88": { enforcement: "enforce" }, "SE-92": { enforcement: "enforce" },
    } },
  ] }));
  expect(p.cli(["preset", "apply", "binding.json", "--yes"]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(1);
  expect(p.cli(["fitness", "run", "--all"]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(0);
  const verified = JSON.parse(p.cli(["audit", "--json"]).text).fitness;
  expect(verified.filter((r: { status: string }) => r.status === "pass")).toHaveLength(2);
  expect(verified.filter((r: { status: string }) => r.status === "unverified")).toHaveLength(348);
  writeFileSync(source, domain.replace("!lines.length || ", ""));
  expect(p.cli(["check", "--all"]).code).toBe(1); // Passing evidence cannot survive a changed domain input.
  expect(p.cli(["fitness", "run", "FH-88"]).code).toBe(1);
  expect(p.cli(["fitness", "run", "SE-92"]).code).toBe(0);
  expect(p.cli(["check", "--all"]).text).toContain("maintainability/FH-88");
  writeFileSync(source, domain);
  expect(p.cli(["fitness", "run", "--all"]).code).toBe(0);
  writeFileSync(source, domain.replace(" || lines.length > 4", ""));
  expect(p.cli(["fitness", "run", "FH-88"]).code).toBe(0);
  expect(p.cli(["fitness", "run", "SE-92"]).code).toBe(1);
  expect(p.cli(["check", "--all"]).text).toContain("maintainability/SE-92");
  writeFileSync(source, domain);
  writeFileSync(source, domain.replace("Object.freeze([...lines])", "lines"));
  expect(p.cli(["fitness", "run", "FH-88"]).code).toBe(1); // Caller mutation cannot change an admitted order.
  expect(p.cli(["check", "--all"]).text).toContain("maintainability/FH-88");
  writeFileSync(source, domain);
  expect(p.cli(["fitness", "run", "--all"]).code).toBe(0);
  expect(p.cli(["check", "--all"]).code).toBe(0);
}, 120_000); // Windows adoption runs exceed 30 s.

test("audit produces a scoped advisory repair plan and reports an oversized input without silently dropping it", () => {
  const p = project("repair-plan"), source = join(p.root, "team-pack");
  for (const [path, text] of Object.entries(packTemplate("team"))) {
    mkdirSync(dirname(join(source, path)), { recursive: true }); writeFileSync(join(source, path), text);
  }
  expect(p.cli(["pack", "apply", p.plan({ sources: [{ kind: "path", path: "team-pack" }], methodologies: ["team/team"] }), "--yes"]).code).toBe(0);
  mkdirSync(join(p.root, "src"));
  writeFileSync(join(p.root, "src/reserve.ts"), "export function reserve(first: number, second: number, third: number) { return first + second + third; }\n");
  const before = p.contract(), output = p.cli(["audit", "--plan", "--json", "--strict"]);
  expect(output.code).toBe(2); // Core evidence remains unverified.
  const report = JSON.parse(output.text), plan = report.refactorPlan;
  const repair = plan.repairs.find((item: { path: string }) => item.path === "src/reserve.ts");
  expect(repair.observedMatches).toBe(1);
  expect(repair.locations[0].symbol).toBe("reserve");
  expect(repair.classification).toBe("clarity-and-complexity");
  expect(repair.missingEvidence).toContain("did not run tests");
  expect(plan.snapshot.contentHash).toBe(report.contentHash);
  expect(plan.unverifiedRequirements).toHaveLength(64);
  expect(p.contract()).toEqual(before);
  const large = join(p.root, "src/large.ts");
  writeFileSync(large, ""); truncateSync(large, 32 * 1024 * 1024 + 1);
  const limited = p.cli(["audit", "--plan", "--json"]);
  expect(limited.code).toBe(2);
  const incomplete = JSON.parse(limited.text);
  expect(incomplete.errors).toContainEqual({ path: "src/large.ts", cause: "audit-input-limit", line: null });
  expect(incomplete.refactorPlan.analysis).toContainEqual(expect.objectContaining({ path: "src/large.ts", cause: "audit-input-limit" }));
  expect(incomplete.findings.some((finding: { path: string }) => finding.path === "src/reserve.ts")).toBe(true);
  expect(p.contract()).toEqual(before);
});

test("an ambient factory finding recommends boundary verification even when its area is factories", () => {
  const p = project("factory-repair-plan");
  expect(p.cli(["pack", "apply", p.plan({ sources: [{ kind: "library", ns: "dcouplr" }], methodologies: ["dcouplr/factories"] }), "--yes"]).code).toBe(0);
  mkdirSync(join(p.root, "src/application"), { recursive: true });
  writeFileSync(join(p.root, "src/application/order.ts"), readFileSync("packs/dcouplr/checks/factories/no-ambient-factory-effects/fixtures/fail/basic/files/src/application/order.ts.fixture", "utf8"));
  const before = p.contract(), output = p.cli(["audit", "--plan", "--json", "--strict"]);
  expect(output.code).toBe(2);
  const report = JSON.parse(output.text);
  const repair = report.refactorPlan.repairs.find((item: { rule: string }) => item.rule === "dcouplr/DCP-FACTORY-EFFECTS-001");
  expect(repair).toBeDefined();
  expect(repair.classification).toBe("boundaries-and-effects");
  expect(repair.suggestedVerification).toContain("including denied and failure cases");
  expect(repair.missingEvidence).toContain("did not run tests");
  expect(report.refactorPlan.unverifiedRequirements).toHaveLength(64);
  expect(p.contract()).toEqual(before);
});
