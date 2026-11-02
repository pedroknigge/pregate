import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compile } from "../src/compile.ts";
import { readTree, canonical } from "../src/disk.ts";
import { dataHome, enable } from "../src/consent.ts";
import { catalogDiscovery } from "../src/catalog-discovery.ts";
import { fitness } from "../src/fitness-command.ts";
import { sessionCommand } from "../src/session-command.ts";
import { LOCK, PRESET, grammars, onSessionStart, onStop, onPreCommand, onPreEdit, VERSIONS } from "../src/gate.ts";
import { beforeText, H, history, key, sessionDir, snapshot } from "../src/state.ts";
import { refactorPlan, refactorPlanText } from "../src/refactor-plan.ts";
import type { Preset, Session } from "../src/types.ts";
import { slash } from "../src/paths.ts";

setDefaultTimeout(120_000);

const area = canonical(mkdtempSync(join(tmpdir(), "pregate-ux0210-")));
const oldEnv = { data: process.env.XDG_DATA_HOME, state: process.env.XDG_STATE_HOME, unattended: process.env.PREGATE_UNATTENDED_APPROVAL };
const originalCwd = process.cwd();
// Reviewed baselines are applied with `--yes`, as an unattended job would.
beforeAll(async () => {
  process.env.XDG_DATA_HOME = join(area, "data"); process.env.XDG_STATE_HOME = join(area, "state"); process.env.PREGATE_UNATTENDED_APPROVAL = "1";
  await grammars();
});
afterAll(() => {
  process.chdir(originalCwd);
  for (const [name, value] of [["XDG_DATA_HOME", oldEnv.data], ["XDG_STATE_HOME", oldEnv.state], ["PREGATE_UNATTENDED_APPROVAL", oldEnv.unattended]] as const) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  rmSync(area, { recursive: true, force: true });
});

function git(root: string, ...args: string[]) {
  const out = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (out.exitCode !== 0) throw new Error(out.stderr.toString());
  return out.stdout.toString().trim();
}

function project(name: string) {
  const root = slash(join(area, name)); mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, ".pregate"));
  const preset: Preset = { name, version: "1.0.0", engine: VERSIONS.engine, sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [], scope: { include: ["src/**"], exclude: [] } };
  const text = JSON.stringify(preset, null, 2) + "\n", compiled = compile(text, () => readTree(join(originalCwd, "catalog"), false), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, PRESET), text); writeFileSync(join(root, LOCK), compiled.text);
  writeFileSync(join(root, "src/main.ts"), "export const main = 1;\n");
  git(root, "init", "-q"); git(root, "config", "user.name", "Fixture"); git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "add", "."); git(root, "commit", "-qm", "initial fixture"); enable(root);
  process.chdir(root);
  const session: Session = { harness: "claude-code", id: name, turnId: "one", agentId: null, interactive: true };
  onSessionStart({ kind: "session-start", session, cwd: root });
  return { root, session, sid: key(session), file: join(root, "src/main.ts"), preset };
}

test("catalog discovery covers unselected packs and distinguishes unknown history from new releases", () => {
  const current = [{ ns: "react", version: "1.1.0", checks: 8, methodologies: ["react/hooks"] }, { ns: "new-library", version: "1.0.0", checks: 30, methodologies: ["new-library/safe"] }];
  const prior = [{ ...current[0]!, version: "1.0.0" }];
  const preset = { methodologies: ["react/hooks"] } as Preset;
  const rec = [{ ns: "react", methodologies: ["react/hooks"] }, { ns: "new-library", methodologies: ["new-library/safe"] }];
  const found = catalogDiscovery(current, prior, preset, rec);
  expect(found.available).toHaveLength(2); expect(found.newPackChecks).toBe(30);
  expect(found.newPacks.map(pack => pack.ns)).toEqual(["new-library"]);
  expect(found.changedPacks.map(pack => pack.ns)).toEqual(["react"]);
  expect(found.suggestedAdditions.map(pack => pack.ns)).toEqual(["new-library"]);
  expect(catalogDiscovery(current, null, preset, rec)).toMatchObject({ comparisonAvailable: false, newPacks: [] });
});

test("a reviewed committed merge rebases Stop without deleting the original baseline or masking future edits", async () => {
  const p = project("merge-review"), original = snapshot(p.sid, p.root)!;
  expect(beforeText(p.sid, original as Exclude<typeof original, string>, "src/main.ts")).toContain("main = 1");
  git(p.root, "checkout", "-qb", "upstream");
  const merged = "// eslint-disable-next-line no-console\nexport const main = 2;\n";
  writeFileSync(p.file, merged); git(p.root, "add", "."); git(p.root, "commit", "-qm", "upstream debt");
  git(p.root, "checkout", "-q", "-"); git(p.root, "merge", "--ff-only", "upstream");
  expect((await onStop({ kind: "stop", session: p.session, cwd: p.root, reentry: false })).verdict).toBe("deny");
  const snapshotFile = join(sessionDir(p.sid), H(p.root), "snapshot.json"), originalBytes = readFileSync(snapshotFile, "utf8");
  const contract = [PRESET, LOCK].map(path => readFileSync(join(p.root, path), "utf8"));
  const preview = await sessionCommand(["rebase", p.sid, "--preview"]);
  expect(preview.code, preview.text).toBe(0); expect(preview.text).toContain("eslint-disable-next-line");
  expect(snapshot(p.sid, p.root)).toEqual(original);
  const digest = /Digest: ([a-f0-9]{64})/.exec(preview.text)![1]!;
  const applied = await sessionCommand(["rebase", p.sid, "--digest", digest, "--yes"]);
  expect(applied.code, applied.text).toBe(0);
  expect(readFileSync(snapshotFile, "utf8")).toBe(originalBytes);
  expect([PRESET, LOCK].map(path => readFileSync(join(p.root, path), "utf8"))).toEqual(contract);
  const effective = snapshot(p.sid, p.root) as Exclude<typeof original, string>;
  expect(effective.head).toBe(git(p.root, "rev-parse", "HEAD"));
  expect(beforeText(p.sid, effective, "src/main.ts")).toBe(merged);
  expect((await onStop({ kind: "stop", session: p.session, cwd: p.root, reentry: false })).verdict).toBe("none");
  writeFileSync(p.file, merged + "// eslint-disable-next-line no-alert\n");
  expect((await onStop({ kind: "stop", session: { ...p.session, turnId: "two" }, cwd: p.root, reentry: false })).verdict).toBe("deny");
  expect(history(p.sid, "-", "stop").some(event => event.violations.length)).toBe(true);
});

test("session review refuses uncommitted changes, stale commits and agent application", async () => {
  const p = project("stale-review");
  writeFileSync(p.file, "export const main = 2;\n");
  expect((await sessionCommand(["rebase", p.sid, "--preview"])).code).toBe(1);
  git(p.root, "add", "."); git(p.root, "commit", "-qm", "reviewed input");
  const preview = await sessionCommand(["rebase", p.sid, "--preview"]), digest = /Digest: ([a-f0-9]{64})/.exec(preview.text)![1]!;
  const inspect = await onPreCommand({ session: p.session, cwd: p.root, tool: "Bash", callId: "preview", command: `pregate session rebase ${p.sid} --preview` });
  expect(inspect.verdict, inspect.full).toBe("none");
  const deny = await onPreCommand({ session: p.session, cwd: p.root, tool: "Bash", callId: "self-approve", command: `pregate session rebase ${p.sid} --digest ${digest} --yes` });
  expect(deny.verdict).toBe("deny");
  writeFileSync(p.file, "export const main = 3;\n"); git(p.root, "add", "."); git(p.root, "commit", "-qm", "changed input");
  expect((await sessionCommand(["rebase", p.sid, "--digest", digest, "--yes"])).code).toBe(1);
  expect(existsSync(join(sessionDir(p.sid), H(p.root), "reviewed-baseline.json"))).toBe(false);
});

test("a baseline review above 8 MiB lists files, binds full content and refuses a changed tree", async () => {
  const p = project("large-review"), big = join(p.root, "src/big.txt"), line = "x".repeat(99) + "\n";
  const base = (snapshot(p.sid, p.root) as { head: string }).head;
  writeFileSync(big, line.repeat(90_000)); writeFileSync(p.file, "export const main = 2;\n");
  git(p.root, "add", "."); git(p.root, "commit", "-qm", "large catch-up");
  const preview = await sessionCommand(["rebase", p.sid, "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(preview.text).toContain("Full diffs exceed the 8 MiB review limit and are summarized: 2 files (1 added, 1 modified, 0 deleted), +90001 -1 lines.");
  expect(preview.text).toContain("A src/big.txt +90000 -0 9000000 bytes"); expect(preview.text).toContain("M src/main.ts +1 -1");
  expect(preview.text).toContain(`diff ${base} ${git(p.root, "rev-parse", "HEAD")} -- .`);
  expect(preview.text.length).toBeLessThan(10_000);
  const digest = /Digest: ([a-f0-9]{64})/.exec(preview.text)![1]!;
  const draft = JSON.parse(readFileSync(join(dataHome(), "session-drafts", digest + ".json"), "utf8")) as { changes: { path: string; after: string }[] };
  expect(draft.changes.find(c => c.path === "src/big.txt")!.after).toBe(new Bun.CryptoHasher("sha256").update(line.repeat(90_000)).digest("hex"));
  writeFileSync(big, line.repeat(89_999) + "y".repeat(99) + "\n");
  expect((await sessionCommand(["rebase", p.sid, "--digest", digest, "--yes"])).code).toBe(1);
  git(p.root, "commit", "-qam", "changed after preview");
  expect((await sessionCommand(["rebase", p.sid, "--digest", digest, "--yes"])).code).toBe(1);
  expect(existsSync(join(sessionDir(p.sid), H(p.root), "reviewed-baseline.json"))).toBe(false);
  const fresh = await sessionCommand(["rebase", p.sid, "--preview"]), again = /Digest: ([a-f0-9]{64})/.exec(fresh.text)![1]!;
  expect(again).not.toBe(digest);
  const applied = await sessionCommand(["rebase", p.sid, "--digest", again, "--yes"]);
  expect(applied.code, applied.text).toBe(0);
  expect(beforeText(p.sid, snapshot(p.sid, p.root) as Exclude<ReturnType<typeof snapshot>, string | null>, "src/big.txt")).toContain("y".repeat(99));
});

test("a baseline review leaves out files that arrived from a base that existed before the session", async () => {
  const p = project("arrived-review");
  git(p.root, "checkout", "-qb", "base"); writeFileSync(join(p.root, "src/base.ts"), "export const fromBase = 1;\n");
  git(p.root, "add", "."); git(p.root, "commit", "-qm", "base work"); git(p.root, "checkout", "-q", "-");
  const session: Session = { ...p.session, id: "arrived-review-2" }, sid = key(session);
  onSessionStart({ kind: "session-start", session, cwd: p.root });
  git(p.root, "merge", "-q", "--no-ff", "-m", "catch up", "base");
  writeFileSync(p.file, "export const main = 2;\n"); git(p.root, "commit", "-qam", "session work");
  const preview = await sessionCommand(["rebase", sid, "--preview"]);
  expect(preview.code, preview.text).toBe(0); expect(preview.text).toContain("+export const main = 2;");
  expect(preview.text).not.toContain("src/base.ts"); expect(preview.text).not.toContain("summarized");
  expect(preview.text).toContain("1 files that arrived from commits that existed at session start are not shown and become part of this baseline");
  const digest = /Digest: ([a-f0-9]{64})/.exec(preview.text)![1]!;
  expect(JSON.parse(readFileSync(join(dataHome(), "session-drafts", digest + ".json"), "utf8")).arrived).toEqual(["src/base.ts"]);
});

test("a large review lists every deletion and test change before the cap and names changes no text shows", async () => {
  const p = project("large-review-order"), guard = join(p.root, "zz/tests/guard.test.ts"), spec = join(p.root, "zz/guard.spec.ts");
  mkdirSync(join(p.root, "zz/tests"), { recursive: true }); writeFileSync(guard, "expect(1).toBe(1);\n"); writeFileSync(spec, "expect(a).toBe(1);\nexpect(b).toBe(2);\n");
  writeFileSync(join(p.root, "src/blob.bin"), new Uint8Array([0x80, 0x41])); writeFileSync(join(p.root, "src/run.sh"), "echo run\n");
  git(p.root, "add", "."); git(p.root, "commit", "-qm", "guards");
  const session: Session = { ...p.session, id: "large-review-order-2" }, sid = key(session);
  onSessionStart({ kind: "session-start", session, cwd: p.root });
  for (let i = 0; i < 250; i++) writeFileSync(join(p.root, `src/f${String(i).padStart(3, "0")}.ts`), `export const f${i} = ${i};\n`);
  writeFileSync(join(p.root, "src/big.txt"), ("x".repeat(99) + "\n").repeat(90_000)); rmSync(guard); writeFileSync(spec, "expect(a).toBe(1);\n");
  writeFileSync(join(p.root, "src/blob.bin"), new Uint8Array([0x81, 0x41])); chmodSync(join(p.root, "src/run.sh"), 0o755); git(p.root, "add", ".");
  // Git for Windows sets core.fileMode=false, so it records the executable bit only when told to.
  git(p.root, "update-index", "--chmod=+x", "src/run.sh");
  git(p.root, "commit", "-qm", "large catch-up hiding a weakened test");
  const preview = await sessionCommand(["rebase", sid, "--preview"]), lines = preview.text.split("\n");
  expect(preview.code, preview.text).toBe(0);
  const flagged = lines.indexOf("Deleted files and test changes (2, all listed):"), other = lines.indexOf("Other changes:");
  expect(flagged).toBeGreaterThan(0); expect(lines.slice(flagged + 1, other)).toEqual(["D zz/tests/guard.test.ts +0 -1 19 bytes", "M zz/guard.spec.ts +0 -1 19 bytes"]);
  expect(preview.text).toContain("...and 51 more files, listed in the draft.");
  expect(preview.text).toContain("Changed with no text difference (file mode, symlink or binary bytes): src/blob.bin, src/run.sh.");
});

test("a baseline review refuses content past 128 MiB before reading it", async () => {
  const p = project("huge-review");
  writeFileSync(join(p.root, "src/huge.txt"), "x".repeat(129 * 1024 * 1024)); git(p.root, "add", "."); git(p.root, "commit", "-qm", "huge");
  const preview = await sessionCommand(["rebase", p.sid, "--preview"]);
  expect(preview.code).toBe(1); expect(preview.text).toContain("Baseline content exceeds 128 MiB");
  expect(existsSync(join(sessionDir(p.sid), H(p.root), "head", H("src/huge.txt") + ".json"))).toBe(false);
});

test("unchanged Stop breaches cap across new turns, stay recorded and restart blocking on a changed tree", async () => {
  const p = project("cross-turn-stop");
  writeFileSync(p.file, "// eslint-disable-next-line no-console\nexport const main = 2;\n");
  const stop = (turnId: string) => onStop({ kind: "stop", session: { ...p.session, turnId }, cwd: p.root, reentry: false });
  expect((await stop("one")).verdict).toBe("deny"); expect((await stop("two")).verdict).toBe("deny");
  expect((await stop("three")).stopIncomplete).toEqual({ reason: "limit", cause: null });
  const repeated = await stop("four"); expect(repeated.notice).toContain("unchanged Stop findings"); expect(repeated.notice!.split("\n")).toHaveLength(1);
  expect(history(p.sid, "-", "stop").at(-1)!.violations).toHaveLength(1);
  const pre = await onPreEdit([{ session: p.session, callId: "still-protected", tool: "Write", path: p.file, from: null, edit: { form: "full", content: readFileSync(p.file, "utf8") + "// eslint-disable-next-line no-alert\n" } }]);
  expect(pre.verdict).toBe("deny");
  writeFileSync(p.file, readFileSync(p.file, "utf8").replace("main = 2", "main = 3"));
  expect((await stop("five")).verdict).toBe("deny");
});

test("Stop judges this turn's roots, then cwd, then the rest within its budget and names the unjudged ones", async () => {
  const [a, b, c] = ["budget-a", "budget-b", "budget-c"].map(project) as [ReturnType<typeof project>, ReturnType<typeof project>, ReturnType<typeof project>];
  const session: Session = { ...a.session, turnId: "budget" }, sid = key(session);
  for (const p of [b, c]) onSessionStart({ kind: "session-start", session, cwd: p.root });
  const stop = (cwd: string, budget?: number) => onStop({ kind: "stop", session, cwd, reentry: false }, budget);
  const clean = await stop(b.root, 0);
  expect(clean.verdict).toBe("none"); expect(clean.stopIncomplete).toEqual({ reason: "budget", cause: null });
  expect(clean.notice).toContain(`2 roots not judged this Stop: ${a.root}, ${c.root}; pre-commit and CI still judge them, and the next Stop starts with them; to judge one now, run pregate check --all in it`);
  expect(history(sid, "-", "stop").at(-1)).toMatchObject({ root: b.root, stopIncomplete: { reason: "budget", cause: null }, stopSkipped: [a.root, c.root] });
  expect((await stop(b.root)).stopIncomplete).toBeUndefined();
  const breach = "// eslint-disable-next-line no-console\nexport const main = 2;\n";
  expect((await onPreEdit([{ session, callId: "turn-edit", tool: "Write", path: c.file, from: null, edit: { form: "full", content: breach } }])).verdict).toBe("deny");
  for (const p of [a, c]) writeFileSync(p.file, breach);
  for (const budget of [undefined, 0]) {
    const blocked = await stop(a.root, budget);
    expect(blocked.verdict).toBe("deny"); expect(blocked.stopIncomplete).toBeUndefined();
    expect(history(sid, "-", "stop").at(-1)!.root).toBe(c.root);
    // A blocked Stop past its budget does not spend the supervisor's margin hashing the tree.
    expect(history(sid, "-", "stop").at(-1)!.stopFingerprint === undefined).toBe(budget === 0);
  }
});

test("a budget-bound Stop judges the roots the previous Stop left unjudged before the rest", async () => {
  const [x, y, z] = ["rotate-x", "rotate-y", "rotate-z"].map(project) as [ReturnType<typeof project>, ReturnType<typeof project>, ReturnType<typeof project>];
  const sid = key(x.session);
  for (const p of [y, z]) onSessionStart({ kind: "session-start", session: x.session, cwd: p.root });
  writeFileSync(z.file, "// eslint-disable-next-line no-console\nexport const main = 2;\n");
  const judged: string[] = [];
  for (const turnId of ["r1", "r2", "r3"]) {
    const d = await onStop({ kind: "stop", session: { ...x.session, turnId }, cwd: area, reentry: false }, 0);
    judged.push(history(sid, "-", "stop").at(-1)!.root!);
    if (d.verdict === "deny") break;
  }
  expect(new Set(judged).size).toBe(judged.length);
  expect(judged.at(-1)).toBe(z.root);
});

test("grouped evidence binding stays a proposal, validates all IDs and never executes the verifier", async () => {
  const p = project("batch-fitness");
  writeFileSync(join(p.root, "verify.ts"), 'throw new Error("must not execute");\n');
  const plan = await fitness(["plan", "--json"]); expect(plan.code, plan.text).toBe(0);
  expect(JSON.parse(plan.text).groups.flatMap((group: { requirements: unknown[] }) => group.requirements)).toHaveLength(64);
  const before = [PRESET, LOCK].map(path => readFileSync(join(p.root, path), "utf8"));
  const args = ["bind", "CORE-INV-001,CORE-INV-002", "--command-json", '["bun","verify.ts"]', "--inputs", "verify.ts,src/**", "--rationale", "Boundary assertion covers both declared conditions with invalid controls", "--preview"];
  const bound = await fitness(args); expect(bound.code, bound.text).toBe(0); expect(bound.text.match(/Digest:/g)).toHaveLength(1);
  expect([PRESET, LOCK].map(path => readFileSync(join(p.root, path), "utf8"))).toEqual(before);
  expect((await fitness(args.map(arg => arg === "CORE-INV-001,CORE-INV-002" ? "CORE-INV-001,unknown" : arg))).code).toBe(1);
  expect((await fitness(args.map(arg => arg === "CORE-INV-001,CORE-INV-002" ? "CORE-INV-001,CORE-INV-001" : arg))).code).toBe(1);
});

test("repair plans preserve benchmark, negative-fixture and declaration intent before applying generic advice", () => {
  const findings = ["bench/latency.ts", "fixtures/fail/intentional.ts", "types/public.d.ts"].map(path => ({ path, rule: "javascript/JS-AWAIT-001", check: "javascript/safety/no-await-in-loop@1.1.0", severity: "deny" as const, enforcement: "enforce" as const, line: 1, symbol: "run", fix: "Use concurrent calls.", measured: null, limit: null, atSessionStart: null, why: "Policy", avoid: "", message: "Finding" }));
  const plan = refactorPlan({ root: "fixture", lockHash: "a", contentHash: "b", changedDuringAudit: false, findings, errors: [], unsupported: [], uncovered: [], fitness: [] });
  expect(plan.repairs.every(repair => repair.proposedChange.startsWith("First review"))).toBe(true);
  expect(plan.repairs.map(repair => repair.fileRole)).toEqual(expect.arrayContaining([expect.stringContaining("benchmark"), expect.stringContaining("fixture or example"), expect.stringContaining("type declaration")]));
});

test("repair plans list production source before tests even when the test finding is more severe", () => {
  const findings = [
    { path: "test/a.test.ts", severity: "deny" as const },
    { path: "src/a.ts", severity: "warn" as const },
  ].map(item => ({ ...item, rule: "clean-code/CC-FN-001", check: "clean-code/complexity/fn-max-lines@1.0.0", enforcement: "enforce" as const, line: 1, symbol: "run", fix: "Split it.", measured: null, limit: null, atSessionStart: null, why: "Policy", avoid: "", message: "Finding" }));
  const plan = refactorPlan({ root: "fixture", lockHash: "a", contentHash: "b", changedDuringAudit: false, findings, errors: [], unsupported: [], uncovered: [], fitness: [] });
  expect(plan.repairs.map(repair => repair.path)).toEqual(["src/a.ts", "test/a.test.ts"]);
  expect(plan.order).toContain("Production source first");
  expect(refactorPlanText(plan)).toContain("Repairs: 1 in production source; 1 in tests, fixtures or generated code (listed after).");
});

test("repair plans name generator ownership and inspect fallback policy without asserting a semantic defect", () => {
  const findings = [
    { path: "scripts/generate-client.ts", check: "typescript/types/no-any@1.0.0" },
    { path: "src/request.ts", check: "clean-code/errors/no-empty-catch@1.0.0" },
  ].map(item => ({ ...item, rule: "local/POLICY", severity: "deny" as const, enforcement: "shadow" as const, line: 1, symbol: "run", fix: "Review the selected policy.", measured: null, limit: null, atSessionStart: null, why: "Policy", avoid: "", message: "Finding" }));
  const plan = refactorPlan({ root: "fixture", lockHash: "a", contentHash: "b", changedDuringAudit: false, findings, errors: [], unsupported: [], uncovered: [], fitness: [] });
  expect(plan.repairs.find(repair => repair.path.startsWith("scripts/"))!.proposedChange).toContain("generator or template");
  expect(plan.repairs.find(repair => repair.path.startsWith("src/"))!.proposedChange).toContain("fallback outside its body");
  expect(plan.repairs.every(repair => repair.enforcement === "shadow")).toBe(true);
});
