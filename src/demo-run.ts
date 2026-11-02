import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sha256 } from "./state.ts";
import { VERSIONS } from "./versions.ts";
import { enforcementOf } from "./enforcement.ts";
import type { Lock } from "./types.ts";
import type { DemoSample } from "./demo-samples.ts";

export interface DemoReceipt { phase: string; args: string[]; code: number | null; stdoutHash: string; stderrHash: string }
export interface DemoContext {
  area: string; root: string; env: Record<string, string>; binary: string; launcher: string;
  receipts: DemoReceipt[]; git: string; native: { python: string | null; go: string | null; rust: string | null };
}

export function demoProcess(c: DemoContext, phase: string, executable: string, args: string[], input?: string, timeout = 30_000) {
  const out = Bun.spawnSync([executable, ...args], { cwd: c.root, env: c.env, stdin: input === undefined ? "ignore" : new TextEncoder().encode(input),
    stdout: "pipe", stderr: "pipe", timeout });
  const stdout = out.stdout.toString(), stderr = out.stderr.toString();
  c.receipts.push({ phase, args: args.map(arg => arg.replaceAll(c.area, "<owned-demo>")), code: out.exitCode, stdoutHash: sha256(stdout), stderrHash: sha256(stderr) });
  return { code: out.exitCode, stdout, stderr };
}

export function demoAssert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cli(c: DemoContext, phase: string, args: string[], input?: string) {
  return demoProcess(c, phase, c.binary, args, input);
}

export function demoPrepare(c: DemoContext, sample: DemoSample) {
  const version = cli(c, "binary-identity", ["--version"]);
  demoAssert(version.code === 0 && version.stdout.trim() === `pregate ${VERSIONS.engine} (core ${VERSIONS.core})`, "Demo requires the compiled binary of this engine/core version.");
  for (const [file, text] of Object.entries(sample.files)) {
    mkdirSync(dirname(join(c.root, file)), { recursive: true }); writeFileSync(join(c.root, file), text);
  }
  for (const args of [["init", "-q", "--template", join(c.area, "empty-template")], ["add", "--all"],
    ["-c", "user.name=PREGATE demo", "-c", "user.email=demo@example.invalid", "commit", "-qm", "Existing sample debt"]]) {
    const out = demoProcess(c, "git-baseline", c.git, args);
    demoAssert(out.code === 0, "Git could not create the isolated demo baseline.");
  }
  demoAssert(cli(c, "isolated-setup", ["setup"]).code === 0, "Isolated launcher setup failed.");
  const initial = cli(c, "initial-preview", ["init", "--preset", `${sample.language}-starter`, "--preview"]);
  demoApprove(c, initial);
  const preset = JSON.parse(readFileSync(join(c.root, ".pregate/preset.json"), "utf8"));
  const request = { why: "Demo: explicitly forbid domain-to-infrastructure imports and freeze existing debt.", patch: [
    { op: "add", path: "/methodologies", value: [...preset.methodologies, `${sample.language}/architecture`] },
    { op: "add", path: "/enforcement", value: "shadow" }, { op: "add", path: "/ratchet", value: { mode: "no-new" } },
    { op: "add", path: "/overrides", value: { ...preset.overrides, [sample.rule]: { enforcement: "enforce" } } },
    { op: "add", path: "/generatedMarkers", value: ["@generated", "DO NOT EDIT"] },
    { op: "add", path: "/layers", value: {
      domain: { paths: [`${sample.folder}/domain/**`], mayImport: [], kind: "core" },
      infra: { paths: [`${sample.folder}/infra/**`], mayImport: ["domain"], kind: "adapter" },
      main: { paths: ["src/lib.rs"], mayImport: ["*"], kind: "main" },
    } },
  ] };
  writeFileSync(join(c.root, "demo-request.json"), JSON.stringify(request));
  demoApprove(c, cli(c, "boundary-preview", ["preset", "apply", "demo-request.json", "--preview"]));
  const consent = JSON.parse(cli(c, "consent-status", ["status", "--json"]).stdout);
  demoAssert(consent.consent === true, "Owned sample consent was not activated.");
  const lock: Lock = JSON.parse(readFileSync(join(c.root, ".pregate/pregate.lock.json"), "utf8"));
  demoAssert(lock.rules.some(rule => rule.id === sample.rule && enforcementOf(lock, rule) === "enforce"), "Demo architecture rule is not enforced.");
  demoAssert(lock.rules.filter(rule => rule.id.startsWith(sample.language + "/") && rule.id !== sample.rule)
    .every(rule => enforcementOf(lock, rule) === "shadow"), "Demo quality policies must remain in shadow.");
  return { architecture: "enforce", quality: "shadow", core: "enforce" };
}

function demoApprove(c: DemoContext, preview: ReturnType<typeof cli>): void {
  demoAssert(preview.code === 0, "The isolated sample contract preview failed.");
  const digests = [...preview.stdout.matchAll(/Digest: ([0-9a-f]{64})/g)];
  demoAssert(digests.length === 1, "Sample preview did not produce exactly one review digest.");
  demoAssert(cli(c, "owned-sample-approval", ["approve", "--yes", "--digest", digests[0]![1]!]).code === 0, "Owned sample approval failed.");
}

export function demoWrite(c: DemoContext, path: string, text: string, call: string) {
  const payload = { session_id: "pregate-owned-demo", prompt_id: call, cwd: c.root, permission_mode: "acceptEdits",
    hook_event_name: "PreToolUse", tool_name: "Write", tool_use_id: call, tool_input: { file_path: join(c.root, path), content: text } };
  const before = readFileSync(join(c.root, path), "utf8");
  const out = demoProcess(c, call, c.launcher, ["hook", "pre", "--harness", "claude-code"], JSON.stringify(payload));
  demoAssert(readFileSync(join(c.root, path), "utf8") === before, "The hook unexpectedly wrote the sample source file.");
  const response = out.stdout.trim() ? JSON.parse(out.stdout) : {};
  return { ...out, decision: response.hookSpecificOutput?.permissionDecision ?? "none", beforeWrite: true };
}

export function demoAudit(c: DemoContext, rule: string) {
  // --strict keeps the complete-compliance code: missing fitness evidence still reports 2.
  const out = cli(c, "whole-tree-audit", ["audit", "--json", "--strict"]);
  const result = JSON.parse(out.stdout);
  demoAssert(out.code === 2 && result.errors.length === 0 && result.uncovered.length === 0, "Sample audit was incomplete for a reason other than missing fitness evidence.");
  return { debt: result.findings.filter((f: { rule: string }) => f.rule === rule).length,
    unverified: result.fitness.filter((f: { status: string }) => f.status === "unverified").length };
}

export function demoCase(c: DemoContext, sample: DemoSample) {
  const policy = demoPrepare(c, sample);
  const baseline = demoAudit(c, sample.rule);
  demoAssert(baseline.debt > 0 && baseline.unverified > 0, "The demo must retain real brownfield debt and unverified core obligations.");
  const nativeBaseline = demoNative(c, sample, "baseline");
  const unchanged = demoWrite(c, sample.legacy, sample.files[sample.legacy]!, "existing-debt");
  demoAssert(unchanged.code === 0 && unchanged.decision === "none", "The no-new ratchet rejected unchanged existing debt.");
  const bad = demoWrite(c, sample.target, sample.bad, "new-boundary-violation");
  demoAssert(bad.code === 2 && bad.decision === "deny" && bad.stderr.includes(sample.rule), "A new forbidden dependency was not denied by the selected architecture rule.");
  const nativeProposed = demoNativeProposal(c, sample);
  const syntax = demoWrite(c, sample.target, sample.syntax, "invalid-syntax");
  demoAssert(syntax.code === 2 && syntax.decision === "deny" && syntax.stderr.includes("syntax"), "Invalid syntax was not denied.");
  const marker = demoWrite(c, sample.target, `${sample.language === "python" ? "#" : "//"} @generated\n${sample.repair}`, "new-generated-marker");
  demoAssert(marker.code === 2 && marker.decision === "deny" && marker.stderr.includes("core/EVA-GEN-001"), "A new generated marker bypassed the integrity guard.");
  const literal = demoWrite(c, sample.target, sample.repair + {
    python: '\nNOTE = "@generated"\n', go: '\nconst note = "@generated"\n', rust: '\nconst NOTE: &str = "@generated";\n',
  }[sample.language], "marker-in-string");
  demoAssert(literal.code === 0 && literal.decision === "none", "A marker inside a string was incorrectly treated as a generated comment.");
  const repair = demoWrite(c, sample.target, sample.repair, "valid-repair");
  demoAssert(repair.code === 0 && repair.decision === "none", "A valid repair was rejected.");
  writeFileSync(join(c.root, sample.target), sample.repair);
  const repeat = demoWrite(c, sample.target, sample.repair, "repeat-repair");
  demoAssert(repeat.code === 0 && repeat.decision === "none", "Repeating an accepted repair was not a no-op.");
  const repaired = demoAudit(c, sample.rule);
  demoAssert(repaired.debt === baseline.debt && repaired.unverified === baseline.unverified, "Repair changed the unrelated baseline debt or certified unverified obligations.");
  const debtRepair = demoWrite(c, sample.legacy, sample.debtRepair, "existing-debt-repair");
  demoAssert(debtRepair.code === 0 && debtRepair.decision === "none", "The existing debt repair was rejected.");
  writeFileSync(join(c.root, sample.legacy), sample.debtRepair);
  const final = demoAudit(c, sample.rule);
  demoAssert(final.debt === 0 && final.unverified === baseline.unverified, "The final audit failed to distinguish repaired static debt from unverified obligations.");
  return { language: sample.language, rule: sample.rule, policy, baseline, newEdit: { decision: bad.decision, beforeWrite: bad.beforeWrite },
    syntax: { decision: syntax.decision }, marker: { decision: marker.decision, stringDecision: literal.decision }, repair: { decision: repair.decision, appliedAfterGate: true, repeated: repeat.decision }, final,
    native: { baseline: nativeBaseline, proposedInSeparateCopy: nativeProposed, repaired: demoNative(c, sample, "repair") }, receipts: c.receipts };
}

function demoNativeProposal(c: DemoContext, sample: DemoSample) {
  const root = join(c.area, sample.language + "-native-proposal");
  for (const [path, text] of Object.entries(sample.files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text);
  }
  writeFileSync(join(root, sample.target), sample.bad);
  return demoNative({ ...c, root }, sample, "proposed");
}

function demoNative(c: DemoContext, sample: DemoSample, phase: string) {
  const tool = c.native[sample.language];
  if (tool === null) return { status: "not-verified", reason: `${sample.language} native tool is not available on PATH.` };
  const version = demoProcess(c, `native-${phase}-version`, tool, [sample.language === "go" ? "version" : "--version"]);
  let args = sample.language === "python" ? ["-B", "-m", "unittest", "discover", "-s", "tests"] : ["test", "./..."];
  c.env.PREGATE_DEMO_EXPECTED_TOTAL = phase === "baseline" ? "10" : "11";
  if (sample.language === "rust") args = ["--edition=2021", "--test", "src/lib.rs", ...(phase !== "baseline" ? ["--cfg", "demo_repair"] : []), "-o", join(c.area, "rust-tests")];
  // A cold GOCACHE compiles the standard library before go test prints anything. On a Windows
  // runner that exceeds the 30s hang limit used for pregate and git commands.
  const run = demoProcess(c, `native-${phase}-tests`, tool, args, undefined, sample.language === "go" ? 90_000 : 30_000);
  demoAssert(version.code === 0 && run.code === 0, `The own ${sample.language} sample failed native verification.`);
  if (sample.language === "rust") demoAssert(demoProcess(c, `native-${phase}-test-executable`, join(c.area, "rust-tests"), []).code === 0, "Owned Rust tests failed.");
  return { status: "passed", version: version.stdout.trim(), command: args.map(arg => arg.startsWith(c.area) ? "<owned-output>" : arg) };
}
