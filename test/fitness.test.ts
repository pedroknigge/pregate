import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { compile } from "../src/compile.ts";
import { canonical as canonicalPath, readTree } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { fitnessResult } from "../src/fitness.ts";
import { fitnessFingerprint } from "../src/fitness-command.ts";
import { LOCK, PRESET, VERSIONS } from "../src/gate.ts";
import { canonical } from "../src/compile.ts";
import { H, sha256 } from "../src/state.ts";
import type { FitnessBinding, FitnessReceipt, Preset } from "../src/types.ts";

const area = mkdtempSync(join(tmpdir(), "pregate-fitness-"));
const binary = join(area, "engine", "version", ENGINE_FILE);
// Compiling the engine takes longer than bun's 5 s hook default on Windows runners.
beforeAll(() => compileBinary(hostTarget(), binary, true), 120_000);
afterAll(() => rmSync(area, { recursive: true, force: true }));

test("fitness bind prepares one reviewed binding without executing or changing active policy", () => {
  const project = verifierProject("compiled", "binding-preview", 'require("node:fs").writeFileSync("ran-verifier", "yes");', 1000);
  const original = [PRESET, LOCK].map(path => readFileSync(join(project.root, path), "utf8"));
  const flags = ["fitness", "bind", "core/CORE-INV-001", "--command-json", JSON.stringify([process.execPath, "verify.ts"]),
    "--inputs", "verify.ts", "--rationale", "The existing architecture test checks this exact boundary requirement.", "--timeout-ms", "1000", "--preview"];
  const result = project.run(...flags);
  expect(result.status).toBe(0); expect(result.stdout).toContain("Digest:");
  expect(result.stdout).toContain("verificationHash");
  expect([PRESET, LOCK].map(path => readFileSync(join(project.root, path), "utf8"))).toEqual(original);
  expect(existsSync(join(project.root, "ran-verifier"))).toBe(false);
  expect(project.run(...flags.filter(flag => flag !== "--preview")).status).toBe(1);
  expect(project.run(...flags.map(flag => flag === "core/CORE-INV-001" ? "core/CORE-INV-002" : flag)).status).toBe(1);
  expect(project.run(...flags.map(flag => flag === "verify.ts" ? "missing/**" : flag)).status).toBe(1);
  expect(project.run(...flags, "--yes").status).toBe(1);
});

function candidateProject(label: string) {
  const root = join(area, label);
  mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, "quality")); mkdirSync(join(root, ".pregate"));
  writeFileSync(join(root, "src/order.cjs"), 'exports.ship = lines => { if (!lines.length) throw new Error("empty order"); return lines; };\n');
  writeFileSync(join(root, "src/budget.txt"), "100");
  writeFileSync(join(root, "quality/order.cjs"), 'const fs=require("node:fs"); fs.appendFileSync("order-runs", "1"); require("node:assert/strict").throws(()=>require("../src/order.cjs").ship([]), /empty order/);\n');
  writeFileSync(join(root, "quality/budget.cjs"), 'const fs=require("node:fs"); fs.appendFileSync("budget-runs", "1"); require("node:assert/strict").ok(Number(fs.readFileSync("src/budget.txt", "utf8")) <= 100);\n');
  const rules = [
    ["FIT-STATE", "state", "The shipping transition must reject an empty order."],
    ["FIT-ORIGIN", "origin", "The empty-order transition must throw the named empty order error at the source."],
    ["FIT-BUDGET", "budget", "The declared fixture budget must be numeric and must not exceed 100."],
  ];
  const pack = join(root, "quality/rules");
  for (const [id, name] of rules) {
    const files = readTree("catalog/checks/invariants/valid-state", true);
    for (const [path, text] of Object.entries(files)) {
      const target = join(pack, "checks/invariants", name!, path); mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text.replaceAll("CORE-INV-014", id!).replaceAll("core/invariants/valid-state", `fixture/invariants/${name}`).replaceAll("invariant.r014", `fixture.${name}`));
    }
  }
  writeFileSync(join(pack, "source.json"), JSON.stringify({ ns: "fixture", version: "1.0.0", category: "invariants" }));
  mkdirSync(join(pack, "methodologies")); writeFileSync(join(pack, "methodologies/fitness.json"), JSON.stringify({ id: "fixture/fitness", version: "1.0.0", status: "preview", conflicts: [],
    invariants: rules.map(([id, name, why]) => ({ id, check: `fixture/invariants/${name}`, defaults: { verifier: id }, severity: "deny", why,
      source: { work: "Owned toy fitness fixture", locator: "test/fitness.test.ts", paraphrase: why }, fixHint: "Run the reviewed narrow toy assertion.", avoid: "This fixture is not evidence for a core obligation.", examples: { pass: "pass/current-inputs", fail: "fail/no-evidence" } })) }));
  const preset: Preset = { name: label, version: "1.0.0", engine: VERSIONS.engine, sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "fixture", kind: "path", path: "quality/rules" }],
    methodologies: ["fixture/fitness"], scope: { include: ["src/**"], exclude: [] } };
  const filesOf = (source: Preset["sources"][number]) => source.kind === "path" ? readTree(join(root, source.path), false) : readTree("catalog", false);
  const compiled = compile(JSON.stringify(preset), filesOf, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, PRESET), JSON.stringify(preset)); writeFileSync(join(root, LOCK), compiled.text);
  const manifest = { schemaVersion: 1, assertions: [
    { id: "order-state", command: [process.execPath, "quality/order.cjs"], inputs: ["quality/order.cjs"], timeoutMs: 1000,
      claims: [{ rule: "fixture/FIT-STATE", conditions: ["An empty order cannot ship."], coverage: "complete" }, { rule: "fixture/FIT-ORIGIN", conditions: ["A forbidden empty-order transition fails at its source."], coverage: "complete" }],
      negativeControls: ["Remove the empty-order guard; this same assertion must exit nonzero."],
      assumptions: { domain: ["Shipping orders with no lines is forbidden."], data: ["The fixture uses the actual order constructor/transition."], performance: [] }, limits: "Only empty-order transitions; unrelated states and domain requirements remain unverified." },
    { id: "budget", command: [process.execPath, "quality/budget.cjs"], inputs: ["quality/budget.cjs"], timeoutMs: 1000, maxAgeMs: 60000,
      claims: [{ rule: "fixture/FIT-BUDGET", conditions: ["The declared fixture budget must be numeric and cannot exceed 100."], coverage: "complete" }], negativeControls: ["Set the budget to 101; this same assertion must exit nonzero."],
      assumptions: { domain: [], data: ["src/budget.txt contains the applicable numeric budget."], performance: ["This asserts a configuration budget, not a runtime latency measurement."] }, limits: "Only the declared budget; other resource limits are not established." },
  ] };
  const file = join(root, "pregate.fitness.json"); writeFileSync(file, JSON.stringify(manifest));
  const env = { ...process.env, CI: "1", HOME: join(area, label + "-home"), XDG_DATA_HOME: join(area, label + "-data"), XDG_STATE_HOME: join(area, label + "-state") };
  const run = (...args: string[]) => {
    const child = spawnSync(binary, args, { cwd: root, env, encoding: "utf8", timeout: 10000 });
    if (child.error || child.signal) throw new Error(`${args}: ${child.error?.message ?? child.signal}`);
    return { code: child.status, text: child.stdout };
  };
  const contract = () => [PRESET, LOCK].map(path => readFileSync(join(root, path), "utf8"));
  const untouched = () => { expect(existsSync(join(root, "order-runs"))).toBe(false); expect(existsSync(join(root, "budget-runs"))).toBe(false); };
  return { root, file, manifest, env, run, contract, untouched, filesOf };
}

test("authored fitness plan names precise claims and assumptions without executing, binding or certifying filename hints", () => {
  const p = candidateProject("candidate-plan"), original = p.contract();
  const plan = p.run("fitness", "plan", "--json"); expect(plan.code).toBe(0);
  const data = JSON.parse(plan.text);
  expect(data.candidateAssertions.map((a: { id: string }) => a.id)).toEqual(["order-state", "budget"]);
  expect(data.candidateAssertions[0].claims[0].conditions).toEqual(["An empty order cannot ship."]);
  expect(data.candidateAssertions[1].assumptions.performance[0]).toContain("not a runtime latency");
  expect(data.candidateAssertions[0].inputs).toContain("pregate.fitness.json");
  expect(data.gaps).toHaveLength(64); expect(data.limits).toContain("not evidence");
  expect(data.groups.every((group: { suggestedAssertion: { negativeControls: string[] } }) => group.suggestedAssertion.negativeControls.length > 0)).toBe(true);
  p.untouched(); expect(p.contract()).toEqual(original);
  expect(p.run("approve", "--yes").code).toBe(1);
  const template = p.run("fitness", "plan", "--template"); expect(template.code).toBe(0);
  const draft = JSON.parse(template.text); expect(draft.assertions).toHaveLength(67);
  expect(draft.assertions.every((a: { command: string[]; inputs: string[] }) => a.command.length === 0 && a.inputs.length === 0)).toBe(true);
  const autoTemplate = p.run("fitness", "plan", "--template", "--auto"); expect(autoTemplate.code).toBe(0);
  const autoDraft = JSON.parse(autoTemplate.text);
  expect(autoDraft.assertions.find((a: { id: string }) => a.id === "fixture-fit-state").command).toEqual(["node", "quality/order.cjs"]);
  expect(autoDraft.assertions.find((a: { id: string }) => a.id === "fixture-fit-budget").inputs).toEqual(["quality/budget.cjs"]);
  writeFileSync(p.file, template.text);
  expect(p.run("fitness", "plan", "--json").code).toBe(0);
  expect(p.run("fitness", "bind", "--candidates", "pregate.fitness.json", "--preview").code).toBe(1);
  expect(p.run("fitness", "run", "--all").code).toBe(1); p.untouched(); expect(p.contract()).toEqual(original);
});

test("one digest adopts different project assertions, runs shared commands once, and preserves unknown coverage", () => {
  const p = candidateProject("candidate-batch"), original = p.contract();
  const flags = ["fitness", "bind", "--candidates", "pregate.fitness.json", "--preview"];
  const preview = p.run(...flags); expect(preview.code, preview.text).toBe(0);
  expect(preview.text.match(/^Digest:/gm)).toHaveLength(1);
  expect(preview.text).toContain("domain assumptions"); expect(preview.text).toContain("Negative controls to review");
  const digest = /^Digest: ([a-f0-9]{64})$/m.exec(preview.text)![1]!;
  expect(p.contract()).toEqual(original); p.untouched();
  expect(p.run("approve", "--yes", "--digest", "0".repeat(64)).code).toBe(1);
  expect(p.contract()).toEqual(original); p.untouched();
  expect(p.run("approve", "--yes", "--digest", digest).code).toBe(0); p.untouched();
  expect(JSON.parse(p.run("status", "--json").text).consent).toBe(false);
  expect(p.run("check", "--all").code).toBe(1);
  expect(p.run("fitness", "run", "--all").code).toBe(0);
  expect(readFileSync(join(p.root, "order-runs"), "utf8")).toBe("1");
  expect(readFileSync(join(p.root, "budget-runs"), "utf8")).toBe("1");
  const status = p.run("fitness", "status", "--json"); expect(status.code).toBe(1);
  const reported = JSON.parse(status.text), requirements = reported.requirements;
  expect(reported.summary).toEqual({ active: 67, adopted: 3, passing: 3, failed: 0, needsEvidence: 0, unbound: 64 });
  expect(requirements.filter((r: { status: string }) => r.status === "pass")).toHaveLength(3);
  expect(requirements.filter((r: { status: string }) => r.status === "unverified")).toHaveLength(64);
  expect(p.run("audit", "--json").code).toBe(0); // unbound requirements do not block
  expect(p.run("audit", "--json", "--strict").code).toBe(2);
  expect(p.run(...flags).text).toContain("Nothing proposed or executed");
  expect(p.run("approve", "--yes").code).toBe(1);
  writeFileSync(p.file, JSON.stringify({ ...p.manifest, assertions: p.manifest.assertions.map(a => ({ ...a, limits: a.limits + " Changed claim." })) }));
  expect(p.run("fitness", "run", "--all").text).toContain("nothing executed");
  expect(readFileSync(join(p.root, "order-runs"), "utf8")).toBe("1");
  writeFileSync(p.file, JSON.stringify(p.manifest)); writeFileSync(join(p.root, "src/budget.txt"), "101");
  expect(p.run("fitness", "status", "--json").text).not.toContain('"status": "pass"');
  expect(p.run("fitness", "run", "FIT-BUDGET").code).toBe(1);
  expect(JSON.parse(p.run("fitness", "status", "--json").text).requirements.find((r: { requirement: string }) => r.requirement === "FIT-BUDGET").status).toBe("fail");
});

test("selecting one candidate preserves existing adopted bindings without certifying other assertions", () => {
  const p = candidateProject("candidate-selected");
  const original = p.run("fitness", "bind", "CORE-INV-045", "--command-json", JSON.stringify([process.execPath, "quality/order.cjs"]),
    "--inputs", "quality/order.cjs", "--rationale", "Controlled existing binding retained during selected adoption.", "--max-age-ms", "50000", "--preview");
  expect(original.code).toBe(0); expect(p.run("approve", "--yes").code).toBe(0);
  const before = JSON.parse(readFileSync(join(p.root, PRESET), "utf8")).fitness;
  expect(before["CORE-INV-045"].maxAgeMs).toBe(50000);
  expect(p.run("fitness", "bind", "--candidates", "pregate.fitness.json", "--only", "budget", "--preview").code).toBe(0);
  expect(p.run("approve", "--yes").code).toBe(0);
  const after = JSON.parse(readFileSync(join(p.root, PRESET), "utf8")).fitness;
  expect(after["CORE-INV-045"]).toEqual(before["CORE-INV-045"]);
  expect(Object.keys(after).sort()).toEqual(["CORE-INV-045", "FIT-BUDGET"]);
  p.untouched();
});

test("partial coverage stays in plan gaps and cannot turn a whole requirement into passing evidence", () => {
  const p = candidateProject("candidate-partial"), original = p.contract();
  for (const claim of p.manifest.assertions[0]!.claims) claim.coverage = "partial";
  p.manifest.assertions[0]!.command = []; p.manifest.assertions[0]!.inputs = [];
  writeFileSync(p.file, JSON.stringify(p.manifest));
  const planned = p.run("fitness", "plan", "--json"); expect(planned.code).toBe(0);
  const plan = JSON.parse(planned.text); expect(plan.gaps).toHaveLength(66);
  expect(plan.gaps.some((gap: { rule: string }) => gap.rule === "fixture/FIT-STATE")).toBe(true);
  const refused = p.run("fitness", "bind", "--candidates", "pregate.fitness.json", "--preview");
  expect(refused.code).toBe(1); expect(refused.text).toContain("Partial assertions cannot establish");
  expect(p.run("approve", "--yes").code).toBe(1); expect(p.contract()).toEqual(original); p.untouched();
  expect(p.run("fitness", "bind", "--candidates", "pregate.fitness.json", "--only", "budget", "--preview").code).toBe(0);
  expect(p.run("approve", "--yes").code).toBe(0); expect(p.run("fitness", "run", "--all").code).toBe(0);
  const status = JSON.parse(p.run("fitness", "status", "--json").text);
  expect(status.summary.passing).toBe(1); expect(status.summary.unbound).toBe(66);
  expect(status.requirements.filter((r: { rule: string; status: string }) => r.rule.startsWith("core/")).every((r: { status: string }) => r.status === "unverified")).toBe(true);
  expect(existsSync(join(p.root, "order-runs"))).toBe(false);
});

test.each(["missing-control", "duplicate-rule", "inactive-rule", "empty-command", "missing-assumption", "invalid-age", "unknown-field", "missing-definition", "missing-coverage"])("invalid %s candidate rejects the whole proposal before command execution", kind => {
  const p = candidateProject("candidate-invalid-" + kind), original = p.contract();
  const invalid = JSON.parse(JSON.stringify(p.manifest));
  if (kind === "missing-control") invalid.assertions[1].negativeControls = [];
  if (kind === "duplicate-rule") invalid.assertions[1].claims[0].rule = "fixture/FIT-STATE";
  if (kind === "inactive-rule") invalid.assertions[1].claims[0].rule = "unknown/UNKNOWN-001";
  if (kind === "empty-command") invalid.assertions[1].command = [];
  if (kind === "missing-assumption") delete invalid.assertions[1].assumptions.data;
  if (kind === "invalid-age") invalid.assertions[1].maxAgeMs = 0;
  if (kind === "unknown-field") invalid.assertions[1].approve = true;
  if (kind === "missing-definition") invalid.assertions[1].inputs = ["quality/missing/**"];
  if (kind === "missing-coverage") delete invalid.assertions[1].claims[0].coverage;
  writeFileSync(p.file, JSON.stringify(invalid));
  expect(p.run("fitness", "plan", "--json").code).toBe(1);
  expect(p.run("fitness", "bind", "--candidates", "pregate.fitness.json", "--preview").code).toBe(1);
  expect(p.run("approve", "--yes").code).toBe(1); expect(p.contract()).toEqual(original); p.untouched();
});

test("literal candidate filenames with glob characters remain protected verifier inputs", () => {
  const p = candidateProject("candidate-literal-name"), file = "quality/evidence[team].json";
  writeFileSync(join(p.root, file), JSON.stringify(p.manifest));
  const planned = p.run("fitness", "plan", "--candidates", file, "--json"); expect(planned.code).toBe(0);
  expect(JSON.parse(planned.text).candidateAssertions[0].inputs).toContain("quality/evidence\\[team\\].json");
  expect(p.run("fitness", "bind", "--candidates", file, "--preview").code).toBe(0);
  expect(p.run("approve", "--yes").code).toBe(0); expect(p.run("fitness", "run", "--all").code).toBe(0);
  writeFileSync(join(p.root, file), JSON.stringify({ ...p.manifest, assertions: p.manifest.assertions.map(a => ({ ...a, limits: "Changed evidence scope." })) }));
  expect(p.run("fitness", "run", "--all").text).toContain("nothing executed");
  expect(readFileSync(join(p.root, "order-runs"), "utf8")).toBe("1");
});

test.skipIf(process.platform === "win32")("rendered candidate review commands preserve shell metacharacters as literal filenames", () => {
  const p = candidateProject("candidate-shell-name"), file = "quality/evidence'$(touch injected).json";
  writeFileSync(join(p.root, file), JSON.stringify(p.manifest));
  const planned = p.run("fitness", "plan", "--candidates", file, "--json"); expect(planned.code).toBe(0);
  const command = JSON.parse(planned.text).review;
  const reviewed = spawnSync("sh", ["-c", command], { cwd: p.root, env: { ...p.env, PATH: dirname(binary) + ":" + process.env.PATH }, encoding: "utf8", timeout: 10000 });
  expect(reviewed.error).toBeUndefined(); expect(reviewed.status).toBe(0); expect(reviewed.stdout).toContain("Digest:");
  expect(existsSync(join(p.root, "injected"))).toBe(false); p.untouched();
});

test("fitness evidence includes tracked authored build files and excludes ignored untracked output", () => {
  const p = candidateProject("candidate-tracked-build");
  mkdirSync(join(p.root, "build")); writeFileSync(join(p.root, "build/authored.txt"), "original");
  writeFileSync(join(p.root, "build/output.txt"), "generated"); writeFileSync(join(p.root, ".gitignore"), "build/**\n");
  for (const args of [["init", "-q"], ["add", "-f", "build/authored.txt"]]) {
    expect(spawnSync("git", args, { cwd: p.root, encoding: "utf8" }).status).toBe(0);
  }
  const preset = JSON.parse(readFileSync(join(p.root, PRESET), "utf8")); preset.scope.include.push("build/**");
  const compiled = compile(JSON.stringify(preset), p.filesOf, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(p.root, PRESET), JSON.stringify(preset)); writeFileSync(join(p.root, LOCK), compiled.text);
  expect(p.run("fitness", "bind", "--candidates", "pregate.fitness.json", "--preview").code).toBe(0);
  expect(p.run("approve", "--yes").code).toBe(0); expect(p.run("fitness", "run", "--all").code).toBe(0);
  const passing = JSON.parse(p.run("fitness", "status", "--json").text).summary;
  writeFileSync(join(p.root, "build/output.txt"), "different generated output");
  expect(JSON.parse(p.run("fitness", "status", "--json").text).summary).toEqual(passing);
  writeFileSync(join(p.root, "build/authored.txt"), "changed source");
  expect(JSON.parse(p.run("fitness", "status", "--json").text).summary.needsEvidence).toBe(3);
  expect(p.run("fitness", "run", "--all").code).toBe(0);
  rmSync(join(p.root, "build/authored.txt"));
  expect(JSON.parse(p.run("fitness", "status", "--json").text).summary.needsEvidence).toBe(3);
});

test("candidate selectors, flags and external files cannot mutate policy or execute commands", () => {
  const p = candidateProject("candidate-invalid-args"), original = p.contract();
  const external = join(area, "external-fitness.json"); writeFileSync(external, JSON.stringify(p.manifest));
  for (const args of [["--only", "missing"], ["--only", "budget,budget"], ["--yes"], ["--preview"]]) {
    expect(p.run("fitness", "bind", "--candidates", "pregate.fitness.json", ...args, "--preview").code).toBe(1);
  }
  expect(p.run("fitness", "bind", "--candidates", external, "--preview").code).toBe(1);
  expect(p.run("fitness", "plan", "--template", "--candidates", "pregate.fitness.json").code).toBe(1);
  expect(p.run("approve", "--yes").code).toBe(1); expect(p.contract()).toEqual(original); p.untouched();
});

function verifierProject(kind: "source" | "compiled", label: string, code: string, timeoutMs: number) {
  const name = `${label}-${kind}`, root = join(area, name), marker = join(root, "child-pid");
  mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, ".pregate"));
  writeFileSync(join(root, "src/value.txt"), "original");
  const verifier = join(root, "verify.ts");
  writeFileSync(verifier, code);
  const preset: Preset = { name, version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [],
    overrides: Object.fromEntries(Array.from({ length: 63 }, (_, i) => [`CORE-INV-${String(i + 2).padStart(3, "0")}`, "off" as const])),
    scope: { include: ["src/**"], exclude: [] }, fitness: {
      "CORE-INV-001": { command: [process.execPath, verifier], inputs: ["verify.ts"], verificationHash: fitnessFingerprint(root, ["verify.ts"]),
        timeoutMs, rationale: "Fixture checks resource bounds and rejection of incomplete evidence only." },
    } };
  const compiled = compile(JSON.stringify(preset), () => readTree("catalog", false), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, PRESET), JSON.stringify(preset)); writeFileSync(join(root, LOCK), compiled.text);
  const env = { ...process.env, CI: "1", HOME: join(area, `${name}-home`), XDG_DATA_HOME: join(area, `${name}-data`), XDG_STATE_HOME: join(area, `${name}-state`) };
  const worker = join(area, `fitness-${name}.ts`);
  // Source macros resolve from the repository before the public command enters the fixture.
  writeFileSync(worker, `import { fitness } from ${JSON.stringify(join(import.meta.dir, "../src/fitness-command.ts"))};
process.chdir(process.argv[2]!);
const result = await fitness(process.argv.slice(3));
console.log(result.text); process.exit(result.code);
`);
  const run = (...args: string[]) => spawnSync(kind === "source" ? process.execPath : binary,
    kind === "source" ? [worker, root, ...args.slice(1)] : args,
    { cwd: kind === "source" ? join(import.meta.dir, "..") : root, env, encoding: "utf8", timeout: 10000, killSignal: "SIGKILL" });
  return { run, marker, root };
}

test.each(["source", "compiled"] as const)("%s fitness deadline terminates a verifier that ignores SIGTERM", (kind) => {
  // The eventual exit bounds the negative control when the production deadline is ineffective.
  const { run, marker } = verifierProject(kind, "deadline", `import { writeFileSync } from "node:fs";
writeFileSync("child-pid", String(process.pid));
if (process.platform !== "win32") process.on("SIGTERM", () => {});
setTimeout(() => process.exit(0), 7000);
`, 500);
  const start = performance.now(), result = run("fitness", "run", "--all"), elapsed = performance.now() - start;
  expect(result.error).toBeUndefined(); expect(result.signal).toBeNull(); expect(result.status).toBe(1);
  const pid = Number(readFileSync(marker, "utf8"));
  expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
  expect(() => process.kill(pid, 0)).toThrow();
  const status = run("fitness", "status", "--json");
  expect(status.error).toBeUndefined(); expect(status.signal).toBeNull(); expect(status.status).toBe(1);
  const requirement = JSON.parse(status.stdout).requirements[0];
  expect(requirement.status).toBe("unverified"); expect(requirement.diagnostics).toContain("ETIMEDOUT");
  expect(elapsed).toBeGreaterThanOrEqual(450);
  expect(elapsed).toBeLessThan(3500);
}, 15000);

const outputCases = (["source", "compiled"] as const).flatMap((kind) => (["stdout", "stderr"] as const).map((channel) => [kind, channel] as const));
test.each(outputCases)("%s fitness output budget terminates an oversized %s verifier", (kind, channel) => {
  const { run, marker } = verifierProject(kind, `output-${channel}`, `import { writeFileSync, writeSync } from "node:fs";
writeFileSync("child-pid", String(process.pid));
if (process.platform !== "win32") process.on("SIGTERM", () => {});
const bytes = Buffer.alloc(16 * 1024 * 1024 + 1, 65);
for (let offset = 0; offset < bytes.length;) offset += writeSync(${channel === "stdout" ? 1 : 2}, bytes.subarray(offset));
setTimeout(() => process.exit(0), 7000);
`, 9000);
  const start = performance.now(), result = run("fitness", "run", "--all"), elapsed = performance.now() - start;
  expect(result.error).toBeUndefined(); expect(result.signal).toBeNull(); expect(result.status).toBe(1);
  const pid = Number(readFileSync(marker, "utf8"));
  expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
  expect(() => process.kill(pid, 0)).toThrow();
  const status = run("fitness", "status", "--json");
  expect(status.error).toBeUndefined(); expect(status.signal).toBeNull(); expect(status.status).toBe(1);
  const requirement = JSON.parse(status.stdout).requirements[0];
  expect(requirement.status).toBe("unverified");
  expect(requirement.diagnostics).toContain("16 MiB per-channel budget");
  expect(requirement.diagnostics).toContain(`${channel} (first 4096 bytes):\n${"A".repeat(4096)}`);
  expect(requirement.diagnostics.length).toBeLessThan(9000);
  expect(elapsed).toBeLessThan(3500);
}, 15000);

test.each(["source", "compiled"] as const)("%s fitness output budget admits exactly 16 MiB independently on both channels", (kind) => {
  const { run } = verifierProject(kind, "output-exact", `import { writeSync } from "node:fs";
const bytes = Buffer.alloc(16 * 1024 * 1024, 65);
for (const fd of [1, 2]) for (let offset = 0; offset < bytes.length;) offset += writeSync(fd, bytes.subarray(offset));
`, 9000);
  const result = run("fitness", "run", "--all");
  expect(result.error).toBeUndefined(); expect(result.signal).toBeNull(); expect(result.status).toBe(0);
  const status = run("fitness", "status", "--json");
  expect(status.error).toBeUndefined(); expect(status.signal).toBeNull(); expect(status.status).toBe(0);
  const requirement = JSON.parse(status.stdout).requirements[0];
  expect(requirement.status).toBe("pass"); expect(requirement.diagnostics).toBeUndefined();
}, 15000);

test("all 68 grammar-independent core requirements activate by default, with reviewed individual disable and optional packs absent", () => {
  const preset = { name: "core-defaults", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [], enforcement: "shadow" };
  const build = (overrides = {}) => compile(JSON.stringify({ ...preset, overrides }), () => readTree("catalog", false), VERSIONS);
  const all = build();
  if ("errors" in all) throw new Error(all.errors.join("\n"));
  expect(all.lock.rules).toHaveLength(68);
  expect(all.lock.rules.filter((r) => r.impl.kind === "primitive" && r.impl.primitive === "fitness")).toHaveLength(64);
  expect(all.lock.rules.every((r) => r.integrity && r.enforcement === "enforce" && r.impl.kind === "primitive")).toBe(true);
  expect(all.lock.preset.methodologies).toEqual(["core/pregate-integrity", "core/software-invariants"]);
  const disabled = build({ "CORE-INV-048": "off", "EVA-SUP-001": "off" });
  if ("errors" in disabled) throw new Error(disabled.errors.join("\n"));
  expect(disabled.lock.rules).toHaveLength(66);
  expect(disabled.lock.rules.some((r) => ["core/CORE-INV-048", "core/EVA-SUP-001"].includes(r.id))).toBe(false);
  const tooSlow = compile(JSON.stringify({ ...preset, fitness: { v: { command: ["check"], inputs: ["**"], verificationHash: "0".repeat(64), timeoutMs: 120001, rationale: "Explicit limit" } } }), () => readTree("catalog", false), VERSIONS);
  expect("errors" in tooSlow && tooSlow.errors[0]).toContain("120000 ms budget");
  for (const maxAgeMs of [0, -1, 0.5, "1000", Number.MAX_SAFE_INTEGER + 1]) {
    const invalidAge = compile(JSON.stringify({ ...preset, fitness: { v: { command: ["check"], inputs: ["**"], verificationHash: "0".repeat(64), timeoutMs: 1000, maxAgeMs, rationale: "Explicit evidence expiry" } } }), () => readTree("catalog", false), VERSIONS);
    expect("errors" in invalidAge).toBe(true);
  }
  const narrowed = build({ "CORE-INV-001": { params: { paths: [] } } });
  expect("errors" in narrowed && narrowed.errors[0]).toContain("cannot narrow");
});

test("both supplied invariant sets retain traceability without duplicate obligations or mandatory architecture styles", () => {
  const manifest = JSON.parse(readFileSync(join(import.meta.dir, "../catalog/methodologies/software-invariants.json"), "utf8"));
  const requests = [...readFileSync(join(import.meta.dir, "../docs/features/core-maintainability-update.md"), "utf8")
    .split("## Requested invariant rules")[1]!.matchAll(/^(\d+)\. (.+)$/gm)];
  expect(manifest.invariants).toHaveLength(64);
  expect(new Set(manifest.invariants.map((rule: { id: string }) => rule.id)).size).toBe(64);
  expect(requests).toHaveLength(48);
  for (const request of requests) {
    const owners = manifest.invariants.filter((rule: { source: { locator: string; paraphrase: string } }) =>
      rule.source.locator.split("; ").includes(`docs/features/core-maintainability-update.md, request ${request[1]}`));
    expect(owners).toHaveLength(1);
    expect(owners[0].source.paraphrase).toContain(request[2]);
  }
  const statement = (id: string) => manifest.invariants.find((rule: { id: string }) => rule.id === id).why;
  expect(statement("CORE-INV-024")).toContain("no folder name or architectural style is required");
  expect(statement("CORE-INV-031")).toContain("controlled consumers can migrate together");
  expect(statement("CORE-INV-031")).toContain("throughout its stated deprecation window");
  expect(statement("CORE-INV-053")).toContain("dated authoritative support evidence");
  expect(statement("CORE-INV-058")).toContain("Do not introduce speculative flags");
  expect(statement("CORE-INV-064")).toContain("target date");
});

test("missing, stale, incomplete and failed evidence cannot establish a requirement", () => {
  const binding: FitnessBinding = { command: ["verifier"], inputs: ["**"], verificationHash: "0".repeat(64), timeoutMs: 1000, rationale: "A reviewed project assertion" };
  const receipt: FitnessReceipt = { schemaVersion: 1, contractHash: "c", inputHash: "i", verifier: "v", command: ["verifier"],
    exitCode: 0, completed: true, recordedAt: "2026-10-04" };
  const now = Date.parse("2026-10-05");
  expect(fitnessResult("v", binding, receipt, { contractHash: "c", inputHash: "i", now }).status).toBe("pass");
  expect(fitnessResult("v", undefined, receipt, { contractHash: "c", inputHash: "i", now }).status).toBe("unverified");
  expect(fitnessResult("v", binding, null, { contractHash: "c", inputHash: "i", now }).status).toBe("unverified");
  for (const change of [{ inputHash: "old" }, { contractHash: "old" }, { verifier: "different" }, { command: ["unrelated"] }, { completed: false }, { exitCode: null }]) {
    expect(fitnessResult("v", binding, { ...receipt, ...change }, { contractHash: "c", inputHash: "i", now }).status).toBe("unverified");
  }
  expect(fitnessResult("v", binding, { ...receipt, exitCode: 1 }, { contractHash: "c", inputHash: "i", now }).status).toBe("fail");
});

test("reviewed evidence expiry rejects old, future and malformed times while source-only assertions need no time limit", () => {
  const binding: FitnessBinding = { command: ["verifier"], inputs: ["**"], verificationHash: "0".repeat(64), timeoutMs: 1000, maxAgeMs: 1000, rationale: "Deployment configuration must be reverified each second in this controlled test." };
  const recorded = Date.parse("2026-10-05T00:00:00Z");
  const receipt: FitnessReceipt = { schemaVersion: 1, contractHash: "c", inputHash: "i", verifier: "v", command: ["verifier"], exitCode: 0, completed: true, recordedAt: new Date(recorded).toISOString() };
  expect(fitnessResult("v", binding, receipt, { contractHash: "c", inputHash: "i", now: recorded }).status).toBe("pass");
  expect(fitnessResult("v", binding, receipt, { contractHash: "c", inputHash: "i", now: recorded + 999 }).status).toBe("pass");
  for (const now of [recorded + 1000, recorded + 2000, recorded - 1, NaN]) {
    expect(fitnessResult("v", binding, receipt, { contractHash: "c", inputHash: "i", now }).status).toBe("unverified");
  }
  expect(fitnessResult("v", binding, { ...receipt, recordedAt: "unknown" }, { contractHash: "c", inputHash: "i", now: recorded }).status).toBe("unverified");
  const { maxAgeMs: _, ...sourceOnly } = binding;
  expect(fitnessResult("v", sourceOnly, receipt, { contractHash: "c", inputHash: "i", now: recorded + 2000 }).status).toBe("pass");
});

test("compiled fitness verification evaluates the actual project and invalidates evidence after edits, new files and failures", () => {
  const root = join(area, "project");
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, ".pregate"));
  const env = { ...process.env, CI: "1", HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state") };
  const run = (...args: string[]) => {
    const child = spawnSync(binary, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], timeout: 20000 });
    if (child.error || child.signal) throw new Error(`${args}: ${child.error?.message ?? child.signal}\n${child.stdout}\n${child.stderr}`);
    return { code: child.status, text: child.stdout.toString() };
  };
  const source = join(root, "src/value.txt"), verifierFile = join(root, "verify.ts");
  writeFileSync(source, "valid");
  writeFileSync(verifierFile, 'import { readFileSync } from "node:fs";\nprocess.exit(readFileSync("src/value.txt", "utf8") === "valid" ? 0 : 1);\n');
  const preset = { name: "fitness-test", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [],
    scope: { include: ["src/**"], exclude: [] }, enforcement: "shadow",
    fitness: Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`CORE-INV-${String(i + 1).padStart(3, "0")}`,
      { command: [process.execPath, verifierFile], inputs: ["verify.ts"], verificationHash: fitnessFingerprint(root, ["verify.ts"]), timeoutMs: 1000, rationale: `Fixture binding for requirement ${i + 1}; verifies only the declared value.` }])) };
  const compiled = compile(JSON.stringify(preset), () => readTree("catalog", false), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, PRESET), JSON.stringify(preset));
  writeFileSync(join(root, LOCK), compiled.text);
  const initial = run("fitness", "status", "--json");
  expect(initial.code).toBe(1);
  expect(JSON.parse(initial.text).requirements).toHaveLength(64);
  expect(JSON.parse(initial.text).requirements.every((r: { status: string }) => r.status === "unverified")).toBe(true);
  const requirements = JSON.parse(initial.text).requirements;
  const statements = [...readFileSync(join(import.meta.dir, "../docs/inputs/core-invariants-48.md"), "utf8").matchAll(/^(\d+)\. (.+)$/gm)];
  for (const statement of statements) {
    const id = `CORE-INV-${statement[1]!.padStart(3, "0")}`;
    const requirement = requirements.find((r: { requirement: string }) => r.requirement === id);
    expect(requirement.statement.startsWith(statement[2])).toBe(true);
    expect(requirement.fixHint).toContain(`pregate fitness run ${id}`);
  }
  expect(run("check", "--all").code).toBe(1);
  const initialAudit = run("audit", "--json");
  expect(initialAudit.code).toBe(1); // adopted bindings without evidence block
  expect(run("audit", "--json", "--strict").code).toBe(2);
  expect(JSON.parse(initialAudit.text).fitness).toHaveLength(64);
  expect(JSON.parse(initialAudit.text).fitness).toEqual(requirements);
  expect(run("fitness", "run", "--all").code).toBe(0);
  expect(run("fitness", "status").text).toContain("PASS");
  expect(run("check", "--all").code).toBe(0);
  expect(run("audit", "--json").code).toBe(0);
  const receipt = join(env.XDG_STATE_HOME, "pregate/fitness", H(canonicalPath(root)), sha256(canonical(compiled.lock)), H("CORE-INV-001") + ".json");
  writeFileSync(receipt, "broken JSON");
  const corrupted = JSON.parse(run("fitness", "status", "--json").text).requirements[0];
  expect(corrupted.status).toBe("unverified");
  expect(corrupted.reason).toContain("Cannot read fitness evidence");
  expect(run("fitness", "run", "--all").code).toBe(0);
  writeFileSync(source, "invalid");
  expect(run("fitness", "status").code).toBe(1);
  expect(run("fitness", "run", "CORE-INV-001").code).toBe(1);
  expect(JSON.parse(run("fitness", "status", "--json").text).requirements[0].status).toBe("fail");
  writeFileSync(source, "valid");
  expect(run("fitness", "run", "--all").code).toBe(0);
  writeFileSync(join(root, "src/new.txt"), "new input");
  expect(run("fitness", "status").code).toBe(1);
  expect(run("fitness", "run", "unreviewed").code).toBe(1);
  expect(run("fitness", "run", "--all").code).toBe(0);
  expect(readFileSync(source, "utf8")).toBe("valid");
  writeFileSync(join(root, "src/binary.bin"), new Uint8Array([0, 255, 254, 1]));
  const git = (...args: string[]) => {
    const child = spawnSync("git", ["-c", "core.autocrlf=false", ...args], { cwd: root, env, encoding: "utf8" });
    expect(child.status).toBe(0);
  };
  git("init", "-q"); git("add", "-A");
  expect(run("fitness", "run", "--all").code).toBe(0);
  expect(run("check", "--staged").code).toBe(0); // Exact binary inputs and metadata exclusions match the verified tree.
  writeFileSync(join(root, "src/binary.bin"), new Uint8Array([0, 255, 254, 2]));
  expect(run("fitness", "run", "--all").code).toBe(0);
  expect(run("check", "--staged").code).toBe(1); // A clean working tree verification cannot approve different staged bytes.
  git("add", "src/binary.bin");
  expect(run("check", "--staged").code).toBe(0);
  expect(run("fitness", "fingerprint", "verify.ts").text.trim()).toBe(fitnessFingerprint(root, ["verify.ts"]));
  writeFileSync(verifierFile, 'import { writeFileSync } from "node:fs"; writeFileSync("executed.txt", "bypass"); process.exit(0);\n');
  expect(run("fitness", "status").text).toContain("Verifier inputs changed since human review");
  expect(run("fitness", "run", "--all").text).toContain("nothing executed");
  expect(existsSync(join(root, "executed.txt"))).toBe(false);
  expect(run("check", "--all").code).toBe(1);
}, 30000);

test("compiled onboarding keeps all 64 requirements active while verifiers are adopted one at a time", () => {
  const root = join(area, "progressive-project");
  mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, "quality")); mkdirSync(join(root, ".pregate"));
  const env = { ...process.env, CI: "1", HOME: join(area, "progressive-home"), XDG_DATA_HOME: join(area, "progressive-data"), XDG_STATE_HOME: join(area, "progressive-state") };
  const run = (...args: string[]) => {
    const child = spawnSync(binary, args, { cwd: root, env, encoding: "utf8", timeout: 10000 });
    expect(child.error).toBeUndefined(); expect(child.signal).toBeNull();
    return { code: child.status, text: child.stdout };
  };
  const domain = 'exports.ship = (lines) => { if (!lines.length) throw new Error("empty order"); return lines; };\n';
  const source = join(root, "src/order.cjs"), verifier = join(root, "quality/verify.cjs");
  writeFileSync(source, domain);
  writeFileSync(verifier, 'require("node:assert/strict").throws(() => require("../src/order.cjs").ship([]), /empty order/);\n');
  const preset: Preset = { name: "progressive", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [], scope: { include: ["src/**"], exclude: [] } };
  const admit = () => {
    const result = compile(JSON.stringify(preset), () => readTree("catalog", false), VERSIONS);
    if ("errors" in result) throw new Error(result.errors.join("\n"));
    writeFileSync(join(root, PRESET), JSON.stringify(preset)); writeFileSync(join(root, LOCK), result.text);
    expect(result.lock.rules.filter((r) => r.integrity && r.enforcement === "enforce")).toHaveLength(68);
    expect(preset.overrides).toBeUndefined();
  };
  admit();
  const initial = run("check", "--all");
  expect(initial.code).toBe(0); expect(initial.text).not.toContain("UNVERIFIED");
  const uncovered = run("audit", "--json");
  expect(uncovered.code).toBe(0);
  expect(run("audit", "--json", "--strict").code).toBe(2);
  expect(JSON.parse(uncovered.text).fitness.every((r: { status: string }) => r.status === "unverified")).toBe(true);
  preset.fitness = { "CORE-INV-014": { command: [process.execPath, verifier], inputs: ["quality/verify.cjs"],
    verificationHash: fitnessFingerprint(root, ["quality/verify.cjs"]), timeoutMs: 1000, rationale: "Empty orders cannot ship. Other requirements remain explicitly unverified." } };
  admit();
  expect(run("check", "--all").code).toBe(1); // A reviewed binding requires fresh evidence.
  expect(run("fitness", "run", "--all").code).toBe(0); // Run the adopted verifier; do not require 63 more.
  const partial = JSON.parse(run("fitness", "status", "--json").text);
  expect(partial.requirements).toHaveLength(64);
  expect(partial.requirements.filter((r: { status: string }) => r.status === "pass")).toHaveLength(1);
  expect(partial.requirements.filter((r: { status: string }) => r.status === "unverified")).toHaveLength(63);
  expect(run("fitness", "status").code).toBe(1);
  expect(run("audit", "--json").code).toBe(0);
  expect(run("audit", "--json", "--strict").code).toBe(2);
  expect(run("check", "--all").code).toBe(0);
  writeFileSync(source, domain.replace('if (!lines.length) throw new Error("empty order"); ', ""));
  expect(run("check", "--all").code).toBe(1);
  expect(run("fitness", "run", "CORE-INV-014").code).toBe(1);
  expect(run("check", "--all").text).toContain("CORE-INV-014");
  writeFileSync(source, domain);
  expect(run("fitness", "run", "CORE-INV-014").code).toBe(0);
  expect(run("check", "--all").code).toBe(0);
  writeFileSync(verifier, 'require("node:fs").writeFileSync("bypass.txt", "bypass");\n');
  expect(run("fitness", "run", "--all").text).toContain("nothing executed");
  expect(existsSync(join(root, "bypass.txt"))).toBe(false);
  expect(run("check", "--all").code).toBe(1);
}, 30000);

test("timeouts, source mutation and contract mutation during a verifier cannot produce passing evidence", () => {
  const root = join(area, "unstable-project");
  mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, ".pregate"));
  const env = { ...process.env, CI: "1", HOME: join(area, "unstable-home"), XDG_DATA_HOME: join(area, "unstable-data"), XDG_STATE_HOME: join(area, "unstable-state") };
  const run = (...args: string[]) => {
    const child = spawnSync(binary, args, { cwd: root, env, encoding: "utf8", timeout: 10000 });
    expect(child.error).toBeUndefined(); expect(child.signal).toBeNull();
    return { code: child.status, text: child.stdout };
  };
  const preset: Preset = { name: "unstable-verifier", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [],
    overrides: Object.fromEntries(Array.from({ length: 63 }, (_, i) => [`CORE-INV-${String(i + 2).padStart(3, "0")}`, "off" as const])),
    scope: { include: ["src/**"], exclude: [] }, fitness: {} };
  const verifier = join(root, "verify.ts");
  for (const [code, reason] of [
    ['Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);', "ETIMEDOUT"],
    ['import { writeFileSync } from "node:fs"; writeFileSync("src/value.txt", "mutated");', "inputs changed"],
    ['import { readFileSync, writeFileSync } from "node:fs"; const p=JSON.parse(readFileSync(".pregate/preset.json", "utf8")); p.name="changed"; writeFileSync(".pregate/preset.json", JSON.stringify(p));', "inputs changed"],
  ]) {
    writeFileSync(join(root, "src/value.txt"), "original"); writeFileSync(verifier, code!);
    preset.fitness = { "CORE-INV-001": { command: [process.execPath, verifier], inputs: ["verify.ts"], verificationHash: fitnessFingerprint(root, ["verify.ts"]), timeoutMs: 300, rationale: "Fixture checks unsuccessful evidence admission." } };
    const compiled = compile(JSON.stringify(preset), () => readTree("catalog", false), VERSIONS);
    if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
    writeFileSync(join(root, PRESET), JSON.stringify(preset)); writeFileSync(join(root, LOCK), compiled.text);
    const result = run("fitness", "run", "--all");
    expect(result.code).toBe(1);
    if (reason === "inputs changed" && code!.includes("p.name")) {
      expect(result.text).toContain("UNVERIFIED");
      expect(result.text).toContain("Contract or project inputs changed");
      expect(run("fitness", "status").text).toContain("lock-stale");
    }
    else {
      const status = JSON.parse(run("fitness", "status", "--json").text).requirements[0];
      expect(status.status).toBe("unverified"); expect(status.diagnostics).toContain(reason!);
    }
  }
}, 15000);
