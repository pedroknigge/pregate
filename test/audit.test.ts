import { expect, setDefaultTimeout, test } from "bun:test";

// Windows rejects ESC in a file name. POSIX keeps it so the report must escape the byte.
const HOSTILE = process.platform === "win32" ? "" : "\u001b";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { audit, promote } from "../src/audit-command.ts";
import { readProposal } from "../src/proposal.ts";
import { compile } from "../src/compile.ts";
import { canonical } from "../src/disk.ts";
import { LOCK, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { fitnessFingerprint } from "../src/fitness-command.ts";
import { policyFixture } from "./policy-fixtures.ts";

setDefaultTimeout(180_000);

test("whole-tree audit includes committed debt, shadow and warnings, every location and incomplete coverage", async () => {
  const area = canonical(mkdtempSync(join(tmpdir(), "pregate-audit-"))), root = join(area, "repo");
  await inScratch(area, async () => {
    mkdirSync(join(root, "src/domain"), { recursive: true }); mkdirSync(join(root, ".pregate"));
    const preset = JSON.parse(policyFixture(readFileSync("catalog/presets/backend-clean-ddd.json", "utf8")));
    preset.enforcement = "shadow";
    preset.scope = { include: ["src/**"], exclude: [] };
    preset.overrides = { ...preset.overrides, "CC-FN-002": { params: { max: 2 } }, "CC-ER-002": "warn" };
    const text = JSON.stringify(preset, null, 2) + "\n";
    writeFileSync(join(root, PRESET), text);
    const compiled = compile(text, sourcesOf(root), VERSIONS);
    if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
    writeFileSync(join(root, LOCK), compiled.text);
    const parameters = "export function oldDebt(a: number, b: number, c: number) { return a + b + c; }\n";
    for (let i = 0; i < 12; i++) writeFileSync(join(root, `src/domain/debt${i}.ts`), parameters);
    writeFileSync(join(root, "src/domain/broken-import.ts"), 'import { missing } from "@/absent";\n' + parameters);
    writeFileSync(join(root, "src/domain/warning.ts"), "try { work(); } catch (e) {}\n");
    writeFileSync(join(root, "src/domain/syntax.ts"), "export const = ;\n");
    writeFileSync(join(root, "src/legacy.swift"), "func main() {}\n");
    writeFileSync(join(root, "src/uncovered.py"), "pass\n");
    mkdirSync(join(root, "other")); writeFileSync(join(root, "other/ignored.ts"), parameters);
    const git = (...args: string[]) => {
      const child = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root, stderr: "pipe" });
      if (child.exitCode !== 0) throw new Error(child.stderr.toString());
    };
    git("init", "-q"); git("add", "."); git("commit", "-qm", "existing debt");
    const before = readFileSync(join(root, LOCK), "utf8");
    const result = await audit(["--repo", root, "--json"]), data = JSON.parse(result.text);
    expect(result.code).toBe(2);
    expect(data.summary.violations).toBe(14);
    expect(data.summary.shadow).toBe(14); expect(data.summary.warnings).toBe(14);
    expect(data.findings.filter((v: { rule: string }) => v.rule.endsWith("CC-FN-002"))).toHaveLength(13);
    expect(data.errors.map((e: { cause: string }) => e.cause).sort()).toEqual(["syntax", "unresolvable-import"]);
    expect(data.unsupported).toEqual(["src/legacy.swift"]);
    expect(data.uncovered).toEqual(["src/uncovered.py"]);
    expect(data.fileCoverage).toContainEqual({ path: "src/uncovered.py", language: "python", rules: [] });
    expect(data.excluded).toContainEqual({ path: "other/ignored.ts", reason: "Outside preset scope." });
    expect(data.skippedRules.some((r: { reason: string }) => r.reason.includes("baseline"))).toBe(true);
    expect(data.fileHashes).toHaveLength(16); expect(data.changedDuringAudit).toBe(false);
    expect(readFileSync(join(root, LOCK), "utf8")).toBe(before);
    expect(existsSync(join(root, ".pregate/requests"))).toBe(false);
    const human = await audit(["--repo", root]);
    expect(human.text).toContain("14 violations"); expect(human.text).toContain("src/domain/debt11.ts:1");
    expect(human.text).not.toContain("+5 more"); expect(human.text).toContain("Existing debt is included");

    const binary = join(area, ENGINE_FILE); compileBinary(hostTarget(), binary);
    const run = (...args: string[]) => Bun.spawnSync([binary, ...args], { cwd: root, env: { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(area, "home"),
      XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state") }, stdout: "pipe", stderr: "pipe", timeout: 10000 });
    expect(run("audit", "--json").exitCode).toBe(2);
    expect(run("check", "--ratchet", "--base", "HEAD").exitCode).toBe(0);
    writeFileSync(join(root, "src/domain/syntax.ts"), "export {};\n");
    writeFileSync(join(root, "src/domain/broken-import.ts"), parameters);
    rmSync(join(root, "src/legacy.swift"));
    rmSync(join(root, "src/uncovered.py"));
    const complete = run("audit", "--json");
    expect(complete.exitCode).toBe(0); // shadow-only debt blocks nothing under live policy
    expect(run("audit", "--json", "--strict").exitCode).toBe(1);
    expect(JSON.parse(complete.stdout.toString()).summary.violations).toBe(14);
    for (let i = 0; i < 12; i++) writeFileSync(join(root, `src/domain/debt${i}.ts`), "export {};\n");
    writeFileSync(join(root, "src/domain/broken-import.ts"), "export {};\n");
    writeFileSync(join(root, "src/domain/warning.ts"), "export {};\n");
    expect(run("audit").exitCode).toBe(0);
    git("status", "--porcelain");
    rmSync(join(root, ".git"), { recursive: true });
    expect(run("audit", "--json").exitCode).toBe(0);
    writeFileSync(join(root, LOCK), before.replace('"lockVersion": 1', '"lockVersion": 2'));
    expect(run("audit").exitCode).toBe(2);
    expect(run("audit", "--unknown").exitCode).toBe(2);
  });
}, 30000);

function humanAuditFixture() {
  const root = canonical(mkdtempSync(join(tmpdir(), "pregate-audit-human-")));
  for (const dir of [".pregate", "src/domain"]) mkdirSync(join(root, dir), { recursive: true });
  const preset = JSON.parse(readFileSync("catalog/presets/backend-clean-ddd.json", "utf8"));
  preset.enforcement = "shadow";
  preset.scope = { include: ["src/**"], exclude: [] };
  preset.overrides = { "CC-FN-002": { params: { max: 2 } } };
  const text = JSON.stringify(preset);
  writeFileSync(join(root, PRESET), text);
  const compiled = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, LOCK), compiled.text);
  for (let i = 0; i < 30; i++) writeFileSync(join(root, `src/domain/debt${String(i).padStart(2, "0")}${i === 0 ? HOSTILE : ""}.ts`),
    "export function debt(a: number, b: number, c: number) { return a + b + c; }\n");
  for (let i = 0; i < 6; i++) {
    writeFileSync(join(root, `src/domain/syntax${i}.ts`), "export const = ;\n");
    writeFileSync(join(root, `src/legacy${i}.swift`), "func main() {}\n");
    writeFileSync(join(root, `src/uncovered${i}.py`), "pass\n");
  }
  return root;
}

test("compact human audit bounds every detail category while full and machine outputs retain complete evidence", async () => {
  const root = humanAuditFixture();
  await inScratch(root, async () => {
    const machine = await audit(["--repo", root, "--json"]), data = JSON.parse(machine.text);
    const compact = await audit(["--repo", root]), full = await audit(["--repo", root, "--full"]);
    expect([compact.code, full.code, machine.code]).toEqual([2, 2, 2]);
    expect(data.summary.violations).toBe(30); expect(data.findings).toHaveLength(30);
    expect(data.errors).toHaveLength(6); expect(data.unsupported).toHaveLength(6); expect(data.uncovered).toHaveLength(6);
    expect(data.fitness).toHaveLength(64); expect(data.fitness.every((f: { status: string }) => f.status === "unverified")).toBe(true);
    for (const output of [compact, full]) {
      expect(output.text).toContain("30 violations in 30 files");
      // The compact audit says verification is not adopted; --full keeps every requirement.
      expect(output.text).toContain(output === compact ? "Project verification: not adopted (64 optional requirements have no verifier and check nothing; pregate fitness plan)." : "0 verified; 0 failed; 64 unverified requirements");
      expect(output.text).toContain("Existing debt is included");
      if (HOSTILE !== "") { expect(output.text).not.toContain(HOSTILE); expect(output.text).toContain("debt00\\u001b.ts:1"); }
    }
    expect(compact.text).toContain("Locations (showing 25 of 30)");
    expect(compact.text.match(/    Fix:/g)).toHaveLength(1);
    expect(full.text.match(/    Fix:/g)).toHaveLength(30);
    for (const title of ["Analysis errors", "Unsupported source", "Missing language policy"]) expect(compact.text).toContain(`${title} (showing 5 of 6)`);
    expect(compact.text.indexOf("UNRESOLVED")).toBeLessThan(compact.text.indexOf("Locations"));
    expect(compact.text.indexOf("NOT COVERED")).toBeLessThan(compact.text.indexOf("Locations"));
    expect(compact.text).not.toContain("CORE-INV-"); expect(compact.text).toContain("pregate fitness plan");
    expect(compact.text).not.toContain("debt29.ts:1"); expect(compact.text).not.toContain("syntax5.ts");
    expect(compact.text).not.toContain("legacy5.swift"); expect(compact.text).not.toContain("uncovered5.py");
    expect(compact.text).toContain("pregate audit --full"); expect(compact.text).toContain("pregate audit --json or --jsonl");
    for (const finding of data.findings) expect(full.text).toContain(finding.path.replace("\u001b", "\\u001b") + ":" + finding.line);
    for (const path of [...data.errors.map((e: { path: string }) => e.path), ...data.unsupported, ...data.uncovered]) expect(full.text).toContain(path);
    expect(full.text.match(/CORE-INV-\d+: UNVERIFIED/g)).toHaveLength(64);
    const records: Record<string, any>[] = [];
    const stream = await audit(["--repo", root, "--jsonl"], record => records.push(record));
    expect(stream.code).toBe(machine.code); expect(stream.text).toBe("");
    expect(records.filter(record => record.type === "file").flatMap(record => record.findings)).toEqual(data.findings);
    for (const key of ["summary", "errors", "unsupported", "uncovered", "fitness", "fileHashes", "contentHash"]) expect(records.at(-1)!.report[key]).toEqual(data[key]);
  });
});

test("compact human audit preserves debt and clean exit codes and the complete requested refactoring plan", async () => {
  const root = humanAuditFixture();
  await inScratch(root, async () => {
    for (let i = 0; i < 6; i++) for (const path of [`src/domain/syntax${i}.ts`, `src/legacy${i}.swift`, `src/uncovered${i}.py`]) rmSync(join(root, path));
    const preset = policyFixture(readFileSync(join(root, PRESET), "utf8"));
    writeFileSync(join(root, PRESET), preset);
    const compiled = compile(preset, sourcesOf(root), VERSIONS);
    if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
    writeFileSync(join(root, LOCK), compiled.text);
    const plan = await audit(["--repo", root, "--plan"]), fullPlan = await audit(["--repo", root, "--full", "--plan"]);
    expect(plan.code).toBe(0); expect(fullPlan.code).toBe(0);
    expect((await audit(["--repo", root, "--strict"])).code).toBe(1);
    expect(plan.text).toContain("Locations (showing 25 of 30)"); expect(plan.text).toContain("debt29.ts");
    expect(plan.text.slice(plan.text.indexOf("Refactoring plan (advisory):"))).toBe(fullPlan.text.slice(fullPlan.text.indexOf("Refactoring plan (advisory):")));
    for (let i = 0; i < 30; i++) writeFileSync(join(root, `src/domain/debt${String(i).padStart(2, "0")}${i === 0 ? HOSTILE : ""}.ts`), "export {};\n");
    for (const flags of [[], ["--full"], ["--json"]]) expect((await audit(["--repo", root, ...flags])).code).toBe(0);
  });
});

test("default audit fails only on debt that blocks under live policy; advisor debt exits 0", async () => {
  const root = humanAuditFixture();
  await inScratch(root, async () => {
    for (let i = 0; i < 6; i++) for (const path of [`src/domain/syntax${i}.ts`, `src/legacy${i}.swift`, `src/uncovered${i}.py`]) rmSync(join(root, path));
    for (const [enforcement, code] of [["enforce", 0], ["advisor", 0]] as const) {
      const preset = JSON.parse(policyFixture(readFileSync(join(root, PRESET), "utf8")));
      preset.enforcement = enforcement;
      const text = JSON.stringify(preset), compiled = compile(text, sourcesOf(root), VERSIONS);
      if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
      writeFileSync(join(root, PRESET), text); writeFileSync(join(root, LOCK), compiled.text);
      expect((await audit(["--repo", root, "--json"])).code).toBe(code);
      expect((await audit(["--repo", root, "--json", "--strict"])).code).toBe(1);
    }
  });
});

test("compact human audit keeps missing reviewed assertion evidence visible before static repairs", async () => {
  const root = humanAuditFixture();
  await inScratch(root, async () => {
    const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
    const inputs = ["src/domain/debt01.ts"], verificationHash = fitnessFingerprint(root, inputs);
    preset.fitness = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`CORE-INV-${String(i + 1).padStart(3, "0")}`,
      { command: ["never-execute-audit-fixture"], inputs, verificationHash, timeoutMs: 1000, rationale: "Reviewed fixture assertion; audit must only inspect its missing evidence." }]));
    const text = JSON.stringify(preset), compiled = compile(text, sourcesOf(root), VERSIONS);
    if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
    writeFileSync(join(root, PRESET), text); writeFileSync(join(root, LOCK), compiled.text);
    const compact = await audit(["--repo", root]), full = await audit(["--repo", root, "--full"]);
    expect(compact.code).toBe(2); expect(full.code).toBe(2);
    expect(compact.text).toContain("Adopted assertions needing evidence (showing 5 of 7)");
    expect(compact.text).toContain("The project fitness function has not run for this contract and input tree");
    expect(compact.text).toContain("64 unverified requirements");
    expect(compact.text.indexOf("CORE-INV-001: UNVERIFIED")).toBeLessThan(compact.text.indexOf("Locations"));
    expect(compact.text).not.toContain("CORE-INV-006:"); expect(full.text).toContain("CORE-INV-007: UNVERIFIED");
  });
});

test("compact human audit rejects duplicate and incompatible output options before emitting records", async () => {
  for (const flags of [["--full", "--full"], ["--full", "--json"], ["--json", "--full"], ["--full", "--jsonl"], ["--jsonl", "--full"], ["--json", "--json"], ["--jsonl", "--jsonl"]]) {
    const records: unknown[] = [];
    const result = await audit(flags, record => records.push(record));
    expect(result.code).toBe(2); expect(records).toEqual([]);
    if (flags.includes("--jsonl")) expect(JSON.parse(result.text)).toMatchObject({ type: "error", code: 2 });
    else expect(result.text).toMatch(/usage:|without --json/);
  }
});

test("whole-tree audit resolves directory indexes and keeps their architecture findings", async () => {
  const root = canonical(mkdtempSync(join(tmpdir(), "pregate-audit-index-")));
  await inScratch(root, async () => {
    for (const dir of [".pregate", "src/domain", "src/infra/provider"]) mkdirSync(join(root, dir), { recursive: true });
    const preset = policyFixture(readFileSync("catalog/presets/backend-clean-ddd.json", "utf8"));
    writeFileSync(join(root, PRESET), preset);
    const compiled = compile(preset, sourcesOf(root), VERSIONS);
    if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
    writeFileSync(join(root, LOCK), compiled.text);
    writeFileSync(join(root, "src/infra/provider/index.ts"), "export const provider = 1;\n");
    writeFileSync(join(root, "src/domain/use.ts"), 'import { provider } from "../infra/provider"; export const result = provider;\n');
    const source = await audit(["--repo", root, "--json"]);
    const data = JSON.parse(source.text);
    expect(source.code).toBe(1);
    expect(data.errors).toEqual([]);
    expect(data.changedDuringAudit).toBe(false);
    expect(data.filesScanned).toBe(2);
    expect(data.findings.some((f: { path: string; check: string }) => f.path === "src/domain/use.ts" && f.check.includes("layer-direction"))).toBe(true);
    const binary = join(root, ENGINE_FILE); compileBinary(hostTarget(), binary);
    const output = Bun.spawnSync([binary, "audit", "--json"], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 10000 });
    expect(output.exitCode).toBe(1);
    const built = JSON.parse(output.stdout.toString());
    expect(built.errors).toEqual([]);
    expect(built.changedDuringAudit).toBe(false);
    expect(built.findings).toEqual(data.findings);
  });
}, 30000);

test("whole-tree audit retains findings after raw NUL tokens in source and production binary", async () => {
  const root = canonical(mkdtempSync(join(tmpdir(), "pregate-audit-nul-")));
  await inScratch(root, async () => {
    for (const dir of [".pregate", "src/domain", "src/infra"]) mkdirSync(join(root, dir), { recursive: true });
    const preset = policyFixture(readFileSync("catalog/presets/backend-clean-ddd.json", "utf8"));
    writeFileSync(join(root, PRESET), preset);
    const compiled = compile(preset, sourcesOf(root), VERSIONS);
    if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
    writeFileSync(join(root, LOCK), compiled.text);
    writeFileSync(join(root, "src/infra/provider.ts"), "export const provider = 1;\n");
    const valid = 'const message = "a\0b";\n/* a\0b */\nimport { provider } from "../infra/provider";\nexport const result = provider;\n';
    writeFileSync(join(root, "src/domain/use.ts"), valid);
    const before = readFileSync(join(root, "src/domain/use.ts"));
    const binary = join(root, ENGINE_FILE); compileBinary(hostTarget(), binary);
    const run = () => Bun.spawnSync([binary, "audit", "--json"], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 10000 });
    const source = await audit(["--repo", root, "--json"]), data = JSON.parse(source.text);
    const output = run(), built = JSON.parse(output.stdout.toString());
    expect(source.code).toBe(1); expect(output.exitCode).toBe(1);
    expect(data.errors).toEqual([]); expect(built.errors).toEqual([]);
    expect(data.findings.some((f: { line: number; check: string }) => f.line === 3 && f.check.includes("layer-direction"))).toBe(true);
    expect(built.findings).toEqual(data.findings);
    expect(built.fileHashes).toEqual(data.fileHashes);
    expect(built.changedDuringAudit).toBe(false);
    expect(readFileSync(join(root, "src/domain/use.ts"))).toEqual(before);
    writeFileSync(join(root, "src/domain/use.ts"), valid + "const invalid = ;\n");
    const invalid = await audit(["--repo", root, "--json"]), rejected = run();
    expect(invalid.code).toBe(2); expect(rejected.exitCode).toBe(2);
    expect(JSON.parse(invalid.text).errors).toContainEqual({ path: "src/domain/use.ts", cause: "syntax", line: 5 });
    expect(JSON.parse(rejected.stdout.toString()).errors).toEqual(JSON.parse(invalid.text).errors);
  });
}, 30000);

test("promote prepares a digest review for clean advisor rules and refuses violating or broken trees", async () => {
  const area = canonical(mkdtempSync(join(tmpdir(), "pregate-promote-"))), root = join(area, "repo"), oldData = process.env.XDG_DATA_HOME;
  process.env.XDG_DATA_HOME = join(area, "data");
  await inScratch(area, async () => {
    try {
      for (const dir of [".pregate", "src/domain"]) mkdirSync(join(root, dir), { recursive: true });
      const preset = JSON.parse(policyFixture(readFileSync("catalog/presets/backend-clean-ddd.json", "utf8")));
      preset.enforcement = "advisor";
      preset.scope = { include: ["src/**"], exclude: [] };
      preset.overrides = { ...preset.overrides, "CC-FN-002": { params: { max: 2 } } };
      const text = JSON.stringify(preset, null, 2) + "\n", compiled = compile(text, sourcesOf(root), VERSIONS);
      if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
      writeFileSync(join(root, PRESET), text); writeFileSync(join(root, LOCK), compiled.text);
      writeFileSync(join(root, "src/domain/debt.ts"), "export function oldDebt(a: number, b: number, c: number) { return a + b + c; }\n");
      expect((await promote(["--repo", root, "--rule", "CC-FN-002", "--preview"])).code).toBe(1);
      expect((await promote(["--repo", root, "--rule", "unknown-rule", "--preview"])).code).toBe(1);
      expect((await promote(["--repo", root, "--preview", "--yes"])).code).toBe(1);
      const single = await promote(["--repo", root, "--rule", "CC-ER-002", "--preview"]);
      expect(single.code, single.text).toBe(0);
      expect(single.text).toContain("Would promote to enforce (1, pending approval): clean-code/CC-ER-002 (1 file).");
      expect(single.text).toContain("Mode: advisor — the agent sees findings, except 1 rule set to enforce, which blocks.");
      const unflagged = await promote(["--repo", root, "--rule", "CC-ER-002"]);
      expect(unflagged.code).toBe(1);
      expect(unflagged.text).toContain("Run pregate promote --preview to prepare the review");
      expect(single.text).toContain("Digest:");
      const idle = await promote(["--repo", root, "--rule", "TDD-FOCUS-001", "--preview"]);
      expect(idle.code).toBe(1);
      expect(idle.text).toContain("testing/TDD-FOCUS-001 matches no files in the audited scope");
      const report = JSON.parse((await audit(["--repo", root, "--json"])).text) as { auditedRules: { rule: string; files: number }[]; enforceCandidates: string[] };
      expect(report.auditedRules.find(rule => rule.rule === "testing/TDD-FOCUS-001")!.files).toBe(0);
      expect(report.auditedRules.find(rule => rule.rule === "clean-code/CC-FN-001")!.files).toBe(1);
      expect(report.enforceCandidates).not.toContain("testing/TDD-FOCUS-001");
      const allClean = await promote(["--repo", root, "--preview"]);
      expect(allClean.code, allClean.text).toBe(0);
      expect(allClean.text).toContain("Not proposed:");
      expect(allClean.text).toContain("clean advisor rules match no files in scope");
      const proposed = JSON.parse(readProposal(root)!.writes[0]!.after!) as { overrides: Record<string, unknown> };
      expect(proposed.overrides["clean-code/CC-ER-002"]).toMatchObject({ enforcement: "enforce" });
      expect(proposed.overrides["testing/TDD-FOCUS-001"]).toBeUndefined();
      expect(proposed.overrides["CC-FN-002"]).toEqual({ params: { max: 2 } });
      writeFileSync(join(root, "src/domain/syntax.ts"), "export const = ;\n");
      expect((await promote(["--repo", root, "--preview"])).code).toBe(1);
    } finally {
      if (oldData === undefined) delete process.env.XDG_DATA_HOME; else process.env.XDG_DATA_HOME = oldData;
    }
  });
});

async function inScratch(dir: string, use: () => Promise<void>): Promise<void> {
  try { await use(); } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}
