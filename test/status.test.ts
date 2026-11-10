import { expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compile } from "../src/compile.ts";
import { packTemplate } from "../src/pack-template.ts";
import { enable } from "../src/consent.ts";
import { canonical } from "../src/disk.ts";
import { LOCK, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { merge } from "../src/register.ts";
import { protectionStatus, statusText } from "../src/status.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { fitness, fitnessFingerprint } from "../src/fitness-command.ts";
import { discardProposal, proposeBatch, proposeContract } from "../src/proposal.ts";
import { sha256 } from "../src/state.ts";
import { removeTree } from "./remove-tree.ts";

function withCleanup<T>(work: () => T, cleanup: () => void): T {
  try { return work(); } finally { cleanup(); }
}

async function withCleanupAsync<T>(work: () => Promise<T>, cleanup: () => void | Promise<void>): Promise<T> {
  try { return await work(); } finally { await cleanup(); }
}

// Each case spawns the compiled engine several times; on Windows a spawn costs 0.3-1 s.
setDefaultTimeout(60_000);

test("status distinguishes local consent, stale contracts, missing hooks, shadow and unsupported languages without writing", () => {
  const area = canonical(mkdtempSync(join(tmpdir(), "pregate-status-")));
  const vars = ["HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "CODEX_HOME", "GROK_HOME", "CLAUDE_CONFIG_DIR"] as const;
  const saved = vars.map((n) => process.env[n]);
  for (const name of vars) process.env[name] = join(area, name);
  const root = join(area, "repo"), data = join(process.env.XDG_DATA_HOME!, "pregate");
  const put = (path: string, text: string) => { mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, text); };
  withCleanup(() => {
    const source = JSON.parse(readFileSync(join(import.meta.dir, "../catalog/presets/legacy-safe.json"), "utf8"));
    source.enforcement = "shadow";
    const preset = JSON.stringify(source);
    put(join(root, PRESET), preset);
    const r = compile(preset, sourcesOf(root), VERSIONS);
    if ("errors" in r) throw new Error(r.errors.join("\n"));
    put(join(root, LOCK), r.text);
    expect(protectionStatus(null).state).toBe("inactive");
    expect(protectionStatus(root)).toMatchObject({ state: "inactive", consent: false, contract: { valid: true } });
    enable(root);
    const degraded = protectionStatus(root);
    expect(degraded.state).toBe("degraded");
    expect(degraded.git).toMatchObject({ repository: false, preCommitConfigured: false });
    expect(statusText(degraded, true)).toContain("local consent is active");
    expect(statusText(degraded, true)).toContain("Effective protection: degraded");
    const brief = statusText(degraded).split("\n");
    expect(brief[0]).toBe("Enforced (deny): 4.");
    expect(brief[1]).toStartWith("Advisor or monitor only:");
    expect(brief[2]).toBe("Unverified: not adopted (64 optional requirements have no verifier and check nothing).");
    expect(brief.findIndex((line) => line.startsWith("Catalog:"))).toBeGreaterThan(brief.findIndex((line) => line.startsWith("Unverified:")));
    expect(brief.some((line) => line.startsWith(`Local consent is active in ${root}. Effective protection: degraded. Mode: shadow.`) && line.endsWith(`Up to date (engine ${VERSIONS.engine}).`))).toBe(true);
    expect(brief.at(-1)).toBe("Next: pregate setup. Details: pregate status --verbose.");
    expect(degraded.mode).toBe("shadow");
    expect(statusText(protectionStatus(null))).toBe("PREGATE is not set up here.\nNext: pregate guide --preview (the human approves its review).");
    expect(degraded.rules.some((rule) => rule.enforcement === "shadow")).toBe(true);
    expect(degraded.rules.some((rule) => rule.integrity && rule.enforcement === "enforce")).toBe(true);
    for (const path of [join(data, "bin", WINDOWS ? "pregate.cmd" : "pregate"), join(data, VERSIONS.engine, ENGINE_FILE)]) { put(path, "present"); chmodSync(path, 0o755); }
    put(join(process.env.HOME!, ".claude/settings.json"), merge(null, "shared", data)!);
    put(join(process.env.CLAUDE_CONFIG_DIR!, "settings.json"), merge(null, "shared", data)!);
    const active = protectionStatus(root);
    expect(active.state).toBe("active");
    expect(active.fitnessCoverage).toEqual({ active: 64, pass: 0, fail: 0, unverified: 64, complete: false, adopted: false });
    expect(statusText(active, true).split("\n")[0]).toBe("Enforced (deny): 4.");
    expect(statusText(active, true)).toContain("4 static deny");
    expect(statusText(active, true)).toContain("Project verification: not adopted (64 optional requirements have no verifier and check nothing).");
    expect(statusText(active)).toContain("Enforced (deny): 4.");
    const harness = statusText(active).split("\n").find((line) => line.startsWith("Harnesses gated:"));
    expect(harness?.split(". Not configured:")[0]).toContain("claude-code");
    expect(statusText(active)).toContain("Next: pregate audit. Details: pregate status --verbose.");
    const stale = { ...active, project: { ...active.project!, lockEngine: "0.0.0" } };
    expect(statusText(stale)).toContain(`Update ready: project pins 0.0.0, installed ${VERSIONS.engine}.`);
    expect(statusText(stale)).toContain("Next: pregate guide --preview (or the human runs ! pregate update).");
    const newer = { ...active, project: { ...active.project!, lockEngine: "99.0.0" } };
    expect(statusText(newer)).toContain("Project pins newer engine 99.0.0");
    expect(statusText(newer)).toContain("Next: the human runs ! pregate update.");
    expect(active.harnesses.find((h) => h.id === "claude-code")?.configured).toBe(true);
    expect(active.harnesses.find((h) => h.id === "grok")?.warnings).toBe(true);
    expect(active.harnesses.find((h) => h.id === "agy")?.warnings).toBe(false);
    expect(active.harnesses.find((h) => h.id === "agy")?.nativeApproval).toBeNull();
    put(join(root, "src/main.py"), "print('unparsed')\n");
    put(join(root, "src/main.rs"), "fn main() {}\n");
    put(join(root, "src/main.swift"), "func main() {}\n");
    expect(protectionStatus(root)).toMatchObject({ state: "degraded", unsupportedInScope: ["src/main.swift"], uncoveredInScope: ["src/main.py", "src/main.rs"] });
    rmSync(join(root, "src/main.py"));
    rmSync(join(root, "src/main.rs"));
    rmSync(join(root, "src/main.swift"));
    put(join(root, LOCK), r.text + " ");
    expect(protectionStatus(root)).toMatchObject({ state: "degraded", contract: { valid: false }, rules: [] });
    expect(protectionStatus(root).fitnessCoverage.complete).toBe(false);
    expect(readFileSync(join(root, LOCK), "utf8")).toBe(r.text + " ");
    // A lock pinning an older engine that is still installed keeps working through that engine.
    put(join(root, LOCK), JSON.stringify({ ...JSON.parse(r.text), engine: "0.2.5" }));
    expect(protectionStatus(root)).toMatchObject({ state: "degraded", servedBy: null, rules: [] });
    // The pinned engine decides admission: one that refuses the lock (stale or edited for it) serves nothing.
    const pinned = join(data, "0.2.5", ENGINE_FILE);
    const pinnedEngine = (valid: boolean) => { put(pinned, `#!/bin/sh\necho '{"contract":{"valid":${valid}}}'\n`); chmodSync(pinned, 0o755); };
    if (!WINDOWS) {
      pinnedEngine(false);
      expect(protectionStatus(root)).toMatchObject({ state: "degraded", servedBy: null, rules: [] });
      pinnedEngine(true);
      const served = protectionStatus(root);
      expect(served).toMatchObject({ state: "active", servedBy: "0.2.5", contract: { valid: false } });
      expect(served.rules.length).toBeGreaterThan(0);
      expect(statusText({ ...served, engine: "0.3.0" })).toContain("Update ready: project pins 0.2.5, which still answers its hooks, installed 0.3.0.");
    }
    // A pending review names its code; a batch only while it binds this project's current review.
    const proposal = proposeContract({ root, lockText: r.text, baseline: "", writes: [] });
    const own = sha256(JSON.stringify(proposal));
    proposeBatch([{ root, digest: "d".repeat(64) }]);
    expect(statusText(protectionStatus(root))).toContain(`Next: the human approves the pending review: ! pregate approve ${own.slice(0, 12)}.`);
    const code = proposeBatch([{ root, digest: own }]).slice(0, 12);
    expect(statusText(protectionStatus(root))).toContain(`Next: the human approves the pending review: ! pregate approve ${code}.`);
    discardProposal(root);
    expect(protectionStatus(root).pendingApproval).toBeNull();
    // A pin below FLOOR is never handed to that engine, so it serves nothing.
    put(join(root, LOCK), JSON.stringify({ ...JSON.parse(r.text), engine: "0.0.0" }));
    const floor = join(data, "0.0.0", ENGINE_FILE);
    put(floor, `#!/bin/sh\necho '{"contract":{"valid":true}}'\n`); chmodSync(floor, 0o755);
    expect(protectionStatus(root)).toMatchObject({ state: "degraded", servedBy: null });
    put(join(root, PRESET), "{");
    expect(protectionStatus(root).contract.errors.length).toBeGreaterThan(0);
  }, () => {
    vars.forEach((n, i) => saved[i] === undefined ? delete process.env[n] : process.env[n] = saved[i]);
    removeTree(area);
  });
});

test("status counts actual current, stale and failed fitness evidence separately from static enforcement", async () => {
  const area = canonical(mkdtempSync(join(tmpdir(), "pregate-status-fitness-")));
  const saved = [process.cwd(), process.env.XDG_STATE_HOME];
  const root = `${area}/repo`; // canonical form, as the CLI passes it (join would use \ on Windows)
  const put = (rel: string, text: string) => { const path = join(root, rel); mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, text); };
  const domain = 'exports.order = lines => { if (!lines.length) throw new Error("empty order"); return Object.freeze([...lines]); };\n';
  await withCleanupAsync(async () => {
    process.env.XDG_STATE_HOME = join(area, "state");
    put("src/order.cjs", domain);
    put("quality/verify.cjs", 'const assert = require("node:assert/strict"); const {order} = require("../src/order.cjs"); assert.throws(() => order([]), /empty order/); assert.deepEqual(order([1]), [1]);\n');
    const source = { name: "status-fitness", version: "1.0.0", engine: VERSIONS.engine,
      sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: ["core/pregate-integrity"],
      scope: { include: ["src/**"], exclude: [] }, fitness: { "CORE-INV-014": { command: [process.execPath, "quality/verify.cjs"], inputs: ["quality/verify.cjs"],
      verificationHash: fitnessFingerprint(root, ["quality/verify.cjs"]), timeoutMs: 1000,
      rationale: "Bounded sample order constructor rejects empty input; this assertion does not certify the full product." } } };
    const preset = JSON.stringify(source);
    put(PRESET, preset);
    const compiled = compile(preset, sourcesOf(root), VERSIONS);
    if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
    put(LOCK, compiled.text);
    process.chdir(root);
    expect(protectionStatus(root).fitnessCoverage).toEqual({ active: 64, pass: 0, fail: 0, unverified: 64, complete: false, adopted: true });
    expect((await fitness(["run", "CORE-INV-014"])).code).toBe(0);
    const current = protectionStatus(root);
    expect(current.fitnessCoverage).toEqual({ active: 64, pass: 1, fail: 0, unverified: 63, complete: false, adopted: true });
    expect(statusText(current, true)).toContain("Unverified: 63 (no passing project evidence); 0 failed; 1 passing.");
    expect(statusText(current, true)).toContain("1 current assertions passed, 0 failed, 63 unverified");
    put("src/order.cjs", domain + "// Changed source invalidates proof.\n");
    expect(protectionStatus(root).fitnessCoverage).toEqual({ active: 64, pass: 0, fail: 0, unverified: 64, complete: false, adopted: true });
    put("src/order.cjs", domain.replace('if (!lines.length) throw new Error("empty order"); ', ""));
    expect((await fitness(["run", "CORE-INV-014"])).code).toBe(1);
    const failed = protectionStatus(root);
    expect(failed.fitnessCoverage).toEqual({ active: 64, pass: 0, fail: 1, unverified: 63, complete: false, adopted: true });
    expect(statusText(failed, true)).toContain("Unverified: 63 (no passing project evidence); 1 failed; 0 passing.");
    expect(statusText(failed, true)).toContain("0 current assertions passed, 1 failed, 63 unverified");
    put("src/order.cjs", domain);
    expect((await fitness(["run", "CORE-INV-014"])).code).toBe(0);
    expect(protectionStatus(root).fitnessCoverage.pass).toBe(1);
  }, () => {
    process.chdir(saved[0]!);
    if (saved[1] === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = saved[1];
    removeTree(area);
  });
});

test("status names preset globs that match no file only because [ ] read as syntax (#66)", () => {
  const area = canonical(mkdtempSync(join(tmpdir(), "pregate-status-glob-")));
  const root = join(area, "repo");
  withCleanup(() => {
    const source = JSON.parse(readFileSync(join(import.meta.dir, "../catalog/presets/legacy-safe.json"), "utf8"));
    source.scope = { ...source.scope, exclude: [...source.scope?.exclude ?? [], "src/app/[view]/**"] };
    mkdirSync(join(root, ".pregate"), { recursive: true });
    mkdirSync(join(root, "src/app/[view]"), { recursive: true });
    writeFileSync(join(root, "src/app/[view]/page.tsx"), "export const page = 1;\n");
    writeFileSync(join(root, PRESET), JSON.stringify(source));
    const status = protectionStatus(root);
    expect(status.globWarnings).toEqual(['Globs matching no project file: src/app/[view]/** (in JSON: "src/app/\\\\[view\\\\]/**"). [ ] { } are glob syntax; escape them as shown or use the exact path.']);
    expect(statusText(status)).toContain("Globs matching no project file: src/app/[view]/**");
    expect(statusText(status, true)).toContain("Globs matching no project file: src/app/[view]/**");
    // An unlistable repository (broken .git) drops the advisory; status still answers.
    writeFileSync(join(root, ".git"), "gitdir: missing\n");
    expect(protectionStatus(root).globWarnings).toEqual(["Glob check skipped: project files could not be listed."]);
  }, () => removeTree(area));
});

test("status names rule pack folders whose files Git does not hold", () => {
  const area = canonical(mkdtempSync(join(tmpdir(), "pregate-status-pack-")));
  const root = join(area, "repo");
  const run = (...args: string[]) => Bun.spawnSync(["git", ...args], { cwd: root, stdout: "ignore", stderr: "ignore",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" } });
  withCleanup(() => {
    for (const [rel, text] of Object.entries({ ...Object.fromEntries(Object.entries(packTemplate("team")).map(([k, v]) => [`rules/team/${k}`, v])), "src/a.ts": "export const a = 1;\n" })) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), text);
    }
    const source = JSON.parse(readFileSync(join(import.meta.dir, "../catalog/presets/legacy-safe.json"), "utf8"));
    source.sources.push({ ns: "team", kind: "path", path: "rules/team" });
    mkdirSync(join(root, ".pregate"), { recursive: true });
    writeFileSync(join(root, PRESET), JSON.stringify(source));
    run("init", "-q");
    expect(protectionStatus(root).uncommittedSources).toEqual(["rules/team"]);
    expect(statusText(protectionStatus(root))).toContain("Rule pack files not committed: rules/team. Commit them with the preset and lock, or teammates get a stale lock.");
    run("add", "-A"); run("commit", "-qm", "pack");
    expect(protectionStatus(root).uncommittedSources).toEqual([]);
    // Files the lock does not compile from (an ignored .DS_Store, fixtures) never make it stale.
    writeFileSync(join(root, ".git/info/exclude"), ".DS_Store\n");
    writeFileSync(join(root, "rules/team/.DS_Store"), "finder");
    mkdirSync(join(root, "rules/team/fixtures"), { recursive: true });
    writeFileSync(join(root, "rules/team/fixtures/new.json"), "{}");
    expect(protectionStatus(root).uncommittedSources).toEqual([]);
    writeFileSync(join(root, "rules/team/extra.json"), "{}");
    expect(protectionStatus(root).uncommittedSources).toEqual(["rules/team"]);
    expect(protectionStatus(null).uncommittedSources).toEqual([]);
  }, () => removeTree(area));
});
