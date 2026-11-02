// Run after building: production-binary incomplete Stop and subsequent repair, in isolated state.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runNative } from "./smoke-native-command.ts";
import { hostTarget } from "./build.ts";
import { smokeBinary } from "./smoke-binary.ts";
import { canonical } from "../src/disk.ts";

const area = realpathSync(mkdtempSync(join(tmpdir(), "pregate-stop-native-")));
const root = canonical(join(area, "repo"));
const binary = smokeBinary();
const env = { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"),
  XDG_STATE_HOME: join(area, "state"), CODEX_HOME: join(area, "codex"), GROK_HOME: join(area, "grok") };
function run(args: string[], input?: object) {
  return runNative({ binary, args, cwd: root, env, stdin: input === undefined ? undefined : JSON.stringify(input) });
}
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }
function stop(active: boolean) {
  return run(["hook", "stop", "--harness", "claude-code"], {
    cwd: root, session_id: "native-stop", hook_event_name: "Stop", stop_hook_active: active,
  });
}
try {
  mkdirSync(join(root, "src/core"), { recursive: true });
  const path = join(root, "src/core/a.ts");
  writeFileSync(path, "export const a = 1;\n");
  const init = run(["init", "--yes", "--preset", "functional-ts"]);
  assert(init.exitCode === 0, init.stdout.toString() + init.stderr.toString());
  const defaults = JSON.parse(run(["audit", "--json"]).stdout.toString());
  assert(defaults.fitness.length === 64 && defaults.fitness.every((r: { status: string }) => r.status === "unverified"), "Native onboarding must expose all 64 unverified core requirements");
  const isolated = run(["pack", "disable", "core/software-invariants", "--yes"]);
  assert(isolated.exitCode === 0, "Isolated Stop smoke requires an explicitly reviewed fitness override");
  assert(JSON.parse(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8")).enforcement === "shadow", "Init must preserve its shadow default");
  mkdirSync(join(root, ".pregate/requests"));
  writeFileSync(join(root, ".pregate/requests/enforce.json"), JSON.stringify({
    why: "Exercise explicitly approved enforcing policy in this isolated smoke project.",
    patch: [
      { op: "replace", path: "/enforcement", value: "enforce" },
      // Parameter growth is warn by default. This smoke checks that an enforcing denial still blocks.
      { op: "add", path: "/overrides", value: { "clean-code/CC-FN-002": { severity: "deny" } } },
    ],
  }));
  const approved = run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  assert(approved.exitCode === 0, approved.stdout.toString() + approved.stderr.toString());
  const lock = readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8");
  assert(JSON.parse(lock).enforcement === "enforce", "Smoke must exercise an active enforcing contract");
  const start = run(["hook", "session-start", "--harness", "claude-code"], {
    cwd: root, session_id: "native-stop", hook_event_name: "SessionStart",
  });
  assert(start.exitCode === 0, start.stdout.toString() + start.stderr.toString());
  writeFileSync(path, "export function wide(a: number, b: number, c: number, d: number, e: number, f: number) { return a; }\n");
  const first = stop(false);
  assert(first.exitCode === 2, "First Stop must block actual rule growth: " + first.stdout.toString() + first.stderr.toString());
  assert(stop(true).exitCode === 2, "Second Stop must still block");
  const released = stop(true);
  assert(released.exitCode === 0 && JSON.parse(released.stdout.toString()).systemMessage.includes("pregate report --json"), "Released Stop must explain how to inspect its recorded result");
  const reported = run(["report", "--json"]);
  const data = JSON.parse(reported.stdout.toString());
  assert(reported.exitCode === 0 && data.incompleteStops.length === 1, reported.stdout.toString());
  const completion = data.incompleteStops[0];
  assert(completion.reason === "limit" && completion.cause === null && completion.violations.some((v: { rule: string; path: string }) => v.rule === "clean-code/CC-FN-002" && v.path === "src/core/a.ts"), "Report lost the actual incomplete Stop findings");
  const denied = run(["check", "--all"]);
  assert(denied.exitCode === 1, `Released Stop must not whitewash the current tree (exit ${denied.exitCode}): ${denied.stdout}${denied.stderr}`);
  writeFileSync(path, "export const a = 1;\n");
  assert(run(["check", "--all"]).exitCode === 0 && stop(false).exitCode === 0, "Verified repair must pass both checks");
  const repaired = JSON.parse(run(["report", "--json"]).stdout.toString());
  assert(repaired.incompleteStops.length === 1, "Repair must preserve historical incomplete completion");
  assert(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8") === lock, "Stop or repair changed the contract");
  console.log(JSON.stringify({ target: hostTarget(), observed: "real rule growth; two blocking Stops followed by incomplete completion",
    report: "actual cause, session and finding locations retained", repair: "check --all and Stop pass; historical completion retained",
    interaction: "production protocol replay, actual UI not certified", github: "no publication" }));
} finally { rmSync(area, { recursive: true, force: true }); }
