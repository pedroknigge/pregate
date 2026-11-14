import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { approveBatch, approvePending, applyPreset } from "../src/approval-command.ts";
import { packTemplate } from "../src/pack-template.ts";
import { compile } from "../src/compile.ts";
import { dataHome, enable, enabled } from "../src/consent.ts";
import { proposeBatch, readBatch, readProposal } from "../src/proposal.ts";
import { sha256 } from "../src/state.ts";
import { inert } from "../src/admission.ts";
import { canonical } from "../src/disk.ts";
import { grammars, LOCK, onPreCommand, PRESET, redirect, sourcesOf, VERSIONS } from "../src/gate.ts";
import { batchReview, engineNote, pendingReview } from "../src/pending-review.ts";
import type { Session } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

// `-c` and an explicit env: Bun does not pass process.env mutations to a spawn that omits env,
// and an isolated CI home has no user.name. Repo config below is what the product's own commit reads.
const git = (root: string, ...args: string[]) => Bun.spawnSync(
  ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
  { cwd: root, stdout: "pipe", stderr: "pipe", env: process.env },
).stdout.toString().trim();

const ENV_NAMES = ["XDG_DATA_HOME", "XDG_STATE_HOME", "CI", "PREGATE_UNATTENDED_APPROVAL", "GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL"] as const;

async function project(run: (root: string) => Promise<void>): Promise<void> {
  const cwd = process.cwd(), area = canonical(mkdtempSync(join(tmpdir(), "pregate-approve-")));
  const saved = ENV_NAMES.map((n) => process.env[n]);
  Object.assign(process.env, { XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" });
  const root = canonical(join(area, "repo"));
  await grammars();
  await committedProject(cwd, area, root, saved, run);
}

async function committedProject(cwd: string, area: string, root: string, saved: (string | undefined)[], run: (root: string) => Promise<void>): Promise<void> {
  try {
    contractRepo(cwd, area, root);
    process.chdir(root);
    await run(root);
  } finally {
    process.chdir(cwd); ENV_NAMES.forEach((n, i) => saved[i] === undefined ? delete process.env[n] : process.env[n] = saved[i]);
    removeTree(area);
  }
}

// A committed, enabled project with the legacy-safe contract.
function contractRepo(cwd: string, area: string, root: string): void {
  mkdirSync(join(root, ".pregate/requests"), { recursive: true });
  git(area, "init", "-q", root);
  git(root, "config", "user.name", "t");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "commit.gpgsign", "false");
  const preset = readFileSync(join(cwd, "catalog/presets/legacy-safe.json"), "utf8");
  writeFileSync(join(root, PRESET), preset);
  const compiled = compile(preset, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, LOCK), compiled.text);
  writeFileSync(join(root, "work.ts"), "export const work = 1;\n");
  git(root, "add", "-A"); git(root, "commit", "-qm", "base");
  enable(root);
}

const request = (value: string, test = VERSIONS.engine) => JSON.stringify({ why: "test", patch: [
  { op: "test", path: "/engine", value: test }, { op: "replace", path: "/enforcement", value },
] });

test("approve <code> applies the reviewed request, commits only the contract and removes settled requests", () => project(async (root) => {
  const file = join(root, ".pregate/requests/shadow.json"), stale = join(root, ".pregate/requests/old.json");
  writeFileSync(file, request("shadow"));
  writeFileSync(stale, request("shadow", "0.0.0"));
  writeFileSync(join(root, "work.ts"), "export const work = 2;\n");
  const text = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  text.enforcement = "shadow";
  const prepared = await applyPreset(root, JSON.stringify(text, null, 2) + "\n", { preview: true, request: file });
  expect(prepared.text).toContain("Pending human review");
  const digest = /^Digest: ([0-9a-f]{64})$/m.exec(pendingReview(root).text)![1]!;
  expect(pendingReview(root).text).toContain(`pregate approve ${digest.slice(0, 12)}`);
  expect((await approvePending(root, true, digest.slice(0, 11))).code).toBe(1);
  expect((await approvePending(root, true, "0".repeat(12))).code).toBe(1);
  const done = await approvePending(root, true, digest.slice(0, 12));
  expect(done.code).toBe(0);
  expect(done.text).toContain("Removed request .pregate/requests/shadow.json");
  expect(done.text).toContain("Removed request .pregate/requests/old.json");
  expect(done.text).toMatch(/Committed 2 files \(\.pregate\/\) as [0-9a-f]+\./);
  expect(existsSync(file) || existsSync(stale)).toBe(false);
  expect(git(root, "log", "-1", "--format=%s")).toBe(`chore: apply reviewed PREGATE contract ${digest.slice(0, 12)}`);
  expect(git(root, "show", "--name-only", "--format=", "HEAD").split("\n").sort()).toEqual([PRESET, LOCK].sort());
  expect(git(root, "status", "--porcelain")).toBe("M work.ts");
}));

test("approve --no-commit applies without committing; a repository that cannot commit gets the finishing command", () => project(async (root) => {
  const next = (value: string) => {
    const text = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
    text.enforcement = value;
    return JSON.stringify(text, null, 2) + "\n";
  };
  await applyPreset(root, next("shadow"), { preview: true });
  const kept = await approvePending(root, true, undefined, false);
  expect(kept.text).not.toContain("ommit");
  expect(git(root, "status", "--porcelain").split("\n").map((line) => line.trim()).sort()).toEqual([`M ${PRESET}`, `M ${LOCK}`].sort());
  writeFileSync(join(root, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  await applyPreset(root, next("enforce"), { preview: true });
  const refused = await approvePending(root, true);
  expect(refused.code).toBe(0);
  expect(refused.text).toContain(`Applied but not committed. Commit it with: git add -A -- ${PRESET} ${LOCK}`);
  expect(refused.text).not.toContain("--no-verify");
}));

test("a refusing pre-commit hook is shown with the command that commits once the hook succeeds", () => project(async (root) => {
  const head = git(root, "rev-parse", "HEAD");
  mkdirSync(join(root, ".githooks"));
  const hook = ["#!/bin/sh", ...Array.from({ length: 12 }, (_, i) => `echo hook-${String(i + 1).padStart(2, "0")} >&2`), 'echo "pnpm install" >&2', "exit 1", ""];
  writeFileSync(join(root, ".githooks/pre-commit"), hook.join("\n"), { mode: 0o755 });
  git(root, "config", "core.hooksPath", ".githooks");
  expect(git(root, "config", "--get", "core.hooksPath")).toBe(".githooks");
  const text = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  text.enforcement = "shadow";
  await applyPreset(root, JSON.stringify(text, null, 2) + "\n", { preview: true });
  const refused = await approvePending(root, true);
  expect(refused.code, refused.text).toBe(0);
  expect(refused.text).toContain("Applied but not committed.");
  expect(refused.text).toContain(`Commit it with: git add -A -- ${PRESET} ${LOCK} && git commit -m "chore: apply reviewed PREGATE contract`);
  expect(refused.text).toMatch(new RegExp(`git commit -m "chore: apply reviewed PREGATE contract [0-9a-f]{12}" -- ${PRESET.replaceAll(".", "\\.")} ${LOCK.replaceAll(".", "\\.")}`));
  expect(refused.text).not.toContain("--no-verify");
  expect(refused.text).toContain("earlier lines omitted");
  expect(refused.text).toContain("pnpm install");
  expect(refused.text).toContain("hook-12");
  expect(refused.text).not.toContain("hook-01");
  expect(refused.text).not.toContain("hook-02");
  expect(refused.text).not.toContain("hook-03");
  expect(git(root, "rev-parse", "HEAD")).toBe(head);
  expect(git(root, "diff", "--cached", "--name-only").split("\n").filter(Boolean).sort()).toEqual([PRESET, LOCK].sort());
  expect(git(root, "show", `HEAD:${PRESET}`)).toContain('"enforcement": "enforce"');
  expect(readFileSync(join(root, PRESET), "utf8")).toContain('"enforcement": "shadow"');
}));

test("an approval during an unfinished merge stages the contract and says to conclude the merge", () => project(async (root) => {
  git(root, "checkout", "-qb", "side");
  writeFileSync(join(root, "work.ts"), "export const work = 2;\n");
  git(root, "commit", "-qam", "side");
  git(root, "checkout", "-q", "-");
  writeFileSync(join(root, "work.ts"), "export const work = 3;\n");
  git(root, "commit", "-qam", "main");
  git(root, "merge", "side");
  git(root, "checkout", "--theirs", "--", "work.ts");
  git(root, "add", "work.ts");
  const text = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  text.enforcement = "shadow";
  await applyPreset(root, JSON.stringify(text, null, 2) + "\n", { preview: true });
  const done = await approvePending(root, true);
  expect(done.code).toBe(0);
  expect(done.text).toContain("Conclude it with `git commit`");
  expect(done.text).not.toContain("Commit it with: git add");
  expect(git(root, "diff", "--cached", "--name-only").split("\n").sort()).toEqual([PRESET, LOCK, "work.ts"].sort());
  git(root, "commit", "-qm", "merge side");
  expect(git(root, "status", "--porcelain")).toBe("");
}));

test("the short approval form is denied to every agent and names the human ! route in Claude Code", () => project(async (root) => {
  const text = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  text.enforcement = "shadow";
  await applyPreset(root, JSON.stringify(text, null, 2) + "\n", { preview: true });
  const code = /^Digest: ([0-9a-f]{12})/m.exec(pendingReview(root).text)![1]!;
  const session: Session = { harness: "claude-code", id: "approve-short", turnId: "one", agentId: null, interactive: true };
  const call = { session, tool: "Bash", callId: "approve", cwd: root, command: `pregate approve ${code}` };
  delete process.env.CI; delete process.env.PREGATE_UNATTENDED_APPROVAL;
  const routed = onPreCommand(call);
  expect(routed.verdict).toBe("deny");
  expect(routed.full).toContain(`run pregate approve ${code} in a separate terminal`);
  expect(routed.full).not.toContain(`! pregate approve ${code}`);
  expect(onPreCommand({ ...call, session: { ...session, agentId: "sub" } }).verdict).toBe("deny");
  expect(onPreCommand({ ...call, session: { ...session, harness: "codex", interactive: false } }).verdict).toBe("deny");
  expect(onPreCommand({ ...call, command: `pregate approve ${code.slice(0, 8)}` }).verdict).toBe("deny");
}));

const withTeamPack = (root: string) => {
  for (const [rel, text] of Object.entries(packTemplate("team"))) {
    mkdirSync(dirname(join(root, "rules/team", rel)), { recursive: true });
    writeFileSync(join(root, "rules/team", rel), text);
  }
  const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  preset.sources.push({ ns: "team", kind: "path", path: "rules/team" });
  return JSON.stringify(preset, null, 2) + "\n";
};

test("approval commits the rule pack folder the lock compiles from, so teammates never get a stale lock", () => project(async (root) => {
  await applyPreset(root, withTeamPack(root), { preview: true });
  const done = await approvePending(root, true);
  expect(done.code, done.text).toBe(0);
  const committed = git(root, "show", "--name-only", "--format=", "HEAD").split("\n");
  expect(committed).toContain(PRESET);
  expect(committed).toContain(LOCK);
  expect(committed.filter((rel) => rel.startsWith("rules/team/")).sort()).toEqual(Object.keys(packTemplate("team")).map((rel) => `rules/team/${rel}`).sort());
  expect(done.text).toMatch(new RegExp(`Committed ${committed.length} files \\(\\.pregate/, rules/team/\\) as [0-9a-f]+\\.`));
  expect(git(root, "status", "--porcelain", "--", "rules/team")).toBe("");
  expect(git(root, "status", "--porcelain")).toBe("");
}));

test("a nested project's approval summary groups by its own folders, and an ignored non-JSON file is not reported", () => project(async (top) => {
  const root = join(top, "services/api");
  mkdirSync(join(root, ".pregate"), { recursive: true });
  for (const file of [PRESET, LOCK]) writeFileSync(join(root, file), readFileSync(join(top, file)));
  writeFileSync(join(top, ".git/info/exclude"), ".DS_Store\n");
  git(top, "add", "-A"); git(top, "commit", "-qm", "nested");
  enable(root); process.chdir(root);
  const text = withTeamPack(root);
  writeFileSync(join(root, "rules/team/.DS_Store"), "finder");
  await applyPreset(root, text, { preview: true });
  const done = await approvePending(root, true);
  expect(done.code, done.text).toBe(0);
  expect(done.text).toMatch(/Committed \d+ files \(\.pregate\/, rules\/team\/\) as [0-9a-f]+\./);
  expect(done.text).not.toContain("not committed");
}));

test("an ignored rule pack folder is named instead of silently left out of the approval commit", () => project(async (root) => {
  writeFileSync(join(root, ".gitignore"), "rules/\n");
  git(root, "add", ".gitignore"); git(root, "commit", "-qm", "ignore rules");
  await applyPreset(root, withTeamPack(root), { preview: true });
  const done = await approvePending(root, true);
  expect(done.code, done.text).toBe(0);
  expect(done.text).toMatch(/Committed 2 files \(\.pregate\/\) as [0-9a-f]+\./);
  expect(done.text).toContain("Some files in rules/team are not committed (ignored?); teammates get a stale lock until they are.");
}));

test("an identical agent preview keeps the pending code instead of replacing it", () => project(async (root) => {
  const text = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  text.enforcement = "shadow";
  const first = await applyPreset(root, JSON.stringify(text, null, 2) + "\n", { preview: true, stable: true });
  const second = await applyPreset(root, JSON.stringify(text, null, 2) + "\n", { preview: true, stable: true });
  const digest = (review: string) => /^Digest: ([0-9a-f]{64})$/m.exec(review)![1];
  expect(digest(second.text)).toBe(digest(first.text)!);
  expect(second.text).not.toContain("replaces the earlier pending proposal");
  expect((await approvePending(root, true, digest(first.text)!.slice(0, 12))).code).toBe(0);
}));

// Dogfood: an engine bundling another pack version said "stale or invalid" and discarded the review.
test("a review another engine prepared is explained and kept; a provably stale one is discarded", () => project(async (root) => {
  const text = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  text.enforcement = "shadow";
  await applyPreset(root, JSON.stringify(text, null, 2) + "\n", { preview: true });
  const dir = join(dataHome(), "proposals"), file = join(dir, fs.readdirSync(dir)[0]!);
  const proposal = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, JSON.stringify({ ...proposal, lockText: `${proposal.lockText} `, engine: { ...proposal.engine, version: "9.9.9", source: false } }));
  const refused = await approvePending(root, true);
  expect(refused.code).toBe(1);
  expect(refused.text).toContain("prepared by engine 9.9.9");
  expect(refused.text).toContain("The pending review is kept; nothing applied.");
  expect(readProposal(root)).not.toBeNull();
  writeFileSync(join(root, PRESET), JSON.stringify({ ...JSON.parse(readFileSync(join(root, PRESET), "utf8")), enforcement: "ask" }, null, 2) + "\n");
  expect((await approvePending(root, true)).text).toContain("Pending contract is stale");
  expect(readProposal(root)).toBeNull();
}));

test("the approval footer names the engine that prepared a review when the installed launcher differs", () => {
  const base = { root: "", lockText: "", at: 0, baseline: "", writes: [] };
  const proposal = { ...base, engine: { version: "0.2.26", packs: {}, source: true } };
  expect(engineNote(proposal, "0.2.25")).toEqual(["Prepared by engine 0.2.26 (run from source); the installed engine is 0.2.25: approve with the same engine or update first."]);
  expect(engineNote({ ...base, engine: { version: "0.2.25", packs: {}, source: false } }, "0.2.25")).toEqual([]);
  expect(engineNote(proposal, null)).toEqual([]);
});

test("a newer proposal replaces the pending one, names the replaced code, and the old code approves nothing", () => project(async (root) => {
  const next = (value: string) => {
    const text = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
    text.enforcement = value;
    return JSON.stringify(text, null, 2) + "\n";
  };
  await applyPreset(root, next("shadow"), { preview: true });
  const first = /^Digest: ([0-9a-f]{12})/m.exec(pendingReview(root).text)![1]!;
  const second = await applyPreset(root, next("shadow") + "\n", { preview: true });
  expect(second.text).toContain(`This review replaces the earlier pending proposal ${first}; that code no longer approves anything.`);
  expect((await approvePending(root, true, first)).code).toBe(1);
  expect(readFileSync(join(root, PRESET), "utf8")).toBe(next("enforce"));
}));

// Two committed projects, each with a pending shadow-mode review, and one batch over both.
async function batchOf(a: string): Promise<{ b: string; elsewhere: string; code: string; shadow: (root: string) => string; prepare: (root: string) => Promise<string> }> {
  const area = dirname(a), b = canonical(join(area, "repo-b")), elsewhere = join(area, "elsewhere");
  contractRepo(join(import.meta.dir, ".."), area, b);
  mkdirSync(elsewhere);
  const shadow = (root: string) => JSON.stringify({ ...JSON.parse(git(root, "show", `HEAD:${PRESET}`)), enforcement: "shadow" }, null, 2) + "\n";
  const prepare = async (root: string) => {
    await applyPreset(root, shadow(root), { preview: true });
    return sha256(JSON.stringify(readProposal(root)));
  };
  const items = [{ root: a, digest: await prepare(a) }, { root: b, digest: await prepare(b) }];
  return { b, elsewhere, code: proposeBatch(items).slice(0, 12), shadow, prepare };
}

test("one batch code reviews every project, is routed to the human from any directory, and applies them all", () => project(async (a) => {
  const { b, elsewhere, code, shadow } = await batchOf(a);
  expect(await approveBatch("0".repeat(12), true, true)).toBeNull();
  const session: Session = { harness: "claude-code", id: "approve-batch", turnId: "one", agentId: null, interactive: true };
  const call = { session, tool: "Bash", callId: "approve", cwd: elsewhere, command: `pregate approve ${code}` };
  delete process.env.CI; delete process.env.PREGATE_UNATTENDED_APPROVAL;
  expect(inert({ kind: "pre-command", command: call })).toBe(false);
  const review = batchReview(readBatch()!, true, false).text;
  expect(review).toContain(`Project: ${a}`);
  expect(review).toContain(`Project: ${b}`);
  expect(review.split("\n").filter((line) => line === "WARNING: this may weaken protection.")).toHaveLength(2);
  expect(review.split("\n").filter((line) => line.includes("(was enforce)")).length).toBeGreaterThanOrEqual(2);
  for (const cwd of [elsewhere, a]) {
    const routed = onPreCommand({ ...call, cwd });
    expect(routed.verdict, routed.full).toBe("deny");
    expect(routed.full).toContain(`run pregate approve ${code} in a separate terminal`);
  expect(routed.full).not.toContain(`! pregate approve ${code}`);
  }
  expect(onPreCommand({ ...call, session: { ...session, harness: "codex", interactive: false } }).verdict).toBe("deny");
  process.env.CI = "1"; process.env.PREGATE_UNATTENDED_APPROVAL = "1";
  process.chdir(elsewhere);
  const done = (await approveBatch(code, true, true))!;
  expect(done.code, done.text).toBe(0);
  expect(done.text).toContain("2/2 project contracts updated.");
  for (const root of [a, b]) {
    expect(readFileSync(join(root, PRESET), "utf8")).toContain('"enforcement": "shadow"');
    expect(git(root, "log", "-1", "--format=%s")).toStartWith("chore: apply reviewed PREGATE contract ");
    expect(enabled(root)).toBe(true);
  }
  expect(readBatch()).toBeNull();
  expect(await approveBatch(code, true, true)).toBeNull();
}));

test("a batch applies nothing when one project changed after the preview, was re-previewed, or the batch expired", () => project(async (a) => {
  const { b, code, prepare } = await batchOf(a);
  const before = [a, b].map((root) => readFileSync(join(root, PRESET), "utf8"));
  writeFileSync(join(b, PRESET), before[1]!.replace("\n", "\n "));
  const changed = (await approveBatch(code, true, true))!;
  expect(changed.code).toBe(1);
  expect(changed.text).toContain(`${b}: its contract or proposed files changed since the preview.`);
  expect(changed.text).toContain("nothing applied");
  expect(readFileSync(join(a, PRESET), "utf8")).toBe(before[0]!);
  writeFileSync(join(b, PRESET), before[1]!);
  await prepare(b);
  const replaced = (await approveBatch(code, true, true))!;
  expect(replaced.text).toContain(`${b}: its review was replaced after the batch preview.`);
  expect([a, b].map((root) => readFileSync(join(root, PRESET), "utf8"))).toEqual(before);
  const file = join(dataHome(), "proposals", "batch.json");
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), at: 0 }));
  expect(await approveBatch(code, true, true)).toBeNull();
  expect(existsSync(file)).toBe(false);
}));

test("a project approved with its own code makes the batch name it; the other project's code still works", () => project(async (a) => {
  const { b, code } = await batchOf(a);
  const own = (root: string) => sha256(JSON.stringify(readProposal(root))).slice(0, 12);
  const codeB = own(b);
  expect((await approvePending(a, true, own(a))).code).toBe(0);
  const retired = (await approveBatch(code, true, true))!;
  expect(retired.code).toBe(1);
  expect(retired.text).toContain(`${a}: its review expired or was approved on its own.`);
  expect(retired.text).toContain("nothing applied");
  expect((await approvePending(b, true, codeB)).code).toBe(0);
}));

test("a pending batch guards every command, so a spliced pregate approve from any directory is held", () => project(async (a) => {
  const { elsewhere, code } = await batchOf(a);
  const session: Session = { harness: "claude-code", id: "spliced", turnId: "one", agentId: null, interactive: true };
  delete process.env.CI; delete process.env.PREGATE_UNATTENDED_APPROVAL;
  for (const command of [`pre''gate approve ${code}`, `"pre"gate approve ${code}`, `p\\regate approve ${code}`,
    `P=pre; \${P}gate approve ${code}`, `$(echo pregate) approve ${code}`, `\`echo pregate\` approve ${code}`, `env $(echo pregate) approve ${code}`]) {
    const call = { session, tool: "Bash", callId: "spliced", cwd: elsewhere, command };
    expect(inert({ kind: "pre-command", command: call })).toBe(false);
    expect(onPreCommand(call).verdict, command).toBe("deny");
  }
  expect(onPreCommand({ session, tool: "Bash", callId: "ls", cwd: elsewhere, command: "ls" }).verdict).toBe("none");
}));

test("the batch route is named from any directory after the session reached a project", () => project(async (a) => {
  const { elsewhere, code } = await batchOf(a);
  const session: Session = { harness: "claude-code", id: "moved", turnId: "one", agentId: null, interactive: true };
  delete process.env.CI; delete process.env.PREGATE_UNATTENDED_APPROVAL;
  expect(onPreCommand({ session, tool: "Bash", callId: "ls", cwd: a, command: "ls" }).verdict).toBe("none");
  const routed = onPreCommand({ session, tool: "Bash", callId: "approve", cwd: elsewhere, command: `pregate approve ${code}` });
  expect(routed.verdict, routed.full).toBe("deny");
  expect(routed.full).toContain(`run pregate approve ${code} in a separate terminal`);
  expect(routed.full).not.toContain(`! pregate approve ${code}`);
}));

test("a batch approval inside a project pinning an older engine is answered by the engine that wrote the batch", () => project(async (a) => {
  const { code } = await batchOf(a);
  writeFileSync(join(a, LOCK), JSON.stringify({ ...JSON.parse(readFileSync(join(a, LOCK), "utf8")), engine: "0.2.6" }));
  const session: Session = { harness: "claude-code", id: "pinned", turnId: "one", agentId: null, interactive: true };
  const event = (command: string) => ({ kind: "pre-command" as const, command: { session, tool: "Bash", callId: "c", cwd: a, command } });
  expect(redirect(event(`pregate approve ${code}`))).toBeNull();
  expect(redirect(event(`pregate approve ${code} --no-commit`))).toBe("0.2.6");
  expect(redirect(event(`pregate approve ${"0".repeat(12)}`))).toBe("0.2.6");
}));

// What `run` writes through fs.writeSync, where approve() prints its summary.
async function printedBy<T>(run: () => Promise<T>): Promise<{ result: T; printed: string }> {
  const out: string[] = [];
  const spy = spyOn(fs, "writeSync").mockImplementation(((_fd: number, data: Buffer) => { out.push(data.toString()); return data.length; }) as typeof fs.writeSync);
  const result = await run().finally(() => spy.mockRestore());
  return { result, printed: out.join("") };
}

test("the batch approval prints the reviews without the pending instructions", () => project(async (a) => {
  const { code } = await batchOf(a);
  const { result, printed } = await printedBy(() => approveBatch(code, true, true));
  expect(result!.code).toBe(0);
  expect(printed).toContain(`Project: ${a}`);
  expect(printed).not.toContain("Pending human review");
  expect(printed).not.toContain("Digest:");
  expect(printed).not.toContain("! pregate approve");
}));
