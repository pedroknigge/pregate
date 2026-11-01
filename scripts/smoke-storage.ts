// Run after building: production-binary retention of a real recorded shadow observation.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hostTarget } from "./build.ts";
import { WINDOWS } from "../src/platform.ts";
import { smokeBinary } from "./smoke-binary.ts";
import { runNative } from "./smoke-native-command.ts";
import { H, sha256 } from "../src/state.ts";
import { canonical } from "../src/disk.ts";

const area = realpathSync(mkdtempSync(join(tmpdir(), "pregate-storage-native-")));
const root = canonical(join(area, "repo"));
const binary = smokeBinary();
const env = { ...process.env, CI: "1", HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"),
  XDG_STATE_HOME: join(area, "state"), CODEX_HOME: join(area, "codex"), GROK_HOME: join(area, "grok") };
function run(args: string[], input?: object, ci = "1") {
  return runNative({ binary, args, cwd: root, env: { ...env, CI: ci }, stdin: input === undefined ? undefined : JSON.stringify(input) });
}
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }
function checked(args: string[], input?: object) {
  const out = run(args, input);
  assert(out.exitCode === 0, out.stdout.toString() + out.stderr.toString());
  return out.stdout.toString();
}

async function abandoned(dir: string, kind: "writer" | "cleanup") {
  const source = 'import { withStateWrite, lockPrune } from ' + JSON.stringify(join(import.meta.dir, "../src/state-lease.ts"))
    + '; import { writeSync } from "node:fs"; const dir = ' + JSON.stringify(dir)
    + '; const hold = () => { writeSync(1, "ready"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30000); }; '
    + (kind === "writer" ? 'withStateWrite(dir, hold);' : 'const release = lockPrune(dir); hold(); release();');
  return await killedHolderPid(markerHolder(source));
}
function markerHolder(source: string) {
  return Bun.spawn([process.execPath, "-e", source], { stdout: "pipe", stderr: "pipe", timeout: 10000 });
}
async function killedHolderPid(child: ReturnType<typeof markerHolder>) {
  try {
    const ready = await child.stdout.getReader().read();
    assert(new TextDecoder().decode(ready.value) === "ready", "Cooperating source-helper process did not acquire its marker");
    child.kill(9); await child.exited;
    return child.pid;
  } finally { if (child.exitCode === null) { child.kill(9); await child.exited; } }
}
try {
  mkdirSync(join(root, "src"), { recursive: true });
  const baseline = "export const baseline = 1;\n";
  writeFileSync(join(root, "src/base.ts"), baseline);
  checked(["init", "--yes", "--preset", "legacy-safe"]);
  checked(["pack", "disable", "core/software-invariants", "--yes"]); // Isolate session storage from project fitness evidence.
  const lock = readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8");
  checked(["hook", "session-start"], { hook_event_name: "SessionStart", session_id: "native-retention", cwd: root, source: "startup" });
  const folder = join(area, "state/pregate/sessions", WINDOWS ? "claude-code~native-retention" : "claude-code:native-retention");
  const snapshotFile = join(folder, H(root), "snapshot.json"), snapshot = readFileSync(snapshotFile, "utf8");
  // A swallowed error is a deny rule; only a shadowed denial keeps a copy of the proposed source.
  const source = "export function load(read: () => string): string { let text = \"\"; try { text = read(); } catch {} return text; }\n";
  checked(["hook", "pre"], { hook_event_name: "PreToolUse", session_id: "native-retention", cwd: root, permission_mode: "default",
    tool_name: "Write", tool_use_id: "empty-catch", tool_input: { file_path: join(root, "src/a.ts"), content: source } });
  const findings = JSON.parse(checked(["feedback", "list", "--json"])).findings;
  assert(findings.length === 1 && findings[0].rule === "clean-code/CC-ER-002", "Expected one real recorded shadow observation");
  const before = JSON.parse(checked(["report", "--json"]));
  const inspection = JSON.parse(checked(["storage", "inspect", "--json"]));
  assert(inspection.sessions.length === 1 && inspection.sessions[0].events === 1, "Expected one recorded event");
  assert(existsSync(join(folder, "blobs", sha256(source))), "The proposed source was not stored");
  const days = Math.max(1, Date.now() - findings[0].at) / 2 / 86400000;
  const preview = checked(["storage", "prune", "--older-than", String(days), "--preview"]);
  const digest = /Digest: ([a-f0-9]{64})/.exec(preview)?.[1];
  assert(digest !== undefined && preview.includes("1 blobs"), "Expected a reviewed cleanup for one source copy");
  checked(["storage", "show", digest!]);
  assert(run(["storage", "apply", digest!]).exitCode === 1, "Unattended cleanup must refuse");
  assert(existsSync(join(folder, "blobs", sha256(source))), "Refused cleanup removed code");
  checked(["storage", "apply", digest!, "--yes"]);
  assert(!existsSync(join(folder, "blobs", sha256(source))), "Approved historical source was not removed");
  assert(existsSync(join(folder, "blobs", sha256(baseline))), "Cleanup removed the live baseline");
  assert(readFileSync(snapshotFile, "utf8") === snapshot, "Cleanup changed the resumable snapshot");
  assert(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8") === lock, "Cleanup changed the contract");
  const after = JSON.parse(checked(["report", "--json"]));
  assert(after.calls === before.calls && after.shadow === before.shadow && after.calibration.unlabeled === 1, "Cleanup changed recorded findings");
  checked(["hook", "stop"], { hook_event_name: "Stop", session_id: "native-retention", cwd: root, stop_hook_active: false });
  const recoveryBefore = JSON.parse(checked(["report", "--json"]));
  for (const kind of ["writer", "cleanup"] as const) {
    const pid = await abandoned(folder, kind);
    const data = JSON.parse(checked(["storage", "inspect", "--json"]));
    assert(data.sessions[0].markers.some((item: { pid: number; state: string }) => item.pid === pid && item.state === "dead"), "OS did not establish the killed owner's absence");
    const recovery = checked(["storage", "recover", "--preview"]), id = /Digest: ([a-f0-9]{64})/.exec(recovery)?.[1];
    assert(id !== undefined && recovery.includes("PID " + pid), "Expected exact recovery owner review");
    const ask = run(["hook", "pre"], { hook_event_name: "PreToolUse", session_id: "native-retention", cwd: root,
      permission_mode: "default", tool_name: "Bash", tool_use_id: "recover-" + kind,
      tool_input: { command: "pregate storage apply " + id + " --yes" } }, "");
    assert(ask.exitCode === 0 && JSON.parse(ask.stdout.toString()).hookSpecificOutput.permissionDecision === "ask", "Production recovery did not request native permission");
    assert(run(["storage", "apply", id!]).exitCode === 1, "Unattended recovery must refuse");
    checked(["storage", "apply", id!, "--yes"]);
  }
  const recovered = JSON.parse(checked(["report", "--json"]));
  assert(recovered.calls === recoveryBefore.calls && recovered.shadow === recoveryBefore.shadow, "Recovery changed recorded history");
  assert(readFileSync(snapshotFile, "utf8") === snapshot && existsSync(join(folder, "blobs", sha256(baseline))), "Recovery changed the live baseline");
  assert(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8") === lock, "Recovery changed the contract");
  checked(["hook", "stop"], { hook_event_name: "Stop", session_id: "native-retention", cwd: root, stop_hook_active: false });
  console.log(JSON.stringify({ target: hostTarget(), observed: "one real recorded shadow observation; short test retention window",
    approval: "unattended refused; explicit digest automation applied", removed: "one historical source copy",
    preserved: "live dirty-source baseline, snapshot bytes, contract bytes, report count and resumed Stop",
    recovery: "real killed source-helper writer/cleaner; production native permission requested; unattended refused; explicit digest applied", github: "no publication" }));
} finally { rmSync(area, { recursive: true, force: true }); }
