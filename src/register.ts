import { isObject, parse, type Payload } from "./harness/wire.ts";
import type { HarnessId, HookKind } from "./types.ts";
import { commandScript, powershellCommand, psQuote, windowsHook } from "./windows-command.ts";

// The global registrations (MULTI-HARNESS MH-22 to MH-25, MH-27): pure text in, text out. Writing
// the files (only when the bytes change, atomically, through symlinks, one backup) is machine.ts's.

export type Sub = HookKind;
// "shared": ~/.claude/settings.json, read by Claude Code, Cursor and Grok; "codex": its hooks.json;
// "agy": the hooks.json of the pregate plugin. "project": the project's own .claude/settings.json,
// whose handlers run the project launcher and name no machine path. "project-codex": the project's
// own .codex/hooks.json, with the Codex events and matcher, on the same launcher. "project-cursor":
// the project's own .cursor/hooks.json in Cursor's native format, on the same launcher.
export type Target = "shared" | "codex" | "agy" | "cursor" | "project" | "project-codex" | "project-cursor";
// The machine files drift reads; null: absent. `claude` holds every shared registration setup
// writes: ~/.claude/settings.json, and ${CLAUDE_CONFIG_DIR}/settings.json when it is elsewhere.
export interface MachineFiles {
  claude: (string | null)[]; codexHooks: string | null; codexConfig: string | null;
  grokConfig: string | null; agyHooks: string | null; agyConfig: string | null; cursorHooks: string | null;
}
// Repo-relative path → text of the repo files that can switch hooks off (.claude/settings*.json,
// .codex/config.toml, .agents/**).
export type RepoFiles = Record<string, string>;

// Closed tool lists (MH-22): `*` would spawn the hook on every read the agent makes.
const SHARED_TOOLS = "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor|Delete|apply_patch|edit|bash|write|search_replace|hashline_edit|run_terminal_command";
const CODEX_TOOLS = "^(apply_patch|Bash)$";
// A native Cursor matcher is tested against Cursor's own tool names: every file mutation captured
// reaches preToolUse as Write or Delete, commands as Shell, and MCP tools as MCP:<name>.
const CURSOR_TOOLS = "^(Write|Delete|Shell)$|^MCP:";
const MATCHER: Record<Exclude<Target, "cursor">, string> = {
  shared: SHARED_TOOLS,
  project: SHARED_TOOLS,
  codex: CODEX_TOOLS,
  "project-codex": CODEX_TOOLS,
  "project-cursor": CURSOR_TOOLS,
  agy: "^(write_to_file|replace_file_content|multi_replace_file_content|write_file|edit_file|create_file|delete_file|rename_file|notebook_edit|run_command|send_command_input)$",
};
// The tail of a Codex trust key (<file>:<event>:<group>:<hook>) names the event in snake case.
const CODEX_EVENT: Record<string, string> = { PreToolUse: "pre_tool_use", Stop: "stop", SessionStart: "session_start" };
const MISSING = "printf '%s\\n' 'PREGATE could not evaluate: its launcher is missing; report it to the user' >&2; exit 2";
const CONSENT = String.raw`consented() { d=$(cd "\${1}" 2>/dev/null && pwd -P) || return 1; while [ "\${d#/}" != "$d" ]; do unknown=1; g=$(git -C "$d" rev-parse --path-format=absolute --git-common-dir 2>/dev/null); if [ -n "$g" ]; then g=$(cd "$g" 2>/dev/null && pwd -P); [ -n "$g" ] && unknown=; else g=$d; fi; r=$(printf '%s' "$d" | sed 's/\\/\\\\/g;s/"/\\"/g'); g=$(printf '%s' "$g" | sed 's/\\/\\\\/g;s/"/\\"/g'); records=$(grep -hF "\"root\":\"$r\"," @CONSENT@/*.json 2>/dev/null) 2>/dev/null; [ -n "$records" ] && { [ -n "$unknown" ] || printf '%s' "$records" | grep -qF "\"common\":\"$g\""; } && return 0; reviews=$(grep -hF "\"root\":\"$r\"," @PROPOSALS@/*.json 2>/dev/null) 2>/dev/null; [ -n "$reviews" ] && return 0; [ -e "$d/.git" ] && return 1; d=\${d%/*}; done; return 1; }; `;
const PROJECT = `for d in "\${CLAUDE_PROJECT_DIR:-}" "\${CURSOR_PROJECT_DIR:-}" "\${GROK_WORKSPACE_ROOT:-}" "$PWD"; do consented "$d" && { ${MISSING}; }; done; exit 0`;
// agy runs hooks from the plugin folder and sets no project variable: the payload names the root.
const AGY_PROJECT = `p=$(cat); d=$(printf '%s' "$p" | sed -n 's/.*"workspacePaths":\\["\\([^"\\\\]*\\)".*/\\1/p'); consented "$d" && { ${MISSING}; }; exit 0`;

// The registered command: frozen across versions (test/fixtures/hook-command.ts).
export function hookCommand(data: string, sub: Sub, h: HarnessId): string {
  if (windowsData(data)) return windowsHook(data, sub, h);
  const consent = 'PATH=/usr/bin:/bin:$PATH; ' + CONSENT.replaceAll("\\${", "${").replaceAll("@CONSENT@", quote(`${data}/consent`)).replaceAll("@PROPOSALS@", quote(`${data}/proposals`));
  // Grok expands $VAR before invoking the shell, including locals the shell has not set yet.
  // Keep the exec path literal; decode the fallback only if the launcher is unavailable.
  if (h === "claude-code") {
    const f = launcher(data);
    const fallback = sub !== "pre" ? "exit 0" : `exec /bin/sh -c "$(printf '%b' ${quote((consent + PROJECT).replaceAll("\\", "\\\\").replaceAll("$", "\\044"))})"`;
    return `[ -x ${f} ] && [ -s ${f} ] && exec ${f} hook ${sub} --harness ${h}; ${fallback}`;
  }
  const run = `f=${launcher(data)}; [ -x "$f" ] && [ -s "$f" ] && exec "$f" hook ${sub} --harness ${h}; `;
  return run + (sub !== "pre" ? "exit 0" : consent + (h === "agy" ? AGY_PROJECT : PROJECT));
}

// The command a project registration holds (`pregate project hooks`). It names the project launcher
// through $CLAUDE_PROJECT_DIR, so it runs from any directory of the project and holds no machine
// path. A missing launcher denies a write (exit 2) and lets Stop and SessionStart pass; a missing
// engine is the launcher's own denial. Windows reaches project-launcher.ps1 from PowerShell, as the
// global registration reaches its launcher: pregate.cmd beside it only starts that same script.
const PROJECT_BIN = ".pregate/bin";
const PROJECT_MISSING = "PREGATE could not evaluate: the project launcher is missing; restore .pregate/bin or run pregate project launcher; report it to the user";
// Cursor runs project hooks from the project root and sets CURSOR_PROJECT_DIR (and CLAUDE_PROJECT_DIR
// as an alias); the Cursor form names its own variable so that it is told apart from the Claude one.
export function projectHookCommand(sub: Sub, windows: boolean, h: "claude-code" | "codex" | "cursor" = "claude-code"): string {
  if (h === "codex") return projectCodexCommand(sub, windows);
  const args = `hook ${sub} --harness ${h}`;
  const dir = h === "cursor" ? "CURSOR_PROJECT_DIR" : "CLAUDE_PROJECT_DIR";
  if (!windows) {
    const missing = sub === "pre" ? `printf '%s\\n' '${PROJECT_MISSING}' >&2; exit 2` : "exit 0";
    return `f="\${${dir}:-.}/${PROJECT_BIN}/pregate"; [ -x "$f" ] && [ -s "$f" ] && exec "$f" ${args}; ${missing}`;
  }
  const missing = sub === "pre" ? `[Console]::Error.WriteLine('${PROJECT_MISSING}'); exit 2` : "exit 0";
  return powershellCommand("$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'; $OutputEncoding=[Console]::InputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); "
    + `$raw=[Console]::In.ReadToEnd(); $d=if ($env:${dir}) { $env:${dir} } else { (Get-Location).Path }; $f=Join-Path $d '${PROJECT_BIN}/project-launcher.ps1'; `
    + `if (Test-Path -LiteralPath $f -PathType Leaf) { $raw | & $f ${args}; exit $LASTEXITCODE }; ${missing}`);
}

// The command a project Codex registration holds. Codex sets no project variable, so the command
// finds the launcher itself: it walks up from its working directory to the first directory that
// holds .pregate/bin, and stops at the first .git entry. It then runs the launcher from that
// directory, because the launcher's own fail-closed test looks for the lock in its working
// directory. The engine reads the session directory from the payload, not from the process.
// Limits: a working directory outside the repository finds no launcher and denies a write; a
// launcher above the first .git entry is never reached.
function projectCodexCommand(sub: Sub, windows: boolean): string {
  const args = `hook ${sub} --harness codex`;
  if (!windows) {
    const missing = sub === "pre" ? `printf '%s\\n' '${PROJECT_MISSING}' >&2; exit 2` : "exit 0";
    return `d=$PWD; while [ -n "$d" ]; do f="$d/${PROJECT_BIN}/pregate"; [ -x "$f" ] && [ -s "$f" ] && cd "$d" && exec "$f" ${args}; [ -e "$d/.git" ] && break; d=\${d%/*}; done; ${missing}`;
  }
  const missing = sub === "pre" ? `[Console]::Error.WriteLine('${PROJECT_MISSING}'); exit 2` : "exit 0";
  return powershellCommand("$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'; $OutputEncoding=[Console]::InputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); "
    + `$raw=[Console]::In.ReadToEnd(); $d=(Get-Location).Path; while ($d) { $f=Join-Path $d '${PROJECT_BIN}/project-launcher.ps1'; `
    + `if (Test-Path -LiteralPath $f -PathType Leaf) { Set-Location -LiteralPath $d; $raw | & $f ${args}; exit $LASTEXITCODE }; `
    + `if (Test-Path -LiteralPath (Join-Path $d '.git')) { break }; $d=[IO.Path]::GetDirectoryName($d) }; ${missing}`);
}

// A handler of a project registration, written on this platform or on the other one.
function ownedProjectCommand(command: string, t: Target): boolean {
  const script = commandScript(command);
  const launcher = script.includes(`/${PROJECT_BIN}/pregate"`) || script.includes(`'${PROJECT_BIN}/project-launcher.ps1'`);
  return launcher && script.includes(t === "project-codex" ? "--harness codex" : t === "project-cursor" ? "CURSOR_PROJECT_DIR" : "CLAUDE_PROJECT_DIR");
}

// The trust level the user's Codex config.toml records for a project directory
// ([projects."<root>"] trust_level); null: no record. It says nothing about the review of a hook.
export function codexProjectTrust(config: string | null, root: string): string | null {
  const spellings = [root, root.replaceAll("\\", "/"), root.replaceAll("/", "\\")];
  return spellings.map((dir) => toml(config, ["projects", dir, "trust_level"])).find((level) => level !== null) ?? null;
}

// The platform of a registration is read from the form of the data path it is made for.
function windowsData(data: string): boolean {
  return /^[a-z]:|^(?:\\\\|\/\/)/i.test(data);
}

// null: the text is not a JSON object, or an event is not an array; nothing is written then.
export function merge(text: string | null, t: Target, data: string): string | null {
  const root = text === null ? {} : parse(text);
  if (root === null) return null;
  if (t === "cursor" || t === "project-cursor") {
    if (root.version !== undefined && (typeof root.version !== "number" || !Number.isInteger(root.version) || root.version < 1)) return null;
    root.version ??= 1;
  }
  if (t === "agy") {
    root[AGY_PLUGIN] = named(data);
    return settled(text, root);
  }
  const hooks = root.hooks ?? {};
  if (!isObject(hooks)) return null;
  for (const [event, group] of Object.entries(ours(t, data))) {
    const list = hooks[event] ?? [];
    if (!Array.isArray(list)) return null;
    // In place, so that no foreign group changes index (Codex trust is per index, MH-24).
    const at = list.findIndex((g) => mine(g, t, data));
    hooks[event] = at < 0 ? [...list, group] : list.flatMap((g, i) => (i === at ? [group] : mine(g, t, data) ? [] : [g]));
  }
  root.hooks = hooks;
  return settled(text, root);
}

// `shifted`: the keys of foreign groups whose index moved, for the user to trust again (MH-24).
// Codex only, as <event>:<group>:<hook>: the caller prefixes the file.
export function unmerge(text: string, t: Target, data: string): { text: string; shifted: string[] } | null {
  const root = parse(text);
  if (root === null) return null;
  if (t === "agy") {
    delete root[AGY_PLUGIN];
    return { text: settled(text, root), shifted: [] };
  }
  const hooks = root.hooks ?? {};
  if (!isObject(hooks)) return null;
  const shifted: string[] = [];
  for (const event of Object.keys(ours(t, data))) {
    const list = hooks[event] ?? [];
    if (!Array.isArray(list)) return null;
    const kept = list.filter((g) => !mine(g, t, data));
    if (kept.length === list.length) continue;
    if (t === "codex") {
      kept.forEach((g, i) => {
        if (list.indexOf(g) !== i) shifted.push(...hooksOf(g).map((_, j) => `${CODEX_EVENT[event]}:${i}:${j}`));
      });
    }
    // What setup created goes away with it: the file is left as it was before setup.
    if (kept.length > 0) hooks[event] = kept;
    else delete hooks[event];
    if (Object.keys(hooks).length === 0 && t !== "cursor" && t !== "project-cursor") delete root.hooks;
  }
  return { text: settled(text, root), shifted };
}

// Exactly what setup writes (command, timeout and matcher): only such a group gets Codex trust.
export function exact(group: unknown, t: Target, data: string): boolean {
  return Object.values(ours(t, data)).some((o) => Bun.deepEquals(o, group, true));
}

// The agy plugin: relative path → bytes.
export const AGY_PLUGIN = "pregate-global";
export function agyPlugin(data: string): Record<string, string> {
  return { "plugin.json": render({ name: AGY_PLUGIN }), "hooks.json": render({ [AGY_PLUGIN]: named(data) }) };
}

// Cursor's TUI only enters its Stop dispatcher when a native registration exists. The shared
// imported Stop must stand aside when this installation also owns the native one.
export function cursorStopOwned(text: string | null, data: string): boolean {
  const version = parse(text ?? "")?.version;
  return typeof version === "number" && Number.isInteger(version) && version >= 1 && placed(text, "cursor", data).stop! >= 0;
}

export function cursorStartOwned(text: string | null, data: string): boolean {
  const version = parse(text ?? "")?.version;
  return typeof version === "number" && Number.isInteger(version) && version >= 1 && placed(text, "cursor", data).sessionStart! >= 0;
}

// Problems in human language; empty: none. `trust`: codex-trust.json.
export function drift(m: MachineFiles, repo: RepoFiles | null, data: string, trust: Record<string, string>): string[] {
  const out: string[] = [];
  m.claude.forEach((text, i) => {
    const where = i === 0 ? "~/.claude/settings.json" : "$CLAUDE_CONFIG_DIR/settings.json";
    const lost = Object.entries(placed(text, "shared", data)).filter(([, at]) => at < 0).map(([event]) => event);
    if (lost.length > 0) out.push(`${where}: PREGATE hooks missing or modified (${lost.join(", ")}); run pregate setup.`);
    if (hooksOff(text)) out.push(`${where}: disableAllHooks disables all hooks, including PREGATE.`);
  });
  if (m.cursorHooks !== null && !cursorStopOwned(m.cursorHooks, data)) out.push("~/.cursor/hooks.json: PREGATE Stop hook missing or modified; run pregate setup.");
  if (m.cursorHooks !== null && !cursorStartOwned(m.cursorHooks, data)) out.push("~/.cursor/hooks.json: PREGATE SessionStart hook missing or modified; run pregate setup.");
  // An absent hooks.json is drift only once setup has trusted it: without it, Codex is not set up.
  if (m.codexHooks !== null || Object.keys(trust).length > 0) {
    for (const [event, at] of Object.entries(placed(m.codexHooks, "codex", data))) {
      if (at < 0) {
        out.push(`Codex hooks.json: PREGATE ${event} hook missing or modified; run pregate setup.`);
        continue;
      }
      const key = Object.keys(trust).find((k) => k.endsWith(`:${CODEX_EVENT[event]}:${at}:0`));
      if (key === undefined || toml(m.codexConfig, ["hooks", "state", key, "trusted_hash"]) !== trust[key]) {
        out.push(`Codex does not run PREGATE ${event}: setup trust was removed or its index changed. Run pregate setup.`);
      }
    }
  }
  if (toml(m.codexConfig, ["features", "hooks"]) === "false") out.push("Codex config.toml: [features] hooks = false disables all Codex hooks.");
  if (toml(m.grokConfig, ["compat", "claude", "hooks"]) === "false") {
    out.push("Grok config.toml: [compat.claude] hooks = false ignores ~/.claude/settings.json, including PREGATE.");
  }
  const plugin = parse(m.agyConfig ?? "")?.plugins;
  const state = isObject(plugin) ? plugin[AGY_PLUGIN] : undefined;
  if (isObject(state) && state.enabled === false) out.push("agy: pregate-global is disabled (plugins.pregate-global.enabled = false in ~/.gemini/config/config.json); enable it.");
  if (m.agyHooks !== null ? !Bun.deepEquals(parse(m.agyHooks), { [AGY_PLUGIN]: named(data) }, true) : state !== undefined) {
    out.push("agy: pregate-global plugin missing or modified; run pregate setup.");
  }
  for (const [path, text] of Object.entries(repo ?? {})) {
    if (/(^|\/)\.claude\/settings[^/]*\.json$/.test(path) && hooksOff(text)) out.push(`${path}: disableAllHooks disables PREGATE hooks in this repo.`);
    if (/(^|\/)\.codex\/config\.toml$/.test(path) && toml(text, ["features", "hooks"]) === "false") {
      out.push(`${path}: [features] hooks = false disables Codex hooks in this repo.`);
    }
    if (/(^|\/)[._]agents?\/(hooks\.json|plugins\.json|plugins\/)/.test(path) && /pregate/.test(path + text)) {
      out.push(`${path}: names pregate and may disable its agy plugin in this repo.`);
    }
  }
  return out;
}

// Use the same exact-registration and trust checks as doctor, independently for each harness.
export function gated(m: MachineFiles, repo: RepoFiles | null, data: string, trust: Record<string, string>): Set<HarnessId> {
  const empty: MachineFiles = { claude: [], codexHooks: null, codexConfig: null, grokConfig: null, agyHooks: null, agyConfig: null, cursorHooks: null };
  const shared = m.claude.length > 0 && m.claude.every((text) => text !== null);
  const variants: [HarnessId, boolean, MachineFiles][] = [
    ["claude-code", shared, { ...empty, claude: m.claude }],
    ["cursor", shared && m.cursorHooks !== null, { ...empty, claude: m.claude, cursorHooks: m.cursorHooks }],
    ["grok", shared, { ...empty, claude: m.claude, grokConfig: m.grokConfig }],
    ["codex", m.codexHooks !== null && Object.keys(trust).length > 0, { ...empty, codexHooks: m.codexHooks, codexConfig: m.codexConfig }],
    ["agy", m.agyHooks !== null, { ...empty, agyHooks: m.agyHooks, agyConfig: m.agyConfig }],
  ];
  return new Set(variants.filter(([h, present, files]) => present && drift(files, repo, data, h === "codex" ? trust : {}).length === 0).map(([h]) => h));
}

// What setup registers, by event: a group; agy's Stop takes a bare handler.
function ours(t: Target, data: string): Record<string, object> {
  const h: HarnessId = t === "shared" || t === "project" ? "claude-code" : t === "project-codex" ? "codex" : t === "project-cursor" ? "cursor" : t;
  const project = t === "project" || t === "project-codex" || t === "project-cursor";
  const run = (sub: Sub, timeout: number) => ({
    type: "command", timeout,
    command: project && h !== "agy" ? projectHookCommand(sub, windowsData(data), h) : hookCommand(data, sub, h),
  });
  if (t === "cursor") return { stop: { ...run("stop", 60), loop_limit: null }, sessionStart: run("session-start", 15) };
  // No failClosed: Cursor 2026.11.11 counts an empty stdout as a failed hook under it, and empty is
  // how the gate says it has no objection. The launcher turns a crash or a hang into exit 2 itself.
  if (t === "project-cursor") {
    return { preToolUse: { ...run("pre", 120), matcher: MATCHER[t] }, stop: { ...run("stop", 60), loop_limit: null }, sessionStart: run("session-start", 15) };
  }
  const pre = { matcher: MATCHER[t], hooks: [run("pre", 120)] };
  if (t === "agy") return { PreToolUse: pre, Stop: run("stop", 60), PreInvocation: run("session-start", 15) };
  const stop = { hooks: [run("stop", 60)] };
  const start = { hooks: [run("session-start", 15)] };
  // SubagentStart runs the session-start command: a Claude Code subagent starts without the context
  // its parent received, so the briefing goes to it there. The event is the payload's, not argv's.
  if (t === "shared" || t === "project") return { PreToolUse: pre, Stop: stop, SubagentStop: stop, SessionStart: start, SubagentStart: start };
  return { PreToolUse: pre, Stop: stop, SessionStart: start };
}

// agy uses PreInvocation rather than SessionStart; the adapter ignores invocationNum > 0.
function named(data: string): Payload {
  const { PreToolUse, Stop, PreInvocation } = ours("agy", data);
  return { enabled: true, PreToolUse: [PreToolUse], Stop: [Stop], PreInvocation: [PreInvocation] };
}

// Ours, of this version or an older one: every handler runs this machine's launcher. A group that
// also holds a foreign handler is foreign, since replacing it would drop that handler.
function mine(group: unknown, t: Target, data: string): boolean {
  const hs = hooksOf(group);
  return hs.length > 0 && hs.every((h) => isObject(h) && typeof h.command === "string" && (t === "project" || t === "project-codex" || t === "project-cursor" ? ownedProjectCommand(h.command, t) : ownedCommand(h.command, data)));
}

export function ownedCommand(command: string, data: string): boolean {
  return commandScript(command).includes(windowsData(data) ? psQuote(`${data.replaceAll("\\", "/")}/bin/launcher.ps1`) : launcher(data));
}

function hooksOf(group: unknown): unknown[] {
  return !isObject(group) ? [] : Array.isArray(group.hooks) ? group.hooks : typeof group.command === "string" ? [group] : [];
}

// Every group setup writes for `t` is in `text`, unchanged.
export function registered(text: string | null, t: Target, data: string): boolean {
  return Object.values(placed(text, t, data)).every((at) => at >= 0);
}

// Event → index of the group setup writes; -1: missing or changed.
function placed(text: string | null, t: Target, data: string): Record<string, number> {
  const hooks = parse(text ?? "")?.hooks;
  return Object.fromEntries(Object.entries(ours(t, data)).map(([event, group]) => {
    const list = isObject(hooks) ? hooks[event] : null;
    return [event, Array.isArray(list) ? list.findIndex((g) => Bun.deepEquals(g, group, true)) : -1];
  }));
}

function hooksOff(text: string | null): boolean {
  return parse(text ?? "")?.disableAllHooks === true;
}

// Single-quoted, so that no data path can break out of the command.
function launcher(data: string): string {
  return quote(`${data}/bin/pregate`);
}

function quote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

// The input bytes when the content did not change, so that nothing is written (and Codex keeps the
// trust it gave to foreign groups, MH-23).
function settled(text: string | null, root: Payload): string {
  return text !== null && Bun.deepEquals(parse(text), root, true) ? text : render(root);
}

function render(v: object): string {
  return `${JSON.stringify(v, null, 2)}\n`;
}

// The raw value of one key in TOML text (a string without its quotes); null: absent. It follows
// tables and dotted keys, bare or quoted, which is how Codex and Grok write the keys drift reads, and
// skips multi-line strings, whose lines could pass for keys. Inline tables and array tables are not
// followed: a key there is missed, which only loses a warning.
function toml(text: string | null, path: string[]): string | null {
  let table: string[] | null = [];
  let open: string | null = null;   // the delimiter of the multi-line string being skipped
  for (const raw of (text ?? "").split("\n")) {
    const line = raw.trim();
    if (open !== null) {
      if (line.includes(open)) open = null;
    } else if (line.startsWith("[[")) {
      table = null;
    } else if (line.startsWith("[")) {
      const k = dotted(line, 1);
      table = k !== null && line[k.end] === "]" ? k.keys : null;
    } else {
      const k = dotted(line, 0);
      if (k === null || line[k.end] !== "=") continue;
      const value = line.slice(k.end + 1).trim();
      const multi = /^("""|''')/.exec(value)?.[1];
      if (multi !== undefined && !value.slice(3).includes(multi)) open = multi;
      if (table === null || !Bun.deepEquals([...table, ...k.keys], path)) continue;
      const quoted = /^"((?:[^"\\]|\\.)*)"|^'([^']*)'/.exec(value);
      return quoted === null ? value.replace(/\s*#.*$/, "") : quoted[2] ?? unescape(quoted[1]!);
    }
  }
  return null;
}

const KEY = /\s*(?:([A-Za-z0-9_-]+)|"((?:[^"\\]|\\.)*)"|'([^']*)')\s*/y;

function dotted(s: string, from: number): { keys: string[]; end: number } | null {
  const keys: string[] = [];
  for (let i = from; ; i = KEY.lastIndex + 1) {
    KEY.lastIndex = i;
    const m = KEY.exec(s);
    if (m === null) return null;
    keys.push(m[1] ?? m[3] ?? unescape(m[2]!));
    if (s[KEY.lastIndex] !== ".") return { keys, end: KEY.lastIndex };
  }
}

// TOML basic-string escapes are JSON's, plus \U and \e, which no key drift reads holds.
function unescape(s: string): string {
  try {
    return JSON.parse(`"${s}"`) as string;
  } catch {
    return s;
  }
}
