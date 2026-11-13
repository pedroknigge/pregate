import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { visible } from "./contract.ts";
import { canonical as canonicalJSON } from "./compile.ts";
import { canonical, findRoot, writeAtomic } from "./disk.ts";
import { fitnessResult, fitnessSummary, type ProjectFitness } from "./fitness.ts";
export type { ProjectFitness } from "./fitness.ts";
import { delegate, grammars, lockOf } from "./contract-diagnostic.ts";
import { PRESET } from "./admission.ts";
import { applyPreset } from "./approval-command.ts";
import { inScope, matches } from "./paths.ts";
import { H, sha256, stateDir } from "./state.ts";
import { contractState } from "./status.ts";
import { trackedWorkspacePaths, workspaceFile, workspacePaths } from "./workspace.ts";
import type { FitnessBinding, FitnessReceipt, Lock, Phase, Preset, Violation } from "./types.ts";
import { fitnessPlan, fitnessPlanText, fitnessTemplate } from "./fitness-plan.ts";
import { candidateRationale, FITNESS_CANDIDATES, readFitnessCandidates } from "./fitness-candidates.ts";

const MAX_INPUT_BYTES = 128 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
type InputRead = (rel: string) => Uint8Array | null;

function fitnessRules(lock: Lock, phase: Phase) {
  return lock.rules.filter((r) => r.phases.includes(phase) && !lock.ownedByArkgate.includes(r.id)
    && r.impl.kind === "primitive" && r.impl.primitive === "fitness");
}

function bindingOf(lock: Lock, verifier: string): FitnessBinding | undefined {
  return lock.fitness && Object.hasOwn(lock.fitness, verifier) ? lock.fitness[verifier] : undefined;
}

function receiptPath(root: string, hash: string, verifier: string): string {
  return join(stateDir(), "fitness", H(root), hash, `${H(verifier)}.json`);
}

// Hash the contracted scope plus explicitly declared verifier inputs. New/deleted files invalidate
// the proof too. Receipts never come from an agent-writable project file or from fixture metadata.
function inputHash(root: string, lock: Lock, binding: FitnessBinding, read?: InputRead, paths?: string[]): string {
  return fileHash(root, (rel) => inScope(lock, rel) || binding.inputs.some((glob) => matches(glob, rel)), read, paths);
}

export function fitnessFingerprint(root: string, inputs: string[], read?: InputRead, paths?: string[]): string {
  return fileHash(root, (rel) => inputs.some((glob) => matches(glob, rel)), read, paths);
}

function fileHash(root: string, selected: (rel: string) => boolean, read?: InputRead, paths?: string[]): string {
  let bytes = 0;
  const inventory = [...new Set(paths ?? workspacePaths(root, () => true))].sort();
  const tracked = new Set(inventory.some(rel => rel.split("/").includes("build")) ? trackedWorkspacePaths(root) : []);
  const hashes = inventory.filter((rel) => workspaceFile(rel, tracked.has(rel))
    && selected(rel)).map((rel) => {
    const text = read ? read(rel) : readFileSync(join(root, rel));
    if (text === null) throw new Error(`Fitness input disappeared: ${rel}`);
    bytes += Buffer.byteLength(text);
    if (bytes > MAX_INPUT_BYTES) throw new Error("Fitness input exceeds the 128 MiB budget; review project scope.");
    return [rel, sha256(Buffer.from(text).toString("base64"))];
  });
  if (!hashes.length) throw new Error("Fitness verification requires at least one current input file.");
  return sha256(canonicalJSON(hashes));
}

export function projectFitness(root: string, lock: Lock, phase: Phase, read?: InputRead, paths?: string[]): ProjectFitness[] {
  const contractHash = sha256(canonicalJSON(lock)), hashes = new Map<string, string>(), definitions = new Map<string, string>();
  const reviewedInputs = (binding: FitnessBinding, receipt: FitnessReceipt | null): { hash: string; error: string | null } => {
    try {
      const key = JSON.stringify(binding.inputs);
      paths ??= workspacePaths(root, () => true);
      const definition = definitions.get(key) ?? fitnessFingerprint(root, binding.inputs, read, paths);
      definitions.set(key, definition);
      if (definition !== binding.verificationHash) return { hash: "", error: "Verifier inputs changed since human review; propose and approve a new verificationHash." };
      if (!receipt) return { hash: "", error: null };
      const hash = hashes.get(key) ?? inputHash(root, lock, binding, read, paths);
      hashes.set(key, hash);
      return { hash, error: null };
    } catch (e) { return { hash: "", error: (e as Error).message }; }
  };
  return fitnessRules(lock, phase).map((rule) => {
    const verifier = String(rule.params.verifier ?? ""), binding = bindingOf(lock, verifier);
    const path = receiptPath(root, contractHash, verifier);
    let receipt: FitnessReceipt | null = null, hash = "", error: string | null = null;
    if (binding && existsSync(path)) ({ receipt, error } = storedReceipt(path));
    if (binding && error === null) ({ hash, error } = reviewedInputs(binding, receipt));
    const requirement = rule.impl.kind === "primitive" && rule.impl.primitive === "fitness" ? rule.impl.requirement : rule.id;
    return { rule: rule.id, requirement, statement: rule.text.why, fixHint: rule.text.fix,
      verifier, rationale: binding?.rationale ?? null, inputs: binding?.inputs ?? [],
      ...(typeof receipt?.diagnostics === "string" ? { diagnostics: receipt.diagnostics } : {}),
      ...(error === null ? fitnessResult(verifier, binding, receipt, { contractHash, inputHash: hash, now: Date.now() })
        : { status: "unverified" as const, reason: error }) };
  });
}

function storedReceipt(path: string): { receipt: FitnessReceipt | null; error: string | null } {
  try { return { receipt: JSON.parse(readFileSync(path, "utf8")), error: null }; }
  catch (e) { return { receipt: null, error: `Cannot read fitness evidence: ${(e as Error).message}` }; }
}

export function fitnessViolations(lock: Lock, results: ProjectFitness[]): Violation[] {
  // An unbound requirement is a coverage gap. A reviewed binding is an adopted
  // project assertion: its missing, stale or failed evidence must still block.
  return results.filter((r) => r.status !== "pass" && bindingOf(lock, r.verifier)).map((result) => ({ rule: result.rule,
    path: ".pregate/preset.json", line: 1, symbol: `<${result.status}: ${result.reason}>`,
    measured: null, limit: null, atSessionStart: null, severity: lock.rules.find((r) => r.id === result.rule)!.severity }));
}

export async function fitness(args: string[]): Promise<{ code: number; text: string }> {
  try {
    const [sub, ...rest] = args;
    if (sub === "bind") return await bindFitness(rest);
    if (sub === "fingerprint") {
      if (!rest.length || rest.some((glob) => !glob || glob.startsWith("--"))) return { code: 1, text: "usage: pregate fitness fingerprint <glob...>" };
      const root = findRoot(canonical(process.cwd()), () => true) ?? canonical(process.cwd());
      return { code: 0, text: fitnessFingerprint(root, rest) };
    }
    const options = sub === "plan" ? planOptions(rest) : null;
    if (sub === "plan" ? options === null : !["run", "status"].includes(sub ?? "") || (sub !== "run" ? rest.length !== 0 && (rest.length !== 1 || rest[0] !== "--json")
      : rest.length !== 1 || rest[0] === "--json")) return { code: 1, text: "usage: pregate fitness status [--json] | run <verifier|--all> | plan [--candidates <project-file>] [--json] | plan --template [--auto]" };
    const root = findRoot(canonical(process.cwd()), () => true);
    if (!root) return { code: 1, text: "Fitness verification requires an established project contract." };
    const delegated = delegate(root, ["fitness", ...args]);
    if (delegated !== null) return delegated;
    const loaded = lockOf(root);
    if (typeof loaded === "string") return { code: 1, text: `Fitness verification unavailable: ${loaded}.` };
    const current = contractState(root);
    if (!current.valid) return { code: 1, text: `Fitness verification unavailable: ${current.errors.join("\n")}` };
    const lock = loaded.lock;
    if (sub === "run") {
      const error = runSelectedVerifiers(root, lock, rest[0]!, loaded.hash);
      if (error !== null) return { code: 1, text: error };
    }
    const results = projectFitness(root, lock, "ci");
    if (sub === "plan") {
      const paths = workspacePaths(root, () => true), path = options!.path ?? FITNESS_CANDIDATES;
      if (options!.template) return { code: 0, text: JSON.stringify(fitnessTemplate(lock, results, paths, options!.auto), null, 2) };
      const manifest = options!.path !== null || existsSync(join(root, path)) ? readFitnessCandidates(root, path, lock, paths) : null;
      const plan = fitnessPlan(lock, results, paths, manifest);
      return { code: 0, text: options!.json ? JSON.stringify(plan, null, 2) : visible(fitnessPlanText(plan)) };
    }
    const summary = fitnessSummary(results);
    const text = rest.includes("--json") ? JSON.stringify({ summary, requirements: results }, null, 2)
      : [`Fitness evidence: ${summary.passing} adopted assertions passing; ${summary.failed} failed; ${summary.needsEvidence} adopted without current evidence; ${summary.unbound} unbound requirements.`,
        ...results.map((r) => `${r.rule}: ${r.status.toUpperCase()} — ${r.reason}${r.rationale ? `\n  Reviewed rationale: ${r.rationale}` : ""}${r.status !== "pass" && r.diagnostics ? `\n${r.diagnostics}` : ""}`)].join("\n");
    const selected = sub === "run" ? results.filter((r) => bindingOf(lock, r.verifier) && (rest[0] === "--all" || r.verifier === rest[0])) : results;
    return { code: (sub === "run" && selected.length === 0) || selected.some((r) => r.status !== "pass") ? 1 : 0,
      text: rest.includes("--json") ? text : visible(text || "No project fitness requirements are active.") };
  } catch (e) { return { code: 1, text: `Fitness verification incomplete: ${visible((e as Error).message)}` }; }
}

function planOptions(args: string[]) {
  const options = { json: false, template: false, auto: false, path: null as string | null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json" && !options.json) options.json = true;
    else if (args[i] === "--template" && !options.template) options.template = true;
    else if (args[i] === "--auto" && !options.auto) options.auto = true;
    else if (args[i] === "--candidates" && options.path === null && args[i + 1] && !args[i + 1]!.startsWith("--")) options.path = args[++i]!;
    else return null;
  }
  return options.template && options.path !== null ? null : options;
}

async function bindFitness(args: string[]): Promise<{ code: number; text: string }> {
  if (args[0] === "--candidates") return bindCandidates(args);
  const usage = "usage: pregate fitness bind <rule-id[,rule-id]> --command-json <argv-array> --inputs <glob,glob> --rationale <text> [--timeout-ms <n>] [--max-age-ms <n>] --preview";
  const [id, ...rest] = args, options = new Map<string, string>();
  if (!id || !rest.includes("--preview") || rest.filter(a => a === "--preview").length !== 1) return { code: 1, text: usage };
  const flags = rest.filter(a => a !== "--preview");
  for (let i = 0; i < flags.length; i += 2) {
    const key = flags[i]!, value = flags[i + 1];
    if (!["--command-json", "--inputs", "--rationale", "--timeout-ms", "--max-age-ms"].includes(key) || value === undefined || options.has(key)) return { code: 1, text: usage };
    options.set(key, value);
  }
  if (!["--command-json", "--inputs", "--rationale"].every(key => options.has(key))) return { code: 1, text: usage };
  const root = findRoot(canonical(process.cwd()), () => true);
  if (!root) return { code: 1, text: "Fitness binding requires an established project contract." };
  const loaded = lockOf(root);
  if (typeof loaded === "string" || !contractState(root).valid) return { code: 1, text: "Review pregate update --project --preview before binding an invalid or old contract." };
  const ids = id.split(",");
  const rules = ids.map(id => fitnessRules(loaded.lock, "ci").find(rule => rule.id === id || rule.id === `core/${id}`));
  if (ids.length > 256 || rules.some(rule => !rule) || new Set(rules.map(rule => rule?.id)).size !== rules.length) return { code: 1, text: "Select distinct active fitness rules from pregate fitness plan --json. Nothing bound." };
  const inputs = options.get("--inputs")!.split(","), command: unknown = JSON.parse(options.get("--command-json")!);
  if (!Array.isArray(command) || !command.length || command.some(a => typeof a !== "string" || !a) || inputs.some(a => !a)) return { code: 1, text: usage };
  const binding: FitnessBinding = { command, inputs, verificationHash: fitnessFingerprint(root, inputs),
    timeoutMs: Number(options.get("--timeout-ms") ?? "30000"), rationale: options.get("--rationale")!,
    ...(options.has("--max-age-ms") ? { maxAgeMs: Number(options.get("--max-age-ms")) } : {}) };
  const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8")) as Preset;
  preset.fitness = { ...preset.fitness, ...Object.fromEntries(rules.map(rule => [String(rule!.params.verifier), binding])) };
  await grammars();
  return applyPreset(root, JSON.stringify(preset, null, 2) + "\n", { preview: true });
}

async function bindCandidates(args: string[]): Promise<{ code: number; text: string }> {
  const usage = "usage: pregate fitness bind --candidates <project-file> [--only <assertion-id[,assertion-id]>] --preview";
  if (args.filter(arg => arg === "--preview").length !== 1) return { code: 1, text: usage };
  const flags = args.filter(arg => arg !== "--preview");
  if (![2, 4].includes(flags.length) || flags[0] !== "--candidates" || !flags[1] || flags[1].startsWith("--") || (flags.length === 4 && flags[2] !== "--only")) return { code: 1, text: usage };
  const root = findRoot(canonical(process.cwd()), () => true);
  if (!root) return { code: 1, text: "Fitness binding requires an established project contract." };
  const loaded = lockOf(root);
  if (typeof loaded === "string" || !contractState(root).valid) return { code: 1, text: "Review pregate update --project --preview before binding an invalid or old contract." };
  const manifest = readFitnessCandidates(root, flags[1], loaded.lock, workspacePaths(root, () => true));
  const ids = flags.length === 4 ? flags[3]!.split(",") : manifest.assertions.map(assertion => assertion.id);
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !manifest.assertions.some(assertion => assertion.id === id))) return { code: 1, text: "Select distinct authored assertion IDs from fitness plan --json. Nothing bound." };
  const selected = manifest.assertions.filter(assertion => ids.includes(assertion.id));
  const partial = selected.flatMap(assertion => assertion.claims.filter(claim => claim.coverage === "partial").map(claim => claim.rule));
  if (partial.length) return { code: 1, text: `Partial assertions cannot establish the complete requirement: ${partial.join(", ")}. Keep them in the plan, complete every applicable condition or select other complete assertions with --only. Nothing bound.` };
  const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8")) as Preset;
  const bindings = selected.flatMap(assertion => {
    const binding = { command: assertion.command, inputs: assertion.inputs, timeoutMs: assertion.timeoutMs,
      verificationHash: fitnessFingerprint(root, assertion.inputs), ...(assertion.maxAgeMs === undefined ? {} : { maxAgeMs: assertion.maxAgeMs }) };
    return assertion.claims.map(claim => [claim.verifier, { ...binding, rationale: candidateRationale(assertion, claim.conditions) }] as const);
  });
  if (readFileSync(join(root, manifest.path), "utf8") !== manifest.text) return { code: 1, text: "Fitness candidate file changed during preview. Nothing bound; inspect the current assertions." };
  const next = { ...preset.fitness, ...Object.fromEntries(bindings) };
  if (canonicalJSON(preset.fitness ?? {}) === canonicalJSON(next)) return { code: 0, text: "Selected fitness bindings already match the reviewed contract. Nothing proposed or executed; inspect fitness status and run adopted verifiers when evidence is stale." };
  preset.fitness = next;
  await grammars();
  return applyPreset(root, JSON.stringify(preset, null, 2) + "\n", { preview: true });
}

function runSelectedVerifiers(root: string, lock: Lock, selection: string, lockHash: string): string | null {
  const selected = selection === "--all" ? [...new Set(fitnessRules(lock, "ci").map((r) => String(r.params.verifier ?? "")))].filter((name) => bindingOf(lock, name)) : [selection];
  const missing = selected.filter((name) => !name || !bindingOf(lock, name));
  if (!selected.length || missing.length) return "No reviewed fitness binding for one or more selected requirements. Propose bindings in the preset and obtain human contract approval; nothing executed.";
  const definitions = new Map<string, string>(), paths = workspacePaths(root, () => true);
  if (selected.some((name) => {
    const binding = bindingOf(lock, name)!;
    const key = JSON.stringify(binding.inputs), hash = definitions.get(key) ?? fitnessFingerprint(root, binding.inputs, undefined, paths);
    definitions.set(key, hash);
    return hash !== binding.verificationHash;
  })) return "Verifier inputs changed since human review. Review the verifier and approve its new verificationHash before execution; nothing executed.";
  const groups = new Map<string, string[]>();
  for (const verifier of selected) {
    const binding = bindingOf(lock, verifier)!;
    const key = JSON.stringify([binding.command, binding.inputs, binding.timeoutMs]);
    groups.set(key, [...(groups.get(key) ?? []), verifier]);
  }
  for (const verifiers of groups.values()) {
    runVerifier(root, lock, verifiers, lockHash);
    if (!contractState(root).valid) break; // Do not start further commands under a changed contract.
  }
  return null;
}

function runVerifier(root: string, lock: Lock, verifiers: string[], lockHash: string): void {
  const verifier = verifiers[0]!, binding = bindingOf(lock, verifier)!, contractHash = sha256(canonicalJSON(lock));
  const before = inputHash(root, lock, binding), receiptFile = receiptPath(root, contractHash, verifier);
  mkdirSync(dirname(receiptFile), { recursive: true });
  const child = (require("node:child_process") as typeof import("node:child_process")).spawnSync(binding.command[0]!, binding.command.slice(1), { cwd: root, env: process.env,
    stdio: ["ignore", "pipe", "pipe"], timeout: binding.timeoutMs, killSignal: "SIGKILL", maxBuffer: MAX_OUTPUT_BYTES });
  const output = { stdout: child.stdout ?? Buffer.alloc(0), stderr: child.stderr ?? Buffer.alloc(0) };
  const active = lockOf(root);
  const unchanged = before === inputHash(root, lock, binding) && fitnessFingerprint(root, binding.inputs) === binding.verificationHash
    && typeof active !== "string" && active.hash === lockHash
    && contractState(root).valid;
  const bounded = (child.error as NodeJS.ErrnoException | undefined)?.code !== "ENOBUFS"
    && Object.values(output).every((bytes) => bytes.length <= MAX_OUTPUT_BYTES);
  const receipt: FitnessReceipt = { schemaVersion: 1, contractHash, inputHash: before, verifier, command: binding.command,
    exitCode: child.status, completed: !child.error && child.signal === null && unchanged && bounded, recordedAt: new Date().toISOString(),
    ...(!unchanged || !bounded || child.error || child.signal || child.status !== 0 ? { diagnostics: [
      ...(child.error ? [child.error.message] : []), ...(!unchanged ? ["Contract or project inputs changed during verification."] : []),
      ...(!bounded ? ["Command output exceeds the 16 MiB per-channel budget."] : []),
      ...Object.entries(output).map(([name, bytes]) => `${name} (first 4096 bytes):\n${bytes.subarray(0, 4096).toString("utf8")}`),
    ].join("\n") } : {}) };
  for (const name of verifiers) writeAtomic(receiptPath(root, contractHash, name), canonicalJSON({ ...receipt, verifier: name }));
}
