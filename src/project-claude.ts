import { slash } from "./paths.ts";
import { ENGINE_VERSION } from "./product.ts";
import { sharedClaudeMatcher } from "./register.ts";
import { isObject, parse, type Payload } from "./harness/wire.ts";
import { commandScript, powershellCommand } from "./windows-command.ts";
import { WINDOWS } from "./platform.ts";
import type { HookKind } from "./types.ts";

// Repository-owned Claude Code hooks. They name the project launcher and never a launcher on PATH
// or under <DATA>/bin. Policy consent and Claude's workspace trust are not written here.

type Sub = HookKind;
const EVENTS = ["PreToolUse", "Stop", "SubagentStop", "SessionStart"] as const;

export function projectLauncherRel(windows = WINDOWS): string[] {
  return windows ? [".pregate/bin/project-launcher.ps1", ".pregate/bin/pregate.cmd"] : [".pregate/bin/pregate"];
}

// The command Claude runs. A missing launcher denies. It does not exec `pregate` from PATH.
export function projectHookCommand(sub: Sub, windows = WINDOWS): string {
  if (windows) return windowsProjectHook(sub);
  const run = `f="\${CLAUDE_PROJECT_DIR:-$PWD}/.pregate/bin/pregate"; [ -x "$f" ] && [ -s "$f" ] && exec "$f" hook ${sub} --harness claude-code; `;
  if (sub === "session-start") return `${run}printf '%s\\n' '{"systemMessage":"PREGATE could not prepare this session: the project launcher is missing. Run pregate project launcher."}'; exit 0`;
  if (sub === "stop") return `${run}printf '%s\\n' '{"decision":"block","reason":"PREGATE could not verify this turn: the project launcher is missing; run pregate project launcher"}'; exit 2`;
  return `${run}printf '%s\\n' 'PREGATE could not evaluate: the project launcher is missing; run pregate project launcher; report it to the user' >&2; exit 2`;
}

function windowsProjectHook(sub: Sub): string {
  const missing = sub === "session-start"
    ? `[Console]::Out.WriteLine('{"systemMessage":"PREGATE could not prepare this session: the project launcher is missing. Run pregate project launcher."}'); exit 0`
    : sub === "stop"
      ? `[Console]::Out.WriteLine('{"decision":"block","reason":"PREGATE could not verify this turn: the project launcher is missing; run pregate project launcher"}'); exit 2`
      : `[Console]::Error.WriteLine('PREGATE could not evaluate: the project launcher is missing; run pregate project launcher; report it to the user'); exit 2`;
  const script = `$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'; $OutputEncoding=[Console]::InputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $dir=if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { (Get-Location).Path }; $f=Join-Path $dir '.pregate/bin/project-launcher.ps1'; if (!(Test-Path -LiteralPath $f -PathType Leaf)) { ${missing} }; $raw=[Console]::In.ReadToEnd(); $raw | & $f hook ${sub} --harness claude-code; exit $LASTEXITCODE`;
  return powershellCommand(script);
}

// A handler this repository owns: it runs the project launcher for a Claude hook. A global
// registration names <DATA>/bin and is not this. A group that also holds a foreign handler is foreign.
export function projectOwnedCommand(command: string): boolean {
  const script = commandScript(command);
  const launcher = script.includes(".pregate/bin/pregate") || script.includes(".pregate/bin/pregate.cmd") || script.includes("project-launcher.ps1");
  const call = /hook (?:pre|stop|session-start) --harness claude-code/.test(script);
  return launcher && call && !script.includes("consented()") && !script.includes("/bin/launcher.ps1");
}

// null: not a JSON object, or an event is not an array. Nothing is written then.
export function mergeProjectClaude(text: string | null, windows = WINDOWS): string | null {
  const root = text === null ? {} : parse(text);
  if (root === null) return null;
  const hooks = root.hooks ?? {};
  if (!isObject(hooks)) return null;
  for (const [event, group] of Object.entries(projectGroups(windows))) {
    const list = hooks[event] ?? [];
    if (!Array.isArray(list)) return null;
    const at = list.findIndex((entry) => projectMine(entry));
    hooks[event] = at < 0 ? [...list, group] : list.flatMap((entry, i) => (i === at ? [group] : projectMine(entry) ? [] : [entry]));
  }
  root.hooks = hooks;
  return text !== null && Bun.deepEquals(parse(text), root, true) ? text : `${JSON.stringify(root, null, 2)}\n`;
}

// Event names whose owned group is missing or not exactly what setup writes. null: the file is not an object.
export function projectClaudeMissing(text: string | null, windows = WINDOWS): string[] | null {
  if (text !== null && parse(text) === null) return null;
  return EVENTS.filter((event) => projectPlaced(text, windows)[event]! < 0);
}

export function projectPreCommand(text: string | null): string | null {
  const list = parse(text ?? "")?.hooks;
  const groups = isObject(list) ? list.PreToolUse : null;
  if (!Array.isArray(groups)) return null;
  for (const group of groups) {
    const found = handlers(group).find((hook) => isObject(hook) && typeof hook.command === "string" && projectOwnedCommand(hook.command));
    if (isObject(found) && typeof found.command === "string") return found.command;
  }
  return null;
}

// Claude records the trust dialog on the project key. Anything else is not acceptance.
export function workspaceTrustAccepted(text: string | null, root: string): boolean {
  const projects = parse(text ?? "")?.projects;
  if (!isObject(projects)) return false;
  return Object.entries(projects).some(([key, value]) => sameRoot(key, root) && isObject(value) && value.hasTrustDialogAccepted === true);
}

export interface ScopeLine { level: "ok" | "info" | "warn" | "fail"; text: string }
export interface ProjectScope {
  active: boolean;
  exact: boolean;
  lines: ScopeLine[];
  preCommand: string | null;
  consentActive: boolean;
}

export function projectScope(input: {
  root: string;
  settings: string | null;
  localSettings: string | null;
  claudeConfig: string | null;
  launcherPresent: boolean;
  launcherReady: boolean;
  pin: string | null;
  engineReady: boolean;
  consentActive: boolean;
}): ProjectScope {
  const owned = projectPreCommand(input.settings) !== null || EVENTS.some((event) => ownedEvent(input.settings, event));
  const active = input.launcherPresent || owned;
  if (!active) return { active: false, exact: false, lines: [], preCommand: null, consentActive: input.consentActive };
  const invalid = input.settings !== null && parse(input.settings) === null;
  const missing = invalid ? [] : projectClaudeMissing(input.settings) ?? [];
  const pinOk = input.pin !== null && input.pin !== "" && ENGINE_VERSION.test(input.pin);
  const disabled = hooksDisabled(input.settings) ? ".claude/settings.json"
    : hooksDisabled(input.localSettings) ? ".claude/settings.local.json" : null;
  const lines: ScopeLine[] = [];
  if (invalid) lines.push(fail(".claude/settings.json is not a valid JSON object. Fix it and rerun pregate project setup."));
  else if (missing.length > 0) lines.push(fail(`.claude/settings.json: repository-owned PREGATE hooks missing or modified (${missing.join(", ")}); run pregate project setup.`));
  if (!input.launcherReady) lines.push(fail(`The project launcher is missing or not executable (${projectLauncherRel().join(", ")}). Run pregate project launcher. Repository hooks do not fall back to a global launcher.`));
  if (!pinOk) lines.push(fail("This project has no valid engine pin. Repository hooks do not fall back to a global launcher."));
  else if (!input.engineReady) lines.push(fail(`Engine ${input.pin} is not installed in the cache. Run pregate prepare. Repository hooks do not fall back to a global launcher.`));
  if (disabled !== null) lines.push(fail(`${disabled}: disableAllHooks disables PREGATE hooks in this repo.`));
  const exact = lines.length === 0;
  if (exact) lines.push(ok(`Project scope: repository-owned Claude hooks in .claude/settings.json run the project launcher for engine ${input.pin}.`));
  const trust = workspaceTrustAccepted(input.claudeConfig, input.root);
  const consent = input.consentActive ? "active" : "inactive";
  if (trust) lines.push(ok(`Claude workspace trust is accepted for ${input.root}. Policy consent is ${consent}. Workspace trust and policy consent are separate.`));
  else lines.push(warn(`Claude workspace trust is not accepted for ${input.root}. Policy consent is ${consent}. Repository hooks do not run in Claude Code until you accept the trust dialog. Accepting workspace trust does not grant policy consent, and pregate enable does not accept workspace trust.`));
  if (exact && !input.consentActive) lines.push(warn("Policy consent is inactive, so the project hook canary was not run. Run pregate enable. That does not accept Claude workspace trust."));
  return { active: true, exact, lines, preCommand: exact ? projectPreCommand(input.settings) : null, consentActive: input.consentActive };
}

function projectGroups(windows: boolean): Record<string, Payload> {
  const run = (sub: Sub, timeout: number): Payload => ({ type: "command", command: projectHookCommand(sub, windows), timeout });
  const stop = (): Payload => ({ hooks: [run("stop", 60)] });
  return {
    PreToolUse: { matcher: sharedClaudeMatcher(), hooks: [run("pre", 120)] },
    Stop: stop(),
    SubagentStop: stop(),
    SessionStart: { hooks: [run("session-start", 15)] },
  };
}

function projectPlaced(text: string | null, windows: boolean): Record<string, number> {
  const hooks = parse(text ?? "")?.hooks;
  return Object.fromEntries(Object.entries(projectGroups(windows)).map(([event, group]) => {
    const list = isObject(hooks) ? hooks[event] : null;
    return [event, Array.isArray(list) ? list.findIndex((entry) => Bun.deepEquals(entry, group, true)) : -1];
  }));
}

function ownedEvent(text: string | null, event: string): boolean {
  const hooks = parse(text ?? "")?.hooks;
  const list = isObject(hooks) ? hooks[event] : null;
  return Array.isArray(list) && list.some((entry) => projectMine(entry));
}

function projectMine(group: unknown): boolean {
  const hooks = handlers(group);
  return hooks.length > 0 && hooks.every((hook) => isObject(hook) && typeof hook.command === "string" && projectOwnedCommand(hook.command));
}

function handlers(group: unknown): unknown[] {
  if (!isObject(group)) return [];
  return Array.isArray(group.hooks) ? group.hooks : typeof group.command === "string" ? [group] : [];
}

function hooksDisabled(text: string | null): boolean {
  return parse(text ?? "")?.disableAllHooks === true;
}

function sameRoot(a: string, b: string): boolean {
  return slash(a).replace(/\/+$/, "") === slash(b).replace(/\/+$/, "");
}

function ok(text: string): ScopeLine {
  return { level: "ok", text };
}
function warn(text: string): ScopeLine {
  return { level: "warn", text };
}
function fail(text: string): ScopeLine {
  return { level: "fail", text };
}
