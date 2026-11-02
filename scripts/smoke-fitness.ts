// Exercise a reviewed, bounded domain invariant with the exact packaged engine.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runNative } from "./smoke-native-command.ts";
import { smokeBinary } from "./smoke-binary.ts";
import { hostTarget } from "./build.ts";

const area = mkdtempSync(join(tmpdir(), "pregate-fitness-native-"));
const root = join(area, "repo"), binary = smokeBinary();
const env = { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state") };
function run(args: string[]) { return runNative({ binary, args, cwd: root, env }); }
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }
const domain = 'exports.ship = (lines) => { if (lines.length === 0) throw new Error("An order needs lines"); return { state: "shipped", lines: [...lines] }; };\n';
try {
  mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, "quality"));
  writeFileSync(join(root, "src/order.cjs"), domain);
  writeFileSync(join(root, "quality/verify.cjs"), 'const assert = require("node:assert/strict"); const { ship } = require("../src/order.cjs");\nassert.throws(() => ship([]), /needs lines/); assert.equal(ship(["line"]).state, "shipped");\n');
  const initialized = run(["init", "--yes", "--preset", "integrity-only"]);
  assert(initialized.exitCode === 0, initialized.stdout.toString() + initialized.stderr.toString());
  // --strict: unverified requirements keep audit at exit 2 (incomplete); the default exit only tracks blocking findings.
  const before = run(["audit", "--json", "--strict"]), defaults = JSON.parse(before.stdout.toString());
  assert(before.exitCode === 2 && defaults.fitness.length === 64 && defaults.fitness.every((r: { status: string }) => r.status === "unverified"), "All 64 core requirements must default to unverified, never a fabricated pass");
  const presetPath = join(root, ".pregate/preset.json"), preset = JSON.parse(readFileSync(presetPath, "utf8"));
  const lock = JSON.parse(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8"));
  assert(lock.rules.filter((r: { integrity: boolean; enforcement: string }) => r.integrity && r.enforcement === "enforce").length === 68, "The packaged engine must activate all 68 core rules");
  const initialCheck = run(["check", "--all"]);
  // check no longer repeats the UNVERIFIED notice; audit above keeps all 64 visible.
  assert(initialCheck.exitCode === 0 && !initialCheck.stdout.toString().includes("UNVERIFIED"), "Unbound requirements must not block onboarding or repeat on every check");
  const fingerprint = run(["fitness", "fingerprint", "quality/verify.cjs"]);
  assert(fingerprint.exitCode === 0 && /^[a-f0-9]{64}$/.test(fingerprint.stdout.toString().trim()), "Native verifier fingerprint missing");
  const fitness = { "CORE-INV-014": { command: [process.execPath, "quality/verify.cjs"], inputs: ["quality/verify.cjs"], verificationHash: fingerprint.stdout.toString().trim(), timeoutMs: 1000,
    rationale: "Checks only the order shipping construction invariant: an empty order cannot become shipped. Other requirements remain active and unverified." } };
  const request = join(root, ".pregate/fitness-smoke-request.json");
  writeFileSync(request, JSON.stringify({ why: "Adopt one meaningful domain assertion while keeping all 64 requirements active; do not claim other requirements were verified.",
    patch: [ { op: Object.hasOwn(preset, "fitness") ? "replace" : "add", path: "/fitness", value: fitness } ] }));
  const accepted = run(["preset", "apply", request, "--yes"]);
  assert(accepted.exitCode === 0, accepted.stdout.toString() + accepted.stderr.toString());
  assert(run(["check", "--all"]).exitCode === 1, "A reviewed binding must require fresh evidence");
  assert(run(["fitness", "run", "--all"]).exitCode === 0, "A verified valid order implementation must pass");
  const current = JSON.parse(run(["fitness", "status", "--json"]).stdout.toString());
  assert(current.requirements.length === 64 && current.requirements.filter((r: { status: string }) => r.status === "pass").length === 1
    && current.requirements.find((r: { requirement: string }) => r.requirement === "CORE-INV-014").status === "pass", "Only the adopted requirement may have passing evidence; all 64 must stay active");
  assert(run(["check", "--all"]).exitCode === 0 && run(["audit", "--json", "--strict"]).exitCode === 2, "Passing one adopted assertion must allow work while audit retains incomplete coverage");
  writeFileSync(join(root, "src/order.cjs"), domain.replace('if (lines.length === 0) throw new Error("An order needs lines"); ', ""));
  assert(run(["fitness", "status"]).exitCode === 1, "Source edits must invalidate evidence");
  assert(run(["fitness", "run", "--all"]).exitCode === 1, "Shipping an empty order must fail the actual verifier");
  const failed = run(["audit", "--json", "--strict"]);
  assert(failed.exitCode === 2 && JSON.parse(failed.stdout.toString()).fitness.find((r: { requirement: string }) => r.requirement === "CORE-INV-014").status === "fail", "Incomplete audit must retain the failed domain assertion");
  assert(run(["check", "--all"]).exitCode === 1, "An adopted assertion failure must block work");
  writeFileSync(join(root, "src/order.cjs"), domain);
  assert(run(["fitness", "run", "--all"]).exitCode === 0, "Repair must restore passing evidence");
  writeFileSync(join(root, "quality/verify.cjs"), 'require("node:fs").writeFileSync("executed.txt", "bypass"); process.exit(0);\n');
  const tampered = run(["fitness", "run", "--all"]);
  assert(tampered.exitCode === 1 && tampered.stdout.toString().includes("nothing executed") && !existsSync(join(root, "executed.txt")), "An unreviewed verifier change must not execute or establish evidence");
  assert(run(["check", "--all"]).exitCode === 1, "Changed verifier definitions must leave the project blocked");
  console.log(JSON.stringify({ target: hostTarget(), defaults: "68 enforcing core rules; 64 explicitly unverified", boundedAssertion: "empty orders cannot ship; one reviewed requirement, 63 active unverified requirements",
    observed: "real assertion failure, stale source evidence, verified repair and verifier tampering refused", semanticCoverage: "this order invariant only; other requirements are not certified", publication: "none" }));
} finally { rmSync(area, { recursive: true, force: true }); }
