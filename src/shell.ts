import { basename, posix, win32 } from "node:path";
import { absolutePath, matches, pathKey, PROTECTED_NAMES, REQUESTS, slash } from "./paths.ts";
import type { Cause, HarnessId } from "./types.ts";
import { pregateControlCause } from "./control.ts";
import { nodeInspection, pythonInspection } from "./python-inspection.ts";
import { inlineSink, nodeFile, noNewNodeSinks } from "./inline-sinks.ts";

// Help must exit before any command can inspect or change installation/project state.
const HELP_COMMANDS = new Set([
  "check", "audit", "promote", "fitness", "init", "scan", "demo", "report", "feedback", "storage", "dispute", "issue", "pack", "explain",
  "preset", "rules", "rules test", "rules draft", "rules add", "status", "approve", "enable", "disable", "install", "prepare", "project", "project launcher", "project hooks", "project setup", "setup", "update", "uninstall", "doctor", "guide", "session", "session rebase",
  "ci", "ci detect", "ci status", "ci wait", "import", "import arkgate",
  "preset apply", "preset compile", "preset diagnose", "preset show", "preset schema", "preset request-schema",
  "pack list", "pack show", "pack init", "pack add", "pack apply", "pack restore", "pack update", "pack enable", "pack disable", "pack remove",
  "fitness status", "fitness run", "fitness plan", "fitness fingerprint", "fitness bind", "issue list", "issue draft", "issue show", "issue submit",
  "feedback list", "feedback draft", "feedback show", "feedback apply", "storage inspect", "storage prune", "storage recover", "storage show", "storage apply",
]);

export function commandHelp(args: string[]): boolean {
  return ["--help", "-h"].includes(args.at(-1) ?? "")
    && (args.length === 1 || HELP_COMMANDS.has(args.slice(0, -1).join(" ")));
}

// Shell guard (§4.2): a heuristic over one permissive lexer for POSIX shells and PowerShell. It
// denies what it can establish (writes, admin commands, other harnesses, protected mentions) and
// never denies for syntax it does not understand: Stop, pre-commit and CI see the resulting tree.

// `under`: whether an in-scope path can lie at or below `abs`, for a directory written whole.
// `touched`: whether a path the guard asked about (isProtected, inScope or under) reached a root.
export interface GuardContext {
  launcher: string | null; isProtected: (abs: string) => boolean; inScope: (abs: string) => boolean; under: (abs: string) => boolean;
  touched: () => boolean;
  gated?: Pick<ReadonlySet<string>, "has">;
  engines?: string;
  policyRead?: (abs: string, kind: "admitted" | "inspect" | "inventory") => boolean;
  configurationRead?: (abs: string) => boolean;
  // The text a file had when the session began: the session's base commit, or the dirty text
  // recorded at the session start. null when the file had none or it cannot be shown.
  sessionBase?: (abs: string) => string | null;
  // Whether a path is the skill file that setup installed for the agent to read.
  skillRead?: (abs: string) => boolean;
  // Reads one literal script for pregate control commands. The shell layer supplies it; the core does not open files.
  readControlFile?: (path: string) => Cause | null;
  // Reads script bytes for sink and control scanning without the lexer importing the filesystem.
  readScriptFile?: (path: string) => { kind: "text"; text: string } | { kind: "native" } | { kind: "admin" } | { kind: "missing" } | { kind: "unreadable" };
  // Resolves a bare command name on PATH. The shell layer supplies it; the core does not read the environment.
  commandPath?: (name: string) => string | null;
  // Whether a program found on PATH lies outside every enabled project: an installed tool, not
  // project code. Without it every script found on PATH is read like a project script.
  outsideRoots?: (abs: string) => boolean;
  // The files a git command that moves history or the worktree would change (`args` from the
  // subcommand on), or null when they cannot be known. Without it such a command may write anything.
  // `worktree` paths are edits when they are in scope. `index` paths deny only when protected.
  // A clean checkout of an existing branch reports its files on `index` only.
  gitChanges?: (cwd: string, args: string[]) => GitChanges | null;
}
export interface GitChanges { worktree: string[]; index: string[] }
// `machineOnly`: neither the cwd nor the session reached a root (MH-17). `held`: the first cause
// that applies only with a root, kept while the rest of the command is read. `origin`: the call's
// cwd, where a command whose cwd is unknown most likely runs. `bound`: the variables the command
// line binds POSIX-style, shared by its nested scripts.
type Ctx = GuardContext & { machineOnly: boolean; harness: HarnessId; held: Cause | null; origin: string; guideInspection: boolean; configurationInspection: boolean;
  vars: Map<string, string>; pendingProtected: Set<string>; bound: Set<string>; ciSet: boolean };

// What denies in any session: the machine's protected paths (isProtected answers which) and what
// switches off the hooks of every repo. The rest needs a path of the command to reach a root.
const ALWAYS: ReadonlySet<Cause> = new Set<Cause>(["protected-path", "hook-switch"]);

function controlFile(ctx: Ctx, path: string | null): Cause | null {
  return path === null || path === "" ? null : ctx.readControlFile?.(path) ?? null;
}

const SHELL_INTERPRETERS = new Set(["sh", "bash", "zsh", "dash", "ksh", "mksh", "fish", "powershell", "pwsh"]);
const SCRIPT_EXT: [RegExp, string][] = [
  [/\.(?:cjs|mjs|jsx|js|ts|tsx|mts|cts)$/i, "node"],
  [/\.pyw?$/i, "python"],
  [/\.(?:rb|ru)$/i, "ruby"],
  [/\.(?:pl|pm)$/i, "perl"],
  [/\.php$/i, "php"],
  [/\.(?:sh|bash|zsh|ksh)$/i, "sh"],
  [/\.ps1$/i, "powershell"],
];
const ARCHIVES = new Set(["tar", "gtar", "bsdtar"]);
// What a shell runs itself and never looks up on PATH. macOS ships `/usr/bin/cd`, `/usr/bin/type`
// and their siblings as scripts for `env` and `find -exec`; `cd src` does not run them.
const BUILTINS = new Set(["alias", "bg", "cd", "command", "echo", "false", "fc", "fg", "getopts", "hash", "jobs", "kill", "printf", "pwd", "read", "test", "true", "type",
  "ulimit", "umask", "unalias", "wait", "["]);
// Bun reads these first words as its own subcommands, never as a script file of that name.
const BUN_SUBCOMMANDS = new Set(["add", "audit", "build", "c", "create", "exec", "i", "info", "init", "install", "link", "outdated", "patch", "pm", "publish", "remove", "rm",
  "run", "test", "unlink", "update", "upgrade", "why", "x"]);
const FIXERS = new Set(["prettier", "eslint", "ruff", "biome", "gofmt", "rustfmt", "clang-format"]);

function inferScriptInterpreter(path: string, text: string): string {
  const file = basename(path).toLowerCase();
  for (const [re, name] of SCRIPT_EXT) if (re.test(file)) return name;
  const shebang = /^#![^\n]*/.exec(text)?.[0]?.toLowerCase() ?? "";
  if (/\b(node|nodejs|bun|deno)\b/.test(shebang)) return "node";
  if (/\bpython/.test(shebang)) return "python";
  if (/\bperl\b/.test(shebang)) return "perl";
  if (/\b(ruby|php)\b/.test(shebang)) return shebang.includes("php") ? "php" : "ruby";
  if (/\b(bash|sh|zsh|dash|ksh|fish)\b/.test(shebang)) return "sh";
  if (/\b(pwsh|powershell)\b/.test(shebang)) return "powershell";
  return "sh";
}

// A literal script file an interpreter or shell runs: control text, then write sinks like inline code.
function scriptFile(ctx: Ctx, path: string, interpreter: string, cwd: string | null, options: string[] = []): Cause | null {
  const control = controlFile(ctx, path);
  if (control !== null) return control;
  const read = ctx.readScriptFile?.(path) ?? { kind: "missing" as const };
  if (read.kind === "native" || read.kind === "missing") return null;
  if (read.kind === "admin") return "shell-admin";
  if (read.kind === "unreadable") return "shell-write";
  const lang = interpreter.replace(/^python[\d.]*$/, "python").replace(/^nodejs$/, "node");
  if (SHELL_INTERPRETERS.has(lang)) {
    const src = lang === "powershell" && read.text.includes("\\") ? read.text.replace(/\\(?=[\w.-])/g, "/") : read.text;
    return script(src, cwd, ctx);
  }
  // A file run by node, bun or deno is a program with imports, read by the rules for a file.
  const file = INTERPRETERS.get(lang) === NODE ? nodeFile(read.text) : null;
  const sink = file === null ? inlineSink(lang, read.text, options) : file.sink;
  const wrote = sink ? "shell-write" : code({ text: file === null ? read.text : file.rest, literal: true, subs: [] }, cwd, ctx);
  if (wrote !== "shell-write") return wrote;
  // The base is asked only when the scan would deny. A script that is as it was when the session
  // began is the project's own program: running it is what the project's test command does. A node
  // file that the session changed keeps that standing while it gains no sink (an edited test file
  // that already imported `vm`). Only a write sink is forgiven; control text was read above.
  const base = ctx.sessionBase?.(path) ?? null;
  if (base === null) return wrote;
  if (base === read.text) return null;
  return file !== null && sink && noNewNodeSinks(base, read.text) ? code({ text: file.rest, literal: true, subs: [] }, cwd, ctx) : wrote;
}

// A path command (`./run`, `scripts/deploy.sh`) is read where it is spelled. A bare name is resolved
// on PATH and, when that file is a script, scanned the same way. A native executable is not a script.
function namedScript(head: Word, name: string, cwd: string | null, ctx: Ctx): Cause | null {
  const scripted = /\.(?:sh|bash|zsh|ksh|cjs|mjs|jsx|js|ts|tsx|mts|cts|pyw?|rb|pl|pm|php|ps1)$/i.test(name) || /[\\/]/.test(head.text);
  if (scripted) {
    if (/[\\/]/.test(head.text)) {
      const resolved = resolve(cwd, head.text);
      if (resolved === null) return "shell-write";
      const peek = ctx.readScriptFile?.(resolved) ?? { kind: "missing" as const };
      if (peek.kind === "native") return null;
      const interp = peek.kind === "text" ? inferScriptInterpreter(resolved, peek.text) : inferScriptInterpreter(resolved, "");
      return scriptFile(ctx, resolved, interp, cwd);
    }
  }
  if (/[\\/]/.test(head.text) || ctx.commandPath === undefined || head.text === "" || head.text.includes("\0") || BUILTINS.has(head.text)) return null;
  const found = ctx.commandPath(head.text);
  if (found === null || found === "") return null;
  // An installed tool that is a script (`npm`, `npx`, `pip`) uses the file system by its nature,
  // like the native tools that are not read at all. It is read for control commands only. A script
  // on PATH that lies inside a project (`node_modules/.bin`, a linked project file) is project code.
  if (ctx.outsideRoots?.(found) === true) return controlFile(ctx, found);
  const peek = ctx.readScriptFile?.(found) ?? { kind: "missing" as const };
  if (peek.kind === "native") return null;
  const interp = peek.kind === "text" ? inferScriptInterpreter(found, peek.text) : "sh";
  return scriptFile(ctx, found, interp, cwd);
}

// `literal`: no expansion happens, so `text` is the exact argument. `subs`: nested scripts
// ($(…), `…`, <(…), >(…)) that run too and are analyzed on their own. `blocks`: the bodies of
// `{…}` words, which only PowerShell runs (script blocks); a POSIX shell expands them as text.
// `file`: the literal path a `<` redirection reads stdin from; a script fed that way is scanned
// for pregate control commands when a shell or an interpreter runs it.
interface Word { text: string; literal: boolean; subs: string[]; blocks?: string[]; file?: string }
// `stdin`: the text a heredoc or a here-string feeds to the command.
interface Redir { op: string; target: Word; stdin: Word | null }
// A simple command and the operator that ends it.
interface Command { words: Word[]; redirs: Redir[]; op: string }
type Flag = [name: string, value: Word | undefined];

// A target that exists but cannot be named: files fed by xargs, a download's remote name, a patch.
const UNKNOWN: Word = { text: "", literal: false, subs: [] };
// Input from a file, which is not read: nothing to analyze.
const UNREAD: Word = { text: "", literal: true, subs: [] };

const META = new Set([" ", "\t", "\n", ";", "&", "|", "(", ")", "<", ">"]);
const OPS = ["&&", "||", "|&", ";", "&", "|", "(", ")"];
// `<(` and `>(` are process substitutions, not redirections.
const REDIR = /(?:\d+|\{\w+\})?(&>>|&>|>>|>\||>&|>|<<<|<<-|<<|<>|<&|<)(?!\()[ \t]*/y;
const WRITE_REDIRS = new Set([">", ">>", ">|", "&>", "&>>", "<>", ">&"]);
const DATA_REDIRS = new Set(["<<", "<<-", "<<<"]);
const ASSIGNMENT = /^([A-Za-z_]\w*)=/;
const PIECES = /[^\w./@+~%-]+/;

const HARNESS = /(^|[/@])(claude|claude-code|codex|grok|gemini|gemini-cli|qwen|qwen-code|copilot|cursor|cursor-agent|agy|antigravity|aider|aider-chat|opencode|opencode-ai|kilo|kilocode|amp|cline|junie|kiro-cli|droid|auggie)(@[^/]*)?(\/|$)/;
// Git takes any unambiguous prefix of a long option: `--no-veri` is the shortest --no-verify.
const ADMIN_WORD = /--no-veri|core\.hookspath/i;
const GIT_SWITCH = /^(HUSKY|HUSKY_SKIP_HOOKS|LEFTHOOK|SKIP|PRE_COMMIT_ALLOW_NO_CONFIG|GIT_CONFIG\w*|KILO_PURE)$/;
// A harness run without the user's configuration runs without PREGATE (MH-17, MH-29). Specific
// flags first (verbatim, so help text and config keys match). Generic disable and bypass flags
// match a whole argv word, including `--flag=value`, so a renamed bypass flag is still caught.
// A path or a script name that merely contains those words (`src/disable-hooks.ts`,
// `npm run disable-hooks`) is an ordinary command. Bare stems without the leading dashes are
// a hook switch only on a harness command. Refresh the list when a new Claude Code, Codex,
// Cursor, Grok or OpenCode release ships a hooks-related flag (`test/shell.test.ts`).
const HOOK_WORD = /--ignore-user-config|--setting-sources|--settings|disableallhooks|features\.hooks|--dangerously-bypass-hook-trust|compat\.claude\.hooks/i;
const HOOK_FLAG = /^--(?:no-hooks|skip-hooks|disable[-_]?hooks?|hooks?[-_]?off|bypass[-_]?hooks?)(?:=.*)?$/i;
const HOOK_STEM = /^(?:--)?(?:no-hooks|skip-hooks|disable[-_]?hooks?|hooks?[-_]?off|bypass[-_]?hooks?)(?:=.*)?$/i;
const HOOK_SWITCH = /^(HOME|USERPROFILE|LOCALAPPDATA|APPDATA|XDG_\w+|PREGATE_\w+|GROK_CLAUDE_HOOKS_ENABLED|CODEX_HOME|GROK_HOME|CLAUDE_CONFIG_DIR)$/;
// An argument of a harness command that names its hooks or the pregate plugin as a word or a key,
// not inside a prompt: `agy plugin disable pregate`, `codex -c hooks.state=…`, `--no-hooks`.
const HOOK_ARG = /^\S*(?<![a-z])(hooks|pregate)(?![a-z])\S*$/i;
// pregate subcommands that change what every harness runs.
const MACHINE = /^(prepare|setup|update|uninstall)$/;
// Variables that name a protected folder whatever their value: read as the folder they default to,
// the spelling machineGlobs protects at any depth.
const SPELLED: Record<string, string> = {
  HOME: "~", CODEX_HOME: "~/.codex", GROK_HOME: "~/.grok", CLAUDE_CONFIG_DIR: "~/.claude",
  XDG_DATA_HOME: "~/.local/share", XDG_STATE_HOME: "~/.local/state",
  USERPROFILE: "~", LOCALAPPDATA: "~/AppData/Local", APPDATA: "~/AppData/Roaming",
};
const VARIABLE = /(^|[=:])\$(?:\{(\w+)\}|(\w+))(?=\/|$)/g;
// Reserved words before a command, which runs all the same; `}` closes a group read in line.
const KEYWORDS = new Set(["if", "then", "elif", "else", "do", "while", "until", "!", "coproc", "}"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "mksh", "fish"]);
// Programs that take their input from a terminal: the hook sees only how they start, and Codex's
// write_stdin, which feeds them, has no hook (MH-29).
const SESSIONS = new Set(["script", "tmux", "screen"]);
const EDITORS = new Set(["ed", "ex", "vi", "vim", "nvim", "nano", "emacs"]);
// Options that print and exit: no session starts. A shell's -v is verbose, not the version.
const INFORMATIVE = /^(--version|--help|-version|-help|-\?)$/i;
const EXPORTS = new Set(["export", "declare", "typeset", "readonly", "local"]);
const CD = new Set(["cd", "pushd", "popd", "chdir", "set-location", "sl", "push-location", "pop-location"]);
const COPIES = new Set(["cp", "mv", "ln", "install", "copy-item", "move-item", "copy", "move", "cpi", "mi"]);
const PS_WRITERS = new Set(["set-content", "add-content", "out-file", "tee-object", "sc", "ac"]);
const PS_PATHS = ["path", "literalpath", "filepath", "pspath"];
const PS_VALUED = ["value", "encoding", "inputobject", "width", "itemtype", "name", "stream", "filter", "include",
  "exclude", "delimiter", "credential", "variable"];

// Options that take a value, per command whose operands are another command or a script. The
// package runners (`npm exec`, `pnpm dlx`…) take npx's.
const WRAPPERS = new Map<string, string[]>([
  ["env", ["-u", "--unset", "-S", "--split-string", "-C", "--chdir"]], ["command", []], ["builtin", []], ["exec", ["-a"]],
  ["nohup", []], ["time", []], ["nice", ["-n", "--adjustment"]], ["stdbuf", ["-i", "-o", "-e"]], ["doas", ["-u", "-C"]],
  ["sudo", ["-u", "-g", "-C", "-D", "-h", "-p", "-R", "-r", "-T", "-t", "-U", "--user", "--group", "--close-from", "--chdir",
    "--host", "--prompt", "--chroot", "--role", "--command-timeout", "--type", "--other-user"]],
  ["timeout", ["-s", "--signal", "-k", "--kill-after"]],
  ["xargs", ["-I", "-J", "-L", "-n", "-P", "-s", "-d", "-E", "-a", "-R", "-S", "--max-args", "--max-procs", "--max-chars",
    "--delimiter", "--arg-file", "--process-slot-var"]],
  ["npx", ["-p", "--package", "-c", "--call"]], ["bunx", ["-p", "--package"]], ["pnpx", []], ["uvx", ["--from", "--with"]],
]);
const RUNNERS = new Set(["npm exec", "npm x", "pnpm dlx", "pnpm exec", "yarn dlx", "yarn exec", "bun x", "pipx run"]);
// A curl option that takes a value ends its cluster: `-XPOST` is not -O.
const CURL_VALUED = [..."AbcCdDeEFHKmoPQrtTuUwxXyYz"].map((c) => `-${c}`).concat("--output");

// The flag that gives inline code, per interpreter.
const NODE = /^(-[A-Za-z]*[ep]|--eval|--print)$/;
const INTERPRETERS = new Map<string, RegExp>([
  ["python", /^-[A-Za-z]*c$/], ["node", NODE], ["nodejs", NODE], ["bun", NODE], ["deno", /^eval$/], ["php", /^-r$/],
  ["perl", /^-[A-Za-z0-9]*[eE]$/], ["ruby", /^-[A-Za-z]*e$/],
]);

// PowerShell separates paths with `\`, which a POSIX shell reads as an escape: a command with one
// is read both ways, and either reading may deny. Codex 0.166.0 reports the command's resolved
// workdir in `cwd` (openai/codex#57198), so a relative path resolves there, including a subfolder
// or a directory outside the session. A non-literal `cd` still makes the directory unknown.
export function guard(command: string, cwd: string, context: GuardContext & { machineOnly: boolean; harness: HarnessId }): Cause | null {
  const ctx: Ctx = { ...context, held: null, origin: cwd, guideInspection: isolatedGuideInspection(command), configurationInspection: isolatedConfigurationInspection(command),
    vars: new Map(), pendingProtected: new Set(), bound: new Set(), ciSet: false };
  const cause = script(command, cwd, ctx) ?? (command.includes("\\") ? script(command.replace(/\\(?=[\w.-])/g, "/"), cwd, ctx) : null);
  return cause ?? (ctx.held !== null && ctx.touched() ? ctx.held : null);
}

// A single literal cat call has no executable filter, expansion, wrapper or output destination.
function isolatedConfigurationInspection(source: string): boolean {
  if (source.length > 8192 || !/^cat[ \t]+/.test(source.trimStart())) return false;
  const calls = lex(source);
  const call = calls[0];
  if (calls.length !== 1 || call === undefined || call.op !== ";" || call.redirs.length !== 0 || call.words[0]?.text !== "cat") return false;
  const args = call.words.slice(call.words[1]?.text === "--" ? 2 : 1);
  return args.length > 0 && args.length <= 32 && call.words.every(word => word.literal && word.subs.length === 0)
    && args.every(word => word.text !== "-" && !word.text.startsWith("-"));
}

// The guide can act on another project from a neutral cwd. Reuse the shell lexer so
// quote splicing, escaped letters and line continuations cannot evade guard loading.
// This is only a loading hint: quoted data can also match and is decided by guard().
export function guideCommandMention(command: string): boolean {
  const pending = [command, ...(command.includes("\\") ? [command.replace(/\\(?=[\w.-])/g, "/")] : [])], seen = new Set<string>();
  while (pending.length) {
    const source = pending.pop()!;
    if (seen.has(source)) continue;
    seen.add(source);
    for (const call of lex(source)) {
      for (const [index, word] of call.words.entries()) {
        const name = basename(slash(word.text)).toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
        const next = call.words[index + 1];
        if (name === "pregate" && (next === undefined || !next.literal || next.text === "guide")) return true;
        pending.push(...word.subs, ...word.blocks ?? []);
        if (/[\s'"\\]/.test(word.text)) pending.push(word.text);
      }
      for (const redir of call.redirs) {
        pending.push(...redir.target.subs);
        if (redir.stdin !== null) pending.push(redir.stdin.text);
      }
    }
  }
  return false;
}

// ── Lexer ─────────────────────────────────────────────────────────────────────────

// Index of `s` in `src` from `i`; src.length if absent.
function upTo(src: string, s: string, i: number): number {
  const k = src.indexOf(s, i);
  return k < 0 ? src.length : k;
}

// Index of the `q` that ends a quote whose text starts at `i`, skipping backslash escapes.
function endQuote(src: string, i: number, q: string): number {
  while (i < src.length && src[i] !== q) i += src[i] === "\\" ? 2 : 1;
  return i;
}

// Index of the `end` that closes an `open` already consumed, skipping quotes; src.length if none.
function close(src: string, i: number, open: string, end: string): number {
  for (let depth = 1; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") i++;
    else if (c === "'") i = upTo(src, "'", i + 1);
    else if (c === '"') i = endQuote(src, i + 1, '"');
    else if (c === open) depth++;
    else if (c === end && --depth === 0) return i;
  }
  return src.length;
}

// The $(…) and `…` inside text the lexer keeps whole (${…}, $((…)), [[ ]], (( )), the body of a
// heredoc whose delimiter is unquoted): they run all the same.
function substitutions(text: string): string[] {
  const subs: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("$(", i) && text[i + 2] !== "(") {
      const end = close(text, i + 2, "(", ")");
      subs.push(text.slice(i + 2, end));
      i = end;
    } else if (text[i] === "`") {
      const end = upTo(text, "`", i + 1);
      subs.push(text.slice(i + 1, end));
      i = end;
    }
  }
  return subs;
}

function readWord(src: string, start: number): [Word, number] {
  const w: Word = { text: "", literal: true, subs: [] };
  let quoted = false;
  let i = start;
  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];
    const expansion = expansionAt(src, i, !quoted && i === start);
    if (expansion !== null) {
      w.text += src.slice(i, expansion.end + 1);
      if (c === "{") (w.blocks ??= []).push(...expansion.subs);
      else w.subs.push(...expansion.subs);
      w.literal = false;
      i = expansion.end + 1;
    } else if (!quoted && META.has(c)) {
      break;
    } else if (c === "\\") {
      if (next !== "\n") w.text += next ?? "";
      i += 2;
    } else if (c === '"' || (c === "$" && next === '"' && !quoted)) {
      quoted = !quoted;   // a locale string `$"…"` is a double-quoted string
      i += c === "$" ? 2 : 1;
    } else if (c === "'" && !quoted) {
      const end = upTo(src, "'", i + 1);
      w.text += src.slice(i + 1, end);
      i = end + 1;
    } else if (c === "$" && next === "'" && !quoted) {
      const end = endQuote(src, i + 2, "'");
      const body = src.slice(i + 2, end);
      if (body.includes("\\")) w.literal = false;   // ANSI-C quoting decodes escapes such as `\x73`
      w.text += body;
      i = end + 1;
    } else {
      // Variables, unquoted globs and braces, and a leading tilde expand: the argument is no longer
      // the text. A `[` that the word does not close is literal (the `[` command).
      const glob = "*?{".includes(c) || (c === "[" && /^[^\s;&|<>()]*\]/.test(src.slice(i + 1)));
      const variable = c === "$" && /[\w@*#?$!-]/.test(next ?? "");
      if (variable || (!quoted && (glob || (c === "~" && i === start)))) w.literal = false;
      w.text += c;
      i++;
    }
  }
  return [w, i];
}

// Text the shell expands by running a script, kept whole up to `end`, with the scripts it runs:
// $(…), $((…)), ${…} and `…`; at the start of an unquoted word, also <(…), >(…) and {…}.
function expansionAt(src: string, i: number, wordStart: boolean): { end: number; subs: string[] } | null {
  const c = src[i];
  const next = src[i + 1];
  if (wordStart && (c === "<" || c === ">") && next === "(") {
    const end = close(src, i + 2, "(", ")");
    return { end, subs: [src.slice(i + 2, end)] };
  }
  if (wordStart && c === "{") {
    const end = close(src, i + 1, "{", "}");
    return { end, subs: [src.slice(i + 1, end)] };
  }
  if (c === "$" && next === "(") {
    const end = close(src, i + 2, "(", ")");
    const inner = src.slice(i + 2, end);
    const arithmetic = inner.startsWith("(") && inner.endsWith(")");   // $((…))
    return { end, subs: arithmetic ? substitutions(inner) : [inner] };
  }
  if (c === "$" && next === "{") {
    const end = close(src, i + 2, "{", "}");
    return { end, subs: substitutions(src.slice(i + 2, end)) };
  }
  if (c === "`") {
    const end = endQuote(src, i + 1, "`");
    return { end, subs: [src.slice(i + 1, end)] };
  }
  return null;
}

// Reads the bodies of the heredocs opened on the line that just ended; returns where the next line
// starts. `expands`: the delimiter is unquoted, so the body's substitutions run.
function heredocBodies(src: string, i: number, pending: [Redir, boolean][]): number {
  for (const [h, expands] of pending.splice(0)) {
    let body = "";
    while (i < src.length) {
      const end = upTo(src, "\n", i);
      const line = src.slice(i, end);
      i = end + 1;
      if ((h.op === "<<-" ? line.replace(/^\t+/, "") : line) === h.target.text) break;
      body += `${line}\n`;
    }
    h.stdin = { text: body, literal: true, subs: [] };
    if (expands) h.target.subs.push(...substitutions(body));
  }
  return i;
}

function lex(src: string): Command[] {
  const commands: Command[] = [];
  const pending: [Redir, boolean][] = [];
  let cmd: Omit<Command, "op"> = { words: [], redirs: [] };
  const finish = (op: string): void => {
    commands.push({ ...cmd, op });
    cmd = { words: [], redirs: [] };
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const opaque = compound(src, i);
    const redir = redirection(src, i);
    const op = OPS.find((o) => src.startsWith(o, i));
    if (c === " " || c === "\t") {
      i++;
    } else if (src.startsWith("\\\n", i)) {
      i += 2;
    } else if (c === "#") {
      i = upTo(src, "\n", i);
    } else if (c === "\n") {
      finish(";");
      i = heredocBodies(src, i + 1, pending);
    } else if (opaque !== null) {
      // The shell evaluates it itself: its keyword names the command.
      cmd.words.push({ text: src.slice(i, i + 2), literal: true, subs: [] }, opaque[0]);
      i = opaque[1];
    } else if (c === "{" && /\s/.test(src[i + 1] ?? "") && cmd.words.length + cmd.redirs.length === 0) {
      i++;   // a group runs in this shell, so its commands are read in line (its `}` is a keyword)
    } else if (redir !== null) {
      const [r, end, expands] = redir;
      if (expands !== null) pending.push([r, expands]);
      cmd.redirs.push(r);
      i = end;
    } else if (op !== undefined) {
      finish(op);
      i += op.length;
    } else {
      const [word, end] = readWord(src, i);
      if (cmd.words.length > 0 || !KEYWORDS.has(word.text)) cmd.words.push(word);
      i = end;
    }
  }
  finish(";");
  return commands;
}

// `((…))` and `[[ … ]]`: the shell evaluates them itself, so each is one word that is never a
// literal argument, whose substitutions run.
function compound(src: string, i: number): [Word, number] | null {
  if (src.startsWith("((", i)) {
    const end = close(src, i + 2, "(", ")");
    return [{ text: src.slice(i, end + 2), literal: false, subs: substitutions(src.slice(i + 2, end)) }, end + 2];
  }
  if (src.startsWith("[[", i) && /\s/.test(src[i + 2] ?? "")) {
    const end = upTo(src, "]]", i);
    const text = src.slice(i + 2, end).trim();
    return [{ text, literal: false, subs: substitutions(text) }, end + 2];
  }
  return null;
}

// A redirection operator and its target word. For a heredoc, the third value tells whether its body
// expands (the delimiter is unquoted); null for any other redirection.
function redirection(src: string, i: number): [Redir, number, boolean | null] | null {
  REDIR.lastIndex = i;
  const m = REDIR.exec(src);
  if (m === null) return null;
  const [target, end] = readWord(src, REDIR.lastIndex);
  const r: Redir = { op: m[1]!, target, stdin: m[1] === "<<<" ? target : null };
  return [r, end, r.op === "<<" || r.op === "<<-" ? !/['"\\]/.test(src.slice(REDIR.lastIndex, end)) : null];
}

// ── Analysis ──────────────────────────────────────────────────────────────────────

function resolve(cwd: string | null, path: string): string | null {
  if (/^[a-z]:|^\/\//i.test(slash(path)) || (cwd !== null && /^[a-z]:|^\/\//i.test(slash(cwd)))) {
    return cwd === null ? absolutePath(path) ? slash(path) : null : slash(win32.resolve(cwd, path));
  }
  return path.startsWith("/") ? posix.normalize(path) : cwd === null ? null : posix.join(cwd, path);
}

// The first cause that one of `items` yields.
function first<T>(items: T[], cause: (item: T) => Cause | null): Cause | null {
  return items.reduce<Cause | null>((found, item) => found ?? cause(item), null);
}

// GNU-style options: in a cluster (`-abc`) a letter that `valued` lists takes the rest of the word
// or the next word; `--name=value`, or `--name value` when `valued` lists it. Every word after
// `--` is an operand. `stop`: the first operand ends the options (a wrapper's command, a script).
function getopt(args: Word[], valued: string[], stop = false): { flags: Flag[]; operands: Word[] } {
  const flags: Flag[] = [];
  const operands: Word[] = [];
  for (let i = 0; i < args.length; i++) {
    const w = args[i]!;
    const t = w.text;
    if (t === "--" || (stop && !/^-./.test(t))) return { flags, operands: [...operands, ...args.slice(t === "--" ? i + 1 : i)] };
    if (!/^-./.test(t)) {
      operands.push(w);
    } else if (t.startsWith("--")) {
      const eq = t.indexOf("=");
      flags.push(eq > 0 ? [t.slice(0, eq), { ...w, text: t.slice(eq + 1) }] : [t, valued.includes(t) ? args[++i] : undefined]);
    } else {
      for (let k = 1; k < t.length; k++) {
        const flag = t.charAt(0) + t.charAt(k);
        const takes = valued.includes(flag);
        flags.push([flag, !takes ? undefined : k + 1 < t.length ? { ...w, text: t.slice(k + 1) } : args[++i]]);
        if (takes) break;
      }
    }
  }
  return { flags, operands };
}

// A path is checked whole and in pieces, so `--file=.pregate/x` and code strings are covered too.
// A word the shell expands is checked once more for each protected name its glob segments can
// expand to (`.c*` is .claude, .codex and .cursor). With an unknown cwd a relative piece is checked
// under `/`, which still matches the `**/` globs, and under the call's cwd.
function mentionsProtected(w: Word, cwd: string | null, ctx: Ctx): boolean {
  const text = w.text.replace(/%(\w+)%|\$env:(\w+)/gi, (all, cmd?: string, ps?: string) =>
    SPELLED[(cmd ?? ps)!.toUpperCase()] ?? all).replace(VARIABLE, (all, lead: string, braced?: string, bare?: string) =>
    Object.hasOwn(SPELLED, braced ?? bare ?? "") ? lead + SPELLED[(braced ?? bare)!] : all);
  const bases = cwd === null ? ["/", ctx.origin] : [cwd];
  return [...new Set([...(w.literal ? [text] : expansions(text)), ...text.split(PIECES)])]
    .some((p) => p !== "" && bases.some((base) => {
      let path = resolve(base, p)!;
      // A future tool's descriptor is not the hook process's descriptor. Its
      // target is unknown, so do not resolve it into an unproven permission.
      if (/^\/dev\/(stdin|stdout|stderr|fd\/[0-9]+)$/.test(path)) return true;
      if (path.includes("\0")) return true;
      for (;;) {
        const verdict = protectedOrParent(path, ctx);
        if (typeof verdict === "boolean") return verdict;
        if (verdict === path) return true;
        path = verdict;
      }
    }));
}

function protectedOrParent(path: string, ctx: Ctx): boolean | string {
  try { return ctx.isProtected(path); }
  catch (error) {
    if ((error as { code?: string }).code !== "ENAMETOOLONG") throw error;
    // This leaf cannot be a filesystem target. Keep checking its real
    // ancestor; independently split path pieces are still checked below.
    return /^[a-z]:|^\/\//i.test(path) ? slash(win32.dirname(path)) : posix.dirname(path);
  }
}

// The word with each glob segment replaced by each protected name it matches, the word itself
// first. A shell expands a leading dot only when the pattern spells it. Capped: a word made of
// globs gets the first names, not every combination.
function expansions(text: string): string[] {
  return text.split(/([/=\s]+)/).reduce<string[]>((words, part) => {
    const names = /[*?[]/.test(part) ? PROTECTED_NAMES.filter((n) => n.startsWith(".") === part.startsWith(".") && matches(part, n)) : [];
    return words.flatMap((w) => [part, ...names].map((p) => w + p)).slice(0, 256);
  }, [""]);
}

// `inScope` decides for a file; `ctx.under` for a path that may be a directory written whole.
function writes(targets: Word[], cwd: string | null, inScope: (abs: string) => boolean): Cause | null {
  // PowerShell's /dev/null, and a process substitution (a pipe; its command is analyzed as a sub).
  const files = targets.filter((t) => t.text.toLowerCase() !== "$null" && (t.literal || !/^[<>]\(/.test(t.text)));
  return files.map((t) => (t.literal ? resolve(cwd, t.text) : null)).some((abs) => {
    if (abs === null) return true;
    // Windows may not report ENAMETOOLONG during scope inspection. Deny oversized
    // components before treating an unprovable write target as outside the scope.
    if (abs.split(/[\\/]/).some((name) => name.length > 255)) return true;
    return inScopeOrTooLong(abs, inScope);
  }) ? "shell-write" : null;
}

function inScopeOrTooLong(abs: string, inScope: (abs: string) => boolean): boolean {
  try { return inScope(abs); }
  catch (error) { if ((error as { code?: string }).code === "ENAMETOOLONG") return true; throw error; }
}

// Inline code (python -c, node -e, heredoc to an interpreter): any dotted or slashed token may name
// a file, so one that resolves in scope is a write by the edit tools' back door. Dots and slashes
// alone (perl's `$.`, `..`, a `/` delimiter) name a folder at most, not a file.
function code(w: Word, cwd: string | null, ctx: Ctx): Cause | null {
  if (!w.literal) return "shell-write";
  if (mentionsProtected(w, cwd, ctx)) return "protected-path";
  const files = w.text.split(PIECES).filter((p) => /[./]/.test(p) && /[^./]/.test(p)).map((p) => ({ text: p, literal: true, subs: [] }));
  return writes(files, cwd, ctx.inScope);
}

// A script given as text (sh -c, eval, a heredoc or a pipe to a shell) is analyzed again when the
// text is known; when it is not, it may write anything.
function inline(w: Word | null | undefined, cwd: string | null, ctx: Ctx): Cause | null {
  if (!w) return null;
  return w.literal ? script(w.text, cwd, ctx) : "shell-write";
}

// eval, Invoke-Expression and pwsh -Command join their arguments into one script.
function joined(args: Word[]): Word {
  return { text: args.map((w) => w.text).join(" "), literal: args.every((w) => w.literal), subs: [] };
}

// `block`: a PowerShell script block, where only `&` calls a statement that starts with `$`.
function script(src: string, cwd: string | null, ctx: Ctx, block = false): Cause | null {
  const saved: (string | null)[] = [];
  const subCtx: Ctx = { ...ctx, vars: new Map(ctx.vars), pendingProtected: new Set() };
  let pipedIn = false, called = false, calling = false;
  for (const command of lex(src)) {
    bindNames(command, subCtx.bound);
    const { words } = command;
    const cause = computed(command, calling) ? "shell-admin" : simple(statement(command, block && !called, saved.length === 0), cwd, subCtx, pipedIn);
    if (cause !== null && (!subCtx.machineOnly || ALWAYS.has(cause))) return cause;
    ctx.held ??= subCtx.held ?? cause;
    const { op } = command;
    const pipe = op === "|" || op === "|&";
    // A cd inside a pipeline or in the background runs in a subshell and moves nothing.
    if (!pipedIn && !pipe && op !== "&") cwd = moved(command.words, cwd);
    pipedIn = pipe;
    called = op === "&";
    calling = called && words.length + command.redirs.length === 0;   // a leading `&` calls
    if (op === "(") saved.push(cwd);
    if (op === ")" && saved.length > 0) cwd = saved.pop()!;
  }
  return subCtx.pendingProtected.size > 0 ? "protected-path" : null;
}

// `& (…)` and `. (…)` run whatever a PowerShell expression yields; a POSIX shell rejects both.
// `calling`: the statement started with `&`.
function computed(command: Command, calling: boolean): boolean {
  const { words, op } = command;
  return op === "(" && ((calling && words.length === 0) || (words.length === 1 && words[0]!.text === "."));
}

// What a statement runs. A case pattern (`*.ts)` with no subshell open) names no command; in a
// PowerShell script block a statement that starts with `$` is an expression.
function statement(command: Command, block: boolean, outside: boolean): Command {
  if (outside && command.op === ")") return { ...command, words: command.words.map((w) => ({ ...w, literal: true })) };
  return block ? expression(command) : command;
}

// The variables a POSIX script binds itself (`x=…`, `read x`, `for x in "a b"`): its `$x` is that
// shell's command, not a PowerShell value. A loop over plain words or a glob binds one word.
function bindNames(command: Command, bound: Set<string>): void {
  const texts = command.words.map((w) => w.text);
  for (const text of texts) bound.add(ASSIGNMENT.exec(text)?.[1] ?? "");
  const [head, name = "", ...rest] = texts;
  if ((head === "for" || head === "select") && rest.slice(1).some((t) => /[\s$`]/.test(t))) bound.add(name);
  if (head === "read" || head === "mapfile" || head === "readarray") for (const t of [name, ...rest]) bound.add(t);
}

// A statement that starts with `$` is a PowerShell expression (`$_.CPU -gt 100`), not a command.
function expression(command: Command): Command {
  const at = command.words.findIndex((w) => !ASSIGNMENT.test(w.text));
  const head = command.words[at];
  return head?.text.startsWith("$") ? { ...command, words: command.words.with(at, { ...head, literal: true }) } : command;
}

// The cwd after a command: unchanged unless it is a cd; null when the destination is not literal.
// `cd -`, `popd` and `pushd +N` go back to a directory the command does not name.
function moved(words: Word[], cwd: string | null): string | null {
  const [head, ...args] = words[0]?.text === "builtin" || words[0]?.text === "command" ? words.slice(1) : words;
  const name = head?.text.toLowerCase() ?? "";
  if (!CD.has(name)) return cwd;
  const dir = args.find((w) => !/^-./.test(w.text));
  return name.startsWith("pop") || dir === undefined || !dir.literal || /^[-+]/.test(dir.text) ? null : resolve(cwd, dir.text);
}

const VAR_REF = /^\$(?:\{([A-Za-z_]\w*)\}|([A-Za-z_]\w*))$/;

function validLauncherValue(val: string, cwd: string | null, ctx: Ctx): "launcher" | "plain" | null {
  const abs = resolve(cwd, val);
  if (abs !== null && ctx.launcher !== null && pathKey(abs) === pathKey(ctx.launcher)) return "launcher";
  const root = ctx.engines === undefined ? null : pathKey(ctx.engines) + "/";
  const rel = abs !== null && root !== null && pathKey(abs).startsWith(root) ? pathKey(abs).slice(root.length) : "";
  if (/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.]+)?\/pregate(?:\.exe)?$/.test(rel)) return "launcher";
  const base = basename(slash(val)).toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
  return base === "pregate" && !mentionsProtected({ text: val, literal: true, subs: [] }, cwd, ctx) ? "plain" : null;
}

function expandBoundVar(w: Word, vars: ReadonlyMap<string, string>, asHead: boolean): Word {
  const m = w.subs.length === 0 ? VAR_REF.exec(w.text) : null;
  const name = m ? (m[1] ?? m[2]!) : null;
  if (name && vars.has(name)) return { text: vars.get(name)!, literal: asHead, subs: [] };
  if (w.subs.length > 0 || vars.size === 0 || !w.text.includes("$")) return w;
  const expanded = w.text.replace(/\$(?:\{([A-Za-z_]\w*)\}|([A-Za-z_]\w*))/g, (all, b?: string, u?: string) => vars.get(b ?? u ?? "") ?? all);
  return expanded === w.text ? w : { ...w, text: expanded };
}

function bindCommandVars(cmd: Command, cwd: string | null, ctx: Ctx): { words: Word[]; redirs: Redir[]; exempt: Set<Word>; usedVar: string | null } | "protected-path" {
  const headIdx = cmd.words.findIndex((w) => !ASSIGNMENT.test(w.text));
  const assigns = headIdx < 0 ? cmd.words : cmd.words.slice(0, headIdx);
  const exempt = new Set<Word>();
  for (const w of assigns) {
    const m = /^([A-Za-z_]\w*)=(.*)$/s.exec(w.text);
    const name = m?.[1] ?? "", rhs = m?.[2] ?? "";
    if (ctx.pendingProtected.has(name)) return "protected-path";
    const kind = headIdx < 0 && cmd.redirs.length === 0 && w.literal && w.subs.length === 0 && !HOOK_SWITCH.test(name) && !GIT_SWITCH.test(name)
      ? validLauncherValue(rhs, cwd, ctx) : null;
    if (kind !== null) {
      ctx.vars.set(name, rhs);
      if (kind === "launcher") { ctx.pendingProtected.add(name); exempt.add(w); }
    } else ctx.vars.delete(name);
  }
  const rawHead = headIdx < 0 ? undefined : cmd.words[headIdx];
  const ref = rawHead && rawHead.subs.length === 0 ? VAR_REF.exec(rawHead.text) : null;
  const usedVar = ref ? (ref[1] ?? ref[2]!) : null;
  const words = cmd.words.map((w, i) => i < (headIdx < 0 ? cmd.words.length : headIdx) ? w : expandBoundVar(w, ctx.vars, i === headIdx));
  const redirs = cmd.redirs.map((r) => DATA_REDIRS.has(r.op) ? r : { ...r, target: expandBoundVar(r.target, ctx.vars, false) });
  return { words, redirs, exempt, usedVar: usedVar && ctx.vars.has(usedVar) ? usedVar : null };
}

// `pipedIn`: stdin comes from the previous command of a pipeline, so it is unknown text.
function simple(cmd: Command, cwd: string | null, ctx: Ctx, pipedIn: boolean): Cause | null {
  const all = [...cmd.words, ...cmd.redirs.map((r) => r.target)];
  const nested = first(all.flatMap((w) => w.subs), (sub) => script(sub, cwd, ctx))
    ?? first(all.flatMap((w) => w.blocks ?? []), (body) => script(body, cwd, ctx, true));
  if (nested !== null) return nested;
  const bound = bindCommandVars(cmd, cwd, ctx);
  if (bound === "protected-path") return "protected-path";
  const { words, redirs, exempt, usedVar } = bound;
  // The pre-check names the launcher, which lives in protected .pregate/: that one mention is allowed.
  const head = words.find((w) => !ASSIGNMENT.test(w.text));
  const precheck = head !== undefined && ctx.launcher !== null && head.literal
    && pathKey(resolve(cwd, head.text) ?? "") === pathKey(ctx.launcher)
    && readOnlyPregate(words.slice(words.indexOf(head) + 1), true);
  const enginePath = head?.literal ? resolve(cwd, head.text) : null;
  const engineRoot = ctx.engines === undefined ? null : pathKey(ctx.engines) + "/";
  const engineRelative = enginePath !== null && engineRoot !== null && pathKey(enginePath).startsWith(engineRoot)
    ? pathKey(enginePath).slice(engineRoot.length) : "";
  const engineInspection = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.]+)?\/pregate(?:\.exe)?$/.test(engineRelative)
    && readOnlyPregate(words.slice(words.indexOf(head!) + 1), false);
  const contractInput = head !== undefined && head.literal && (precheck || basename(slash(head.text)).replace(/\.exe$/i, "") === "pregate")
    ? readContractInput(words.slice(words.indexOf(head) + 1), cwd) : null;
  const guideInputs = ctx.guideInspection && head !== undefined ? guideInputPaths(words.slice(words.indexOf(head) + 1)) : [];
  const descriptions = commandDescriptions(words);
  const inspectedPython = head !== undefined && /^python[\d.]*$/.test(basename(slash(head.text)))
    && head.literal && pythonInspection(words.slice(words.indexOf(head) + 1));
  const paths = [...words, ...redirs.filter((r) => !DATA_REDIRS.has(r.op)).map((r) => r.target)];
  const reading = policyReadKind(words);
  const policyInput = (w: Word) => reading !== null && words.slice(1).includes(w) && ctx.policyRead?.(resolve(cwd, w.text) ?? "", reading) === true;
  const configurationInput = (w: Word) => ctx.configurationInspection && words.slice(1).includes(w)
    && ctx.configurationRead?.(resolve(cwd, w.text) ?? "") === true;
  // An agent loads the skill in a sequence of commands (`pwd; rg --files; cat <skill>`), so this read
  // is not bound to a single-command line. The call is still literal, with no option, no
  // redirection and no pipe on either side.
  const skillCall = !pipedIn && cmd.redirs.length === 0 && [";", "&&", "||"].includes(cmd.op) && words[0]?.text === "cat" && words.length > 1
    && words.every(w => w.literal && w.subs.length === 0) && words.slice(1).every((w, i) => (i === 0 && w.text === "--") || !w.text.startsWith("-"));
  const skillInput = (w: Word) => skillCall && words.slice(1).includes(w) && ctx.skillRead?.(resolve(cwd, w.text) ?? "") === true;
  if (paths.some((w) => !exempt.has(w) && !((precheck || engineInspection) && w === head) && !(inspectedPython && w === words.at(-1)) && w !== contractInput && !guideInputs.includes(w) && !descriptions.includes(w) && mentionsProtected(w, cwd, ctx) && !policyInput(w) && !configurationInput(w) && !skillInput(w))) return "protected-path";
  if (usedVar && (precheck || engineInspection)) ctx.pendingProtected.delete(usedVar);
  // A redirection from a literal file keeps the path: a shell or an interpreter that runs its stdin
  // reads that file for control commands. The text itself is not analyzed. null: the terminal.
  // A non-literal `< "$S"` is not a file this process can read, so the script is unknown.
  const input = redirs.findLast((r) => r.op === "<" || DATA_REDIRS.has(r.op));
  const fromFile = input?.op === "<" && input.target.literal ? resolve(cwd, input.target.text) : null;
  const unread = input?.op === "<" && !input.target.literal ? UNKNOWN : UNREAD;
  const stdin = input === undefined ? (pipedIn ? UNKNOWN : null) : input.stdin ?? (fromFile === null ? unread : { ...UNREAD, file: fromFile });
  const outputs = redirs.filter((r) => WRITE_REDIRS.has(r.op) && !(r.op === ">&" && /^(\d+-?|-)$/.test(r.target.text)));
  return run(words, cwd, ctx, stdin) ?? writes(outputs.map((r) => r.target), cwd, ctx.inScope);
}

function policyReadKind(words: Word[]): "admitted" | "inspect" | "inventory" | null {
  if (!words.every(w => w.literal)) return null;
  const head = words[0]?.text ?? "";
  if (head === "git" && words[1]?.text === "add" && words.slice(2).every(w => w.text === "--" || !w.text.startsWith("-"))) return "admitted";
  if (head === "git" && words[1]?.text === "diff" && words[2]?.text === "--" && words.slice(3).every(w => !w.text.startsWith("-"))) return "inspect";
  if (head === "cat" && words.slice(1).every(w => w.text === "--" || !w.text.startsWith("-"))) return "inspect";
  return head === "ls" ? "inventory" : null;
}

// Only this literal operand is input data. Redirections and other commands remain protected.
function readContractInput(args: Word[], cwd: string | null): Word | null {
  if (!args.every((w) => w.literal) || !readOnlyPregate(args, false)) return null;
  if (args[0]?.text === "preset" && args[1]?.text === "apply") {
    const input = args.slice(2).find(w => w.text !== "--preview");
    const abs = input === undefined ? null : resolve(cwd, input.text);
    return abs !== null && matches(`**/${REQUESTS}`, abs) ? input! : null;
  }
  if (args[0]?.text !== "pack") return null;
  if (!["show", "add"].includes(args[1]?.text ?? "")) return null;
  const at = args.findIndex((w) => w.text === "--path");
  return at < 0 ? null : args[at + 1] ?? null;
}

// `ci` only reads provider files and GitHub. It does not change the contract or the installation.
function ciInspection(args: Word[]): boolean {
  if (args[0]?.text !== "ci" || !args.every((word) => word.literal && word.subs.length === 0)) return false;
  const sub = args[1]?.text;
  if (sub === "detect") return args.length === 2 || (args.length === 3 && args[2]?.text === "--json");
  if (sub !== "status" && sub !== "wait") return false;
  for (let i = 2; i < args.length; i++) {
    const flag = args[i]!.text;
    if (flag === "--json") continue;
    if (!["--sha", "--require", "--timeout", "--interval"].includes(flag)) return false;
    if (sub === "status" && (flag === "--timeout" || flag === "--interval")) return false;
    const value = args[++i]?.text;
    if (value === undefined || value.startsWith("-")) return false;
    if (flag === "--require" && !["github-actions", "vercel", "github"].includes(value)) return false;
    if ((flag === "--timeout" || flag === "--interval") && !/^\d+$/.test(value)) return false;
    if (flag === "--sha" && !/^[0-9a-f]{7,64}$/i.test(value)) return false;
  }
  return true;
}

// Allowed pregate subcommands: read-only ones. Through the launcher, `check` must read stdin.
function contractRecovery(args: Word[]): boolean {
  if (!args.every(w => w.literal)) return false;
  if (args.map(w => w.text).join(" ") === "pack update --all --preview") return true;
  if (args[0]?.text === "update" && args[1]?.text === "--projects") return args.length >= 4
    && args.filter(w => w.text === "--preview").length === 1
    && args.slice(2).every(w => w.text === "--preview" || !w.text.startsWith("-"));
  if (args[0]?.text === "update") return args.length === 3 && args.every(w => w.literal)
    && args.slice(1).filter(w => w.text === "--project").length === 1
    && args.slice(1).filter(w => w.text === "--preview").length === 1;
  if (args[0]?.text === "preset" && args[1]?.text === "schema") return args.length === 2 && args.every(w => w.literal);
  if (args[0]?.text === "preset" && args[1]?.text === "diagnose") return args.every(w => w.literal)
    && (args.length === 2 || (args.length === 3 && args[2]?.text === "--json"));
  return false;
}

// The coordinator may prepare a review but cannot approve it from an agent tool.
// Keep the inspection exemption exact so a future interactive option cannot inherit it.
function guideInspection(args: Word[]): boolean {
  if (args[0]?.text !== "guide" || !args.every(w => w.literal && w.subs.length === 0)) return false;
  const seen = new Set<string>();
  let mode: string | null = null, selection = false, projects = false, full = false;
  for (let i = 1; i < args.length; i++) {
    const flag = args[i]!.text;
    if (flag !== "--custom-pack" && flag !== "--compile" && seen.has(flag)) return false;
    seen.add(flag);
    if (flag === "--json" || flag === "--preview") {
      if (mode !== null) return false;
      mode = flag;
    } else if (flag === "--full") full = true;
    else if (flag === "--custom-from-docs") selection = true;
    else if (["--packs", "--custom-pack", "--enforcement", "--preset", "--layers", "--compile"].includes(flag)) {
      const value = args[++i]?.text;
      if (!value || value.startsWith("-")) return false;
      if (flag === "--enforcement" && !["shadow", "enforce", "advisor"].includes(value)) return false;
      if (flag === "--packs" && !value.split(",").every(name => /^[a-z][a-z0-9-]*$/.test(name.trim()))) return false;
      selection = true;
    } else if (flag === "--projects") {
      const start = i + 1;
      while (args[i + 1] !== undefined && !args[i + 1]!.text.startsWith("-")) i++;
      if (i < start) return false;
      projects = true;
    } else return false;
  }
  return mode !== null && !(projects && selection) && !(mode === "--json" && selection) && (!full || mode === "--preview");
}

function isolatedGuideInspection(command: string): boolean {
  if (!command.includes("guide")) return false;
  const calls = lex(command.trim());
  if (calls.length !== 1 || calls[0]!.redirs.length !== 0 || calls[0]!.op !== ";") return false;
  const [head, ...args] = calls[0]!.words;
  return head?.literal === true && basename(slash(head.text)).replace(/\.(exe|cmd)$/i, "") === "pregate" && guideInspection(args);
}

function guideInputPaths(args: Word[]): Word[] {
  const inputs: Word[] = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i]!.text === "--custom-pack" || args[i]!.text === "--layers" || args[i]!.text === "--compile") inputs.push(args[++i]!);
    else if (args[i]!.text === "--projects") {
      while (args[i + 1] !== undefined && !args[i + 1]!.text.startsWith("-")) inputs.push(args[++i]!);
    }
  }
  return inputs;
}

function readOnlyPregate(args: Word[], stdinOnly: boolean): boolean {
  if (guideInspection(args) || contractRecovery(args)) return true;
  if (args.length === 4 && args.every(word => word.literal) && args[0]?.text === "session" && args[1]?.text === "rebase"
    && /^[\w-][\w.:-]*$/.test(args[2]!.text) && args[3]?.text === "--preview") return true;
  if (args.some(w => ["--help", "-h"].includes(w.text))) return args.every(w => w.literal) && commandHelp(args.map(w => w.text));
  if (args[0]?.text === "preset" && args[1]?.text === "request-schema") return args.length === 2 && args.every(w => w.literal);
  if (args[0]?.text === "preset" && args[1]?.text === "apply") return args.length === 4 && args.every(w => w.literal)
    && args.slice(2).filter(w => w.text === "--preview").length === 1 && args.slice(2).filter(w => !w.text.startsWith("-")).length === 1;
  if (args.length === 1 && args[0]?.literal && ["--help", "-h"].includes(args[0].text)) return true;
  if (args[0]?.text === "fitness") return fitnessInspection(args);
  if (args.every((w) => w.literal) && args[0]?.text === "audit") return true;
  if (args.every((w) => w.literal) && args[0]?.text === "scan") return true;
  if (args[0]?.literal && args[0].text === "status" && (args.length === 1 || (args.length === 2 && args[1]?.literal && ["--json", "--verbose"].includes(args[1].text)))) return true;
  if (args.every((w) => w.literal) && args[0]?.text === "approve" && args[1]?.text === "--preview" && (args.length === 2 || (args.length === 3 && args[2]?.text === "--full"))) return true;
  if (args.every((w) => w.literal) && ["init", "promote"].includes(args[0]?.text ?? "")
    && args.some((w) => w.text === "--preview") && !args.some((w) => w.text === "--yes")) return true;
  if (args.every((w) => w.literal) && args[0]?.text === "project" && ["launcher", "hooks"].includes(args[1]?.text ?? "")
    && args.some((w) => w.text === "--preview") && !args.some((w) => w.text === "--yes")) return true;
  if (args[0]?.text === "issue") return issueInspection(args);
  if (args.every((w) => w.literal) && args[0]?.text === "feedback" && ["list", "draft", "show"].includes(args[1]?.text ?? "")) return true;
  if (args.every((w) => w.literal) && args[0]?.text === "storage" && ["inspect", "prune", "recover", "show"].includes(args[1]?.text ?? "")) return true;
  if (args.every((w) => w.literal) && args[0]?.text === "pack") {
    if (["list", "show"].includes(args[1]?.text ?? "")) return true;
    if (args.length === 2 && args[1]?.text === "restore") return true;
    if (["add", "apply", "update", "enable", "disable", "remove"].includes(args[1]?.text ?? "")
      && args.some((w) => w.text === "--preview") && !args.some((w) => w.text === "--yes")) return true;
  }
  if (args[0]?.text === "report") return true;
  if (args.length === 1 && ["--version", "doctor", "report", "status"].includes(args[0]!.text)) return true;
  if (ciInspection(args)) return true;
  const [sub, second] = args.filter((w) => !w.text.startsWith("-")).map((w) => w.text);
  if (sub === "check") return !stdinOnly || args.some((w) => w.text === "--stdin");
  return sub === "explain" || (sub === "preset" && second === "show") || (sub === "rules" && second === "test");
}

// A recovery preview must reach the installed engine even when the lock pins an
// engine that predates the recovery command. Only one literal command qualifies;
// its normal guard still runs. Writes and application checks retain locked routing.
export function recoveryCommand(command: string, cwd: string, launcher: string, engines: string): boolean {
  if (!/p.*r.*e.*g.*a.*t.*e/i.test(command)) return false;
  const calls = lex(command.trim());
  if (calls.length !== 1 || calls[0]!.redirs.length !== 0 || calls[0]!.op !== ";") return false;
  const [head, ...args] = calls[0]!.words;
  if (!head?.literal || calls[0]!.words.some(w => !w.literal || w.subs.length !== 0)) return false;
  const path = pathKey(resolve(cwd, head.text) ?? "");
  const home = pathKey(engines) + "/";
  const relative = path.startsWith(home) ? path.slice(home.length) : "";
  const known = head.text === "pregate" || path === pathKey(launcher)
    || /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.]+)?\/pregate(?:\.exe)?$/.test(relative);
  return known && (guideInspection(args) || contractRecovery(args) || commandHelp(args.map(w => w.text)));
}

// Expansion in a note/title is data. Nested commands were independently guarded
// by simple(); no expanded command name, flag or approval operand is admitted.
function issueInspection(args: Word[]): boolean {
  if (!args[0]?.literal || !args[1]?.literal) return false;
  if (args[1].text === "list") return args.length === 2;
  return args[1].text === "show" ? args.every(w => w.literal)
    : args[1].text === "draft" && issueDraftArgs(args.slice(2));
}

function descriptiveInputs(args: Word[]): Word[] {
  const issue = args[0]?.text === "issue" && args[1]?.text === "draft" && issueInspection(args);
  const feedback = args[0]?.text === "feedback" && args[1]?.text === "draft" && args.every(w => w.literal);
  if (!issue && !feedback) return [];
  const values: Word[] = [];
  for (let i = 2; i < args.length; i++) {
    if (["--note", "--title"].includes(args[i]!.text) && args[i + 1] !== undefined) values.push(args[++i]!);
  }
  return values;
}

// Message and title/body operands are data, including a substitution's result.
// simple() has already checked every substitution. File flags and pathspecs keep
// their ordinary protection; no unknown command inherits this exemption.
function commandDescriptions(words: Word[]): Word[] {
  const at = words.findIndex(word => !ASSIGNMENT.test(word.text));
  const [head, ...args] = at < 0 ? [] : words.slice(at);
  if (!head?.literal) return [];
  const name = basename(slash(head.text)).toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
  if (name === "pregate") return descriptiveInputs(args);
  if (name === "env" || name === "command" || name === "builtin") {
    const nested = getopt(args, WRAPPERS.get(name) ?? [], true).operands;
    return commandDescriptions(nested);
  }
  let data: Word[], flags: string[];
  if (GREPS.has(name)) return grepPatterns(args);
  if (name === "git") {
    const operands = getopt(args, ["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"], true).operands;
    if (!operands[0]?.literal || operands[0].text !== "commit") return [];
    data = operands.slice(1); flags = ["-m", "--message"];
  } else if (name === "gh" && args[0]?.literal && args[0].text === "pr" && args[1]?.literal && ["create", "edit"].includes(args[1].text)) {
    data = args.slice(2); flags = ["-t", "--title", "-b", "--body"];
  } else return [];
  const values: Word[] = [];
  for (let i = 0; i < data.length && data[i]!.text !== "--"; i++) {
    const flag = data[i]!;
    if (!flag.literal) continue;
    if (flags.includes(flag.text) && data[i + 1] !== undefined) values.push(data[++i]!);
    else if (flags.some(name => name.startsWith("--") ? flag.text.startsWith(name + "=") : flag.text.startsWith(name) && flag.text.length > name.length)) values.push(flag);
  }
  return values;
}

// A search pattern is data: `-e P`, `--regexp=P`, else the first operand. Pattern files (-f) and
// rg's --pre command keep their checks.
const GREPS = new Set(["grep", "egrep", "fgrep", "rg"]);
function grepPatterns(args: Word[]): Word[] {
  const { flags, operands } = getopt(args, ["-e", "--regexp", "-f", "--file", "-m", "-A", "-B", "-C", "--pre", "-g", "--glob", "-t", "--type"]);
  const given = flags.filter(([flag, value]) => (flag === "-e" || flag === "--regexp") && value?.literal).map(([, value]) => value!);
  const patterns = given.length > 0 || flags.some(([flag]) => flag === "-f" || flag === "--file") ? given : operands.slice(0, 1);
  return patterns.filter((w) => w.literal);
}

function fitnessInspection(args: Word[]): boolean {
  if (!args.every(w => w.literal)) return false;
  return ["status", "run", "plan", "fingerprint"].includes(args[1]?.text ?? "")
    || args[1]?.text === "bind" && args.some(w => w.text === "--preview") && !args.some(w => w.text === "--yes");
}

function issueDraftArgs(args: Word[]): boolean {
  for (let i = 0; i < args.length; i++) {
    const word = args[i]!;
    if (!word.literal) return false;
    if (["--note", "--title"].includes(word.text)) {
      if (args[++i] === undefined) return false;
    } else if (["--repro"].includes(word.text)) {
      if (!args[++i]?.literal) return false;
    } else if (!["--last", "--no-event", "--include-code"].includes(word.text) && !/^[0-9a-f]{24}$/.test(word.text)) return false;
  }
  return true;
}

// A git hook switch or another harness still lets a hook switch or a protected path behind it
// deny: those hold without a root, and shell-admin does not.
function run(words: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  const at = words.findIndex((w) => !ASSIGNMENT.test(w.text));
  const assigned = (at < 0 ? words : words.slice(0, at)).map((w) => ASSIGNMENT.exec(w.text)![1]!);
  const [head, ...args] = at < 0 ? [] : words.slice(at);
  // `CI=1` alone (or exported) binds the rest of the line; `CI=1 cmd` binds cmd and its children
  // only: `CI=1 bun test && pregate status` does not run pregate under CI.
  const ci = assigned.includes("CI");
  if (ci && head === undefined) ctx.ciSet = true;
  const descriptions = commandDescriptions(words);
  const admin = administers({ words: words.filter(w => !descriptions.includes(w)), assigned, head, args }, ctx.gated);
  if (admin === "hook-switch" || head === undefined) return admin;
  const was = ctx.ciSet;
  if (ci) ctx.ciSet = true;
  const cause = invoke(head, args, cwd, ctx, stdin);
  if (ci) ctx.ciSet = was;   // `export CI=1` inside invoke binds the rest of the line and is kept
  return admin === null || (cause !== null && ALWAYS.has(cause)) ? cause : admin;
}

function invoke(head: Word, args: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  const name = basename(slash(head.text)).toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
  if (!head.literal) return unnamed(head, args, cwd, ctx, stdin);
  if (EXPORTS.has(name)) return run(args.filter((w) => ASSIGNMENT.test(w.text)), cwd, ctx, stdin);
  // A sourced script runs like a command: `. pregate approve` runs the launcher in this shell.
  if (name === "source" || name === ".") return run(args, cwd, ctx, stdin);
  if (name === "pregate") return ctx.ciSet ? "hook-switch" : pregate(args, ctx.guideInspection);
  if (name === "command" && args.some((w) => /^-[vV]$/.test(w.text))) return null;   // lookup, no execution
  const runner = RUNNERS.has(`${name} ${args[0]?.text}`);
  if (WRAPPERS.has(name) || runner) return wrapped(runner ? "npx" : name, runner ? args.slice(1) : args, cwd, ctx, stdin);
  if (name === "find") return find(args, cwd, ctx);
  if (name === "git") return git(args, cwd, ctx);
  if (name === "rsync") return rsync(args, cwd, ctx);
  if (ARCHIVES.has(name)) return archiveTar(args, cwd, ctx);
  if (name === "unzip") return unzip(args, cwd, ctx);
  if (FIXERS.has(name)) return fixer(name, args, cwd, ctx);
  if (SHELLS.has(name)) return shell(args, cwd, ctx, stdin);
  if (name === "pwsh" || name === "powershell") return powershell(args, cwd, ctx, stdin);
  if (name === "cmd" || name === "cmd.exe") {
    const at = args.findIndex((w) => /^\/[ck]$/i.test(w.text));
    return at < 0 ? "shell-write" : inline(joined(args.slice(at + 1)), cwd, ctx);
  }
  if (name === "eval" || name === "invoke-expression" || name === "iex") return inline(joined(args), cwd, ctx);
  const interpreter = name.replace(/^python[\d.]*$/, "python");
  if (INTERPRETERS.has(interpreter)) return interpret(interpreter, args, cwd, ctx, stdin);
  if (name === "make" || name === "gmake" || name === "mingw32-make") return makefile(args, cwd, ctx) ?? writes(targets(name, args), cwd, ctx.inScope);
  const scripted = head.literal ? namedScript(head, name, cwd, ctx) : null;
  if (scripted !== null) return scripted;
  if (COPIES.has(name)) return copies(name === "copy" || name === "move" ? args.filter((w) => !/^\/-?[yabvndz]$/i.test(w.text)) : args, cwd, ctx);
  if (SESSIONS.has(name)) return "shell-write";
  if (EDITORS.has(name)) return stdin === null ? "shell-write" : first([...args, stdin], (w) => code(w, cwd, ctx));
  // A patch names its files inside: read like code when it comes in the command (a heredoc).
  if (name === "patch" || name === "apply_patch" || name === "applypatch") {
    if (args.some((w) => /^(--dry-run|--check|-C)$/.test(w.text))) return null;
    return (stdin === null ? null : code(stdin, cwd, ctx)) ?? "shell-write";
  }
  return writes(targets(name, args), cwd, ctx.inScope);
}

// A command name the shell builds (`${T}fia`, `$(echo pregate)`, `` `…` ``, `$'\x74…'`, a brace or
// glob) may be any command, PREGATE's own approval included: shell-admin. When only its directory
// expands (`"$DIR"/tool`, `~/bin/tool`) the name is known; such a command might still write any of
// its operands. A PowerShell value names no command, but an assignment runs its right-hand side.
function unnamed(head: Word, args: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  const value = psValue(head, args, ctx.bound);
  if (value !== null) return run(value, cwd, ctx, stdin);
  const name = head.text.slice(head.text.lastIndexOf("/") + 1);
  if (/[$`\\{}()*?[]/.test(name)) return "shell-admin";
  const cause = invoke({ ...head, literal: true }, args, cwd, ctx, stdin);
  // Under the home folder the path is as known as a literal one: `~/bin/tool` is `/home/u/bin/tool`.
  // Only the home prefix may expand: `$HOME/$DIR/tool` is as unknown as `"$DIR"/tool`.
  return cause ?? (/^(~|\$HOME|\$\{HOME\})\/[^$`\\{}()*?[]*$/.test(head.text) ? null : writes(getopt(args, []).operands, cwd, ctx.inScope));
}

// A variable, its member or element, an increment or a list item, or the target of `=`.
const PS_VALUE = /^(?:\[[\w.]+\])?\$([A-Za-z_]\w*)(?::\w+)?(?:\.\w+|\[[^\]]*\])*(?:[-+*/]?=(.*)|\+\+|--|,)?$/s;
const PS_OPERATOR = /^(-(eq|ne|gt|ge|lt|le|like|notlike|match|notmatch|contains|notcontains|is|isnot|as|and|or|xor|join|split)|[-+*/%]|[-+*/]?=)$/i;

// PowerShell reads a statement that starts with a variable as a value (`$c | Set-Content f`,
// `$list.Add(1)`, `$x++`, `$a, $b = 1, 2`): the words it runs, the right-hand side of an
// assignment or none. null: a command name, as a POSIX shell reads `$x` it bound itself or
// `"$PYTHON" -m pytest`.
function psValue(head: Word, args: Word[], bound: ReadonlySet<string>): Word[] | null {
  const m = PS_VALUE.exec(head.text);
  if (m === null || bound.has(m[1]!)) return null;
  if (m[2] !== undefined) return [...(m[2] === "" ? [] : [{ ...head, text: m[2] }]), ...args];
  const eq = args.findIndex((w) => /^[-+*/]?=$/.test(w.text));
  if (eq >= 0 && args.slice(0, eq).every((w) => PS_VALUE.test(w.text))) return args.slice(eq + 1);
  return args.length === 0 || head.text.endsWith(",") || PS_OPERATOR.test(args[0]!.text) ? [] : null;
}

// What switches hooks off or reaches past this harness. hook-switch: an option or variable that
// runs a harness without the user's configuration, or a harness command that manages its hooks or
// the pregate plugin, or a harness run with another HOME. shell-admin: a git hook switch, such as
// --no-verify or `HUSKY=0 git …` (PowerShell's `$env:HUSKY=0` sets it for the commands that
// follow), or another harness as the command.
function administers({ words, assigned, head, args }: { words: Word[]; assigned: string[]; head: Word | undefined; args: Word[] }, gated: GuardContext["gated"]): Cause | null {
  const psEnv = /^\$env:(\w+)/i.exec(head?.text ?? "")?.[1]!.toUpperCase() ?? "";
  const cmdEnv = head?.text.toLowerCase() === "set" ? /^(\w+)=/.exec(args[0]?.text ?? "")?.[1]?.toUpperCase() ?? "" : "";
  const names = [...assigned, psEnv, cmdEnv];
  // Cursor's CLI is also `agent`: only as the command itself, never as a folder name.
  const command = slash(head?.text ?? "").toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
  const harness = head !== undefined && (HARNESS.test(command) || basename(command) === "agent");
  if (words.some((w) => HOOK_WORD.test(w.text) || HOOK_FLAG.test(w.text)) || (harness && args.some((w) => HOOK_STEM.test(w.text))) || names.some((n) => HOOK_SWITCH.test(n))) return "hook-switch";
  if (harness && (names.includes("HOME") || args.some((w) => HOOK_ARG.test(w.text)))) return "hook-switch";
  if (harness && args.some((w) => /^(plugins?|hooks?|--config|--config-file|--plugins-path|--plugin-dir)$/i.test(w.text))) return "hook-switch";
  if (harness && args.some((w, i) => /^(?:-c|--config)(?:=|$)/.test(w.text) && /\b(hooks|disableAllHooks|pregate)\b/i.test(w.text + " " + (args[i + 1]?.text ?? "")))) return "hook-switch";
  const other = harness && (!head?.literal || !gated?.has(basename(command)));
  return other || words.some((w) => ADMIN_WORD.test(w.text)) || names.some((n) => GIT_SWITCH.test(n)) ? "shell-admin" : null;
}

// The read-only subcommands run; setup, update and uninstall, or one that cannot be named, change
// what every harness runs (MH-17).
function pregate(args: Word[], guideAllowed: boolean): Cause | null {
  if (args.every((w) => w.literal) && args[0]?.text === "pack" && args[1]?.text === "init") return null;
  // A draft writes only an inactive, unprotected pack folder; the command itself refuses the rest.
  if (args.every((w) => w.literal) && args[0]?.text === "rules" && args[1]?.text === "draft") return null;
  // `rules add` prepares one pending review in the data directory; only the human approves it.
  if (args.every((w) => w.literal) && args[0]?.text === "rules" && args[1]?.text === "add" && !args.some((w) => w.text === "--yes")) return null;
  if (proposal(args)) return null;
  if (args[0]?.text === "guide" && !guideAllowed && !commandHelp(args.map(w => w.text))) return "shell-admin";
  if (readOnlyPregate(args, false)) return null;
  const sub = args.find((w) => !w.text.startsWith("-"));
  return sub !== undefined && (!sub.literal || MACHINE.test(sub.text)) ? "hook-switch" : "shell-admin";
}

// `layers` and `compile` read the project, or prepare one pending review that only the human
// approves, like `rules add`. Every word is literal and no form applies anything.
function proposal(args: Word[]): boolean {
  if (!args.every((w) => w.literal && w.subs.length === 0) || args.some((w) => w.text === "--yes" || w.text === "--digest")) return false;
  const [verb, ...rest] = args.map((w) => w.text);
  if (verb === "import") return importPreview(rest);
  if (verb !== "layers" && verb !== "compile") return false;
  const flags = rest.filter((text) => text.startsWith("-")), operands = rest.filter((text) => !text.startsWith("-"));
  if (operands[0] === "apply") return operands.length === 2 && flags.includes("--preview") && flags.every((flag) => flag === "--preview" || (verb === "layers" && flag === "--complete"));
  if (verb === "layers") return operands.length === 0 && flags.every((flag) => flag === "--json");
  return operands.length === 1 && flags.length <= 1 && flags.every((flag) => ["--json", "--template", "--preview"].includes(flag));
}

// `import arkgate --preview` prepares one pending review. The config path is one literal operand.
function importPreview(rest: string[]): boolean {
  const flags = rest.filter((text) => text.startsWith("-")), operands = rest.filter((text) => !text.startsWith("-"));
  const config = flags.filter((flag) => flag === "--config").length;
  return operands[0] === "arkgate" && config <= 1 && flags.filter((flag) => flag === "--preview").length === 1
    && flags.every((flag) => flag === "--preview" || flag === "--config") && operands.length === (config === 0 ? 1 : 2);
}

function wrapped(name: string, args: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  const { flags, operands } = getopt(args, WRAPPERS.get(name) ?? [], true);
  const inner = name === "xargs" ? xargs(flags, args.slice(0, args.length - operands.length), operands) : operands;
  const option = (re: RegExp) => flags.find(([flag]) => re.test(flag));
  const call = option(/^(-c|--call)$/);   // npx -c runs a shell command line
  if (name === "npx" && call !== undefined) return inline(call[1], cwd, ctx);
  if (name === "timeout") inner.shift();   // the duration
  if (name !== "env") return run(inner, cwd, ctx, stdin);
  if (flags.some(([flag, value]) => ["-i", "--ignore-environment"].includes(flag) || (["-u", "--unset"].includes(flag) && value !== undefined && HOOK_SWITCH.test(value.text)))) return "hook-switch";
  const dir = option(/^(-C|--chdir)$/) === undefined ? cwd : null;   // the command runs elsewhere
  // -S splits one string into the command line.
  const split = option(/^(-S|--split-string)$/);
  if (split === undefined) return run(inner, dir, ctx, stdin);
  return inline(joined(split[1] === undefined ? inner : [split[1], ...inner]), dir, ctx);
}

// xargs appends the arguments it reads, unless a replace string stands for them (-I R, -J R,
// --replace[=R], GNU -i[R]; R is `{}` by default). That string may sit in any word, the command
// name or a `sh -c` script too, which then is not known: `xargs -I% sh -c '% approve'`.
function xargs(flags: Flag[], options: Word[], inner: Word[]): Word[] {
  const named = flags.find(([flag]) => /^(-[IJ]|--replace)$/.test(flag));
  const gnu = options.findLast((w) => /^-i/.test(w.text))?.text.slice(2);
  const replace = named !== undefined ? named[1]?.text || "{}" : gnu === undefined ? undefined : gnu || "{}";
  if (replace === undefined) return [...inner, UNKNOWN];
  return inner.map((w) => (w.text.includes(replace) ? { ...w, text: w.text.replaceAll(replace, "$(xargs)"), literal: false } : w));
}

function targets(name: string, args: Word[]): Word[] {
  if (name === "del" || name === "erase") return args.filter((w) => !/^\/[a-z]+$/i.test(w.text));
  if (PS_WRITERS.has(name)) return psTargets(args);
  if (name === "new-item" || name === "ni") return args.some((w) => /^-va/i.test(w.text)) ? psTargets(args) : [];
  switch (name) {
    case "tee": return getopt(args, []).operands;
    case "sed": case "gsed": return sed(args);
    case "dd": return args.filter((w) => w.text.startsWith("of=")).map((w) => ({ ...w, text: w.text.slice(3) }));
    case "truncate": return getopt(args, ["-s", "--size", "-r", "--reference"]).operands;
    case "curl": return curl(args);
    case "wget": return wget(args);
    default: return [];
  }
}

// cp/mv/ln/install and Copy-Item/Move-Item write the destination (an explicit target directory, or
// the last operand) and each source's name inside it, which may be a whole directory (`cp -r x .`).
// A source with an unknown name, or whose contents are copied (`x/`), may put anything there.
function copies(args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  let explicit: Word | undefined;
  const sources: Word[] = [];
  for (let i = 0; i < args.length; i++) {
    const w = args[i]!;
    const [flag, value] = w.text.split(/[=:](.*)/s) as [string, string | undefined];
    const lower = flag.toLowerCase();
    if (/^-[A-Za-z]*t$/.test(flag) || lower === "--target-directory" || (lower.length >= 3 && "-destination".startsWith(lower))) {
      explicit = value === undefined ? args[++i] : { ...w, text: value };
    } else if (!/^-./.test(w.text)) {
      sources.push(w);
    }
  }
  const dest = explicit ?? (sources.length > 1 ? sources.pop() : undefined);
  if (dest === undefined) return null;
  const inside = sources.map((s) => ({ ...dest, text: posix.join(dest.text, s.literal && !s.text.endsWith("/") ? basename(s.text) : ".") }));
  return writes([dest], cwd, ctx.inScope) ?? writes(inside, cwd, ctx.under);
}

// PowerShell binds parameters by any unambiguous prefix (`-Pa`), or `-Name:value`. The first
// positional argument is the path when no path parameter names it.
function psTargets(args: Word[]): Word[] {
  const named: Word[] = [];
  const operands: Word[] = [];
  for (let i = 0; i < args.length; i++) {
    const m = /^-([a-z]+)(?::(.*))?$/is.exec(args[i]!.text);
    if (m === null) {
      operands.push(args[i]!);
      continue;
    }
    const param = m[1]!.toLowerCase();
    const isTarget = PS_PATHS.some((p) => p.startsWith(param));
    if (!isTarget && !PS_VALUED.some((p) => p.startsWith(param))) continue;   // a switch
    const value = m[2] === undefined ? args[++i] : { ...args[i]!, text: m[2] };
    if (isTarget && value !== undefined) named.push(value);
  }
  return named.length > 0 ? named : operands.slice(0, 1);
}

// sed edits in place with -i/-I/--in-place; its first operand is the script unless -e/-f gave one.
// BSD sed takes the backup suffix of a bare -i as the next word, possibly empty.
function sed(args: Word[]): Word[] {
  const bsd = args.findIndex((w, k) => /^-[iI]$/.test(w.text) && /^(\.[^/]*)?$/.test(args[k + 1]?.text ?? "/"));
  const { flags, operands } = getopt(bsd < 0 ? args : args.toSpliced(bsd + 1, 1), ["-e", "-f", "--expression", "--file"]);
  if (!flags.some(([flag]) => /^(-[iI]|--in-place)$/.test(flag))) return [];
  return flags.some(([flag]) => /^(-[ef]|--expression|--file)$/.test(flag)) ? operands : operands.slice(1);
}

// curl writes -o's file, and a name taken from the URL or the response with -O or -J.
function curl(args: Word[]): Word[] {
  return getopt(args, CURL_VALUED).flags.flatMap(([flag, value]): Word[] => {
    if (/^(-[OJ]|--remote-(header-)?name)/.test(flag)) return [UNKNOWN];
    return (flag === "-o" || flag === "--output") && value !== undefined && value.text !== "-" ? [value] : [];
  });
}

// wget saves under the remote name unless -O names the file (`-O -` is stdout); -o and -a write
// its log.
function wget(args: Word[]): Word[] {
  const { flags } = getopt(args, ["-O", "--output-document", "-o", "--output-file", "-a", "--append-output"]);
  const logs = flags.filter(([flag]) => /^(-[oa]|--output-file|--append-output)$/.test(flag)).map(([, v]) => v ?? UNKNOWN);
  const output = flags.find(([flag]) => flag === "-O" || flag === "--output-document");
  const saved = flags.some(([flag]) => flag === "--spider") || output?.[1]?.text === "-" ? [] : [output?.[1] ?? UNKNOWN];
  return [...logs, ...saved];
}

function rsync(args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  if (args.some((w) => w.literal && (w.text === "--dry-run" || w.text === "-n" || w.text === "--list-only"))) return null;
  const operands = args.filter((w) => !/^-./.test(w.text));
  if (operands.length < 2) return null;
  const dest = operands.at(-1)!;
  return writes([dest], cwd, ctx.inScope) ?? (dest.literal && dest.text.endsWith("/") ? writes([{ ...dest, text: posix.join(dest.text, ".") }], cwd, ctx.under) : null);
}

// tar lists with -t; create writes an archive; extract writes into -C or the cwd.
function archiveTar(args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  let extract = false, list = false, create = false;
  for (const w of args) {
    if (!w.literal) return "shell-write";
    if (w.text === "-x" || w.text === "--extract") extract = true;
    else if (w.text === "-t" || w.text === "--list") list = true;
    else if (w.text === "-c" || w.text === "--create") create = true;
    else if (/^--(?:extract|list|create)=/.test(w.text)) {
      const mode = w.text.split("=")[0]!.slice(2);
      if (mode.startsWith("extract")) extract = true;
      else if (mode.startsWith("list")) list = true;
      else if (mode.startsWith("create")) create = true;
    }     else if (/^-[^-]+$/.test(w.text) && !w.text.startsWith("--")) {
      if (w.text.includes("x")) extract = true;
      if (w.text.includes("t")) list = true;
      if (w.text.includes("c")) create = true;
    } else if (/^[A-Za-z0-9]*[ctx][A-Za-z0-9]*$/.test(w.text)) {
      if (w.text.includes("x")) extract = true;
      if (w.text.includes("t")) list = true;
      if (w.text.includes("c")) create = true;
    }
  }
  if (list && !extract && !create) return null;
  let dest: Word = { text: ".", literal: true, subs: [] };
  for (let i = 0; i < args.length; i++) {
    const w = args[i]!;
    if (w.text === "-C" || w.text === "--directory") {
      const value = args[i + 1];
      if (value !== undefined) dest = value;
    } else if (w.text.startsWith("-C") && w.text.length > 2) {
      dest = { ...w, text: w.text.slice(2) };
    } else if (w.text.startsWith("--directory=")) {
      dest = { ...w, text: w.text.slice("--directory=".length) };
    }
  }
  if (extract) {
    if (dest.text === ".") {
      const here = cwd !== null ? resolve(cwd, ".") : null;
      if (here !== null && (ctx.inScope(here) || ctx.under(here))) return "shell-write";
      return null;
    }
    return writes([dest], cwd, ctx.inScope) ?? (dest.literal && dest.text.endsWith("/") ? writes([{ ...dest, text: posix.join(dest.text, ".") }], cwd, ctx.under) : null);
  }
  if (create && !extract) {
    for (let i = 0; i < args.length; i++) {
      const w = args[i]!;
      if (w.text === "-f" || w.text === "--file") {
        const archive = args[i + 1];
        return archive === undefined ? null : writes([archive], cwd, ctx.inScope);
      }
    }
    return null;
  }
  return null;
}

function unzip(args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  if (args.some((w) => w.literal && (w.text === "-l" || w.text === "-t" || w.text === "--list" || w.text === "--test"))) return null;
  const { flags, operands } = getopt(args, ["-d", "-o", "-x"]);
  const dest = flags.find(([flag]) => flag === "-d")?.[1];
  const targets = dest !== undefined ? [dest] : operands.length > 0 ? [{ text: ".", literal: true, subs: [] }] : [];
  return targets.length === 0 ? null : writes(targets, cwd, ctx.inScope);
}

function fixer(name: string, args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  const writesInPlace = (() => {
    if (name === "prettier") return args.some((w) => w.literal && (w.text === "--write" || w.text === "-w" || /^--write=/.test(w.text) || /^-[^-]*w/.test(w.text)));
    if (name === "eslint") return args.some((w) => w.literal && (w.text === "--fix" || /^--fix(?:=|$)/.test(w.text)));
    if (name === "ruff") return args.some((w) => w.literal && (w.text === "--fix" || /^--fix(?:=|$)/.test(w.text)));
    if (name === "biome") return args.some((w) => w.literal && (w.text === "--write" || /^--write(?:=|$)/.test(w.text) || (w.text === "format" && args.some((x) => x.literal && x.text === "--write"))));
    if (name === "gofmt") return args.some((w) => w.literal && (w.text === "-w" || w.text === "-write"));
    if (name === "rustfmt") return !args.some((w) => w.literal && (w.text === "--check" || w.text === "--emit=stdout"));
    if (name === "clang-format") return args.some((w) => w.literal && (w.text === "-i" || w.text === "--inplace"));
    return false;
  })();
  if (!writesInPlace) return null;
  const paths = args.filter((w) => !/^-./.test(w.text) && !["format", "check", "lint"].includes(w.text));
  if (paths.length === 0) return "shell-write";
  return writes(paths, cwd, ctx.inScope)
    ?? writes(paths.filter((w) => w.literal && !w.text.endsWith("/")).map((w) => ({ ...w, text: posix.join(w.text, ".") })), cwd, ctx.under);
}

function git(args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  const { flags, operands } = getopt(args, ["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"], true);
  const base = flags.reduce((dir, [flag, v]) => (flag !== "-C" ? dir : v?.literal ? resolve(dir, v.text) : null), cwd);
  const [sub, rest] = [operands[0]?.text, operands.slice(1)];
  // `commit -n` is --no-verify; an option that takes a value ends the cluster (`-mn` is the message "n").
  if (sub === "commit" && getopt(rest, ["-m", "-F", "-c", "-C", "-t"]).flags.some(([flag]) => flag === "-n")) return "shell-admin";
  const has = (re: RegExp) => rest.some((w) => re.test(w.text));
  const dash = rest.findIndex((w) => w.text === "--");
  if (sub !== undefined && movesHistory(sub, rest, dash)) {
    const literal = base !== null && rest.every((w) => w.literal)
      && flags.every(([flag, v]) => flag === "-C" || (flag === "-c" && v?.literal === true && !/^core\.(worktree|bare)\b/i.test(v.text)));
    const change = literal ? ctx.gitChanges?.(base, [sub, ...rest.map((w) => w.text)]) ?? null : null;
    if (change === null) return "shell-write";
    // Index entries are not edits. A clean checkout of an existing branch lists its files there
    // so a protected path still denies, and leaves the worktree list empty.
    if ([...change.worktree, ...change.index].some((p) => ctx.isProtected(p))) return "protected-path";
    return writes(change.worktree.map((text) => ({ text, literal: true, subs: [] })), base, ctx.inScope);
  }
  // Without `--` the first operand is a revision, unless it is `.`, which cannot name one.
  const changed = sub === "apply" ? (has(/^--(check|stat|numstat|summary)$/) ? [] : [UNKNOWN])
    : sub === "checkout" ? (dash >= 0 ? rest.slice(dash + 1) : getopt(rest, ["-b", "-B", "--orphan"]).operands.filter((w, k) => k > 0 || w.text === "."))
    : sub === "restore" ? (has(/^(--staged|-S)$/) && !has(/^(--worktree|-W)$/) ? [] : getopt(rest, ["-s", "--source"]).operands)
    : [];
  // Git expands pathspecs itself: a glob or a `:(magic)` pathspec may name any file.
  return writes(changed.map((w) => (/^:|[*?[]/.test(w.text) ? UNKNOWN : w)), base, ctx.under);
}

// A git command that rewrites the worktree or the index from another commit, a stash or nothing
// (clean): which files it changes depends on the repository, so GuardContext.gitChanges answers.
// Branch creation at HEAD, listings, dry runs and path checkouts (judged above) move nothing.
function movesHistory(sub: string, rest: Word[], dash: number): boolean {
  const flag = (re: RegExp) => rest.some((w) => re.test(w.text));
  const cluster = (letter: string) => rest.some((w) => /^-[A-Za-z]+$/.test(w.text) && w.text.includes(letter));
  switch (sub) {
    case "reset": return !flag(/^--soft$/) && (flag(/^--(hard|merge|keep)$/) || rest.some((w, k) => !/^-./.test(w.text) && (dash < 0 || k < dash)));
    case "checkout": {
      if (dash >= 0) return false;
      const { flags, operands } = getopt(rest, ["-b", "-B", "--orphan"]);
      if (flags.some(([f]) => f === "--orphan")) return false;
      return operands.length === 1 && operands[0]!.text !== "." || flags.some(([f]) => f === "--detach") && operands.length === 1;
    }
    case "switch": {
      const { flags, operands } = getopt(rest, ["-c", "-C", "--create", "--force-create", "--orphan"]);
      return operands.length > 0 || flags.some(([f]) => f === "--orphan");
    }
    case "stash": return rest.length === 0 || /^-|^(push|save|pop|apply|branch)$/.test(rest[0]!.text);
    case "clean": return (cluster("f") || flag(/^--force$/) || cluster("i") || flag(/^--interactive$/)) && !cluster("n") && !flag(/^--dry-run$/);
    case "cherry-pick": case "revert": return !flag(/^--quit$/);
    case "read-tree": return true;
    case "checkout-index": return !cluster("n") && !flag(/^--no-create$/);
    default: return false;
  }
}

function find(args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  const execs = args.flatMap((w, i) => (/^-(exec|ok)(dir)?$/.test(w.text) ? [i] : []));
  return first(execs, (i) => {
    const end = args.findIndex((w, k) => k > i && (w.text === ";" || w.text === "+"));
    // -execdir runs in each match's directory.
    return run(args.slice(i + 1, end < 0 ? args.length : end), args[i]!.text.endsWith("dir") ? null : cwd, ctx, null);
  });
}

// sh -c '<literal>' is analyzed again; a script from stdin too. A literal script file is read
// for pregate control commands. A non-literal script argument is shell-write (`bash "$SCRIPT"`).
function shell(args: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  // `+o` unsets what `-o` sets: both take a value.
  const options = args.map((w) => (w.text.startsWith("+") ? { ...w, text: `-${w.text.slice(1)}` } : w));
  const { flags, operands } = getopt(options, ["-o", "-O", "--rcfile", "--init-file"], true);
  // In a cluster bash gives `-o` the next word, not the rest of the cluster: `-oc pipefail 'cmd'`.
  if (flags.some(([flag, value]) => /^-[oO]$/.test(flag) && value !== undefined && !options.includes(value))) return "shell-write";
  const command = flags.find(([flag]) => flag === "-c" || flag === "--command");   // fish spells it out
  if (command !== undefined) return inline(command[1] ?? operands[0], cwd, ctx);
  // -s and `-` read the script from stdin and take the operands as its arguments.
  const fromStdin = operands.length === 0 || operands[0]!.text === "-" || flags.some(([flag]) => flag === "-s");
  // A literal script is read for pregate control commands. A non-literal one is not (`bash "$SCRIPT"`).
  const script = operands[0];
  if (!fromStdin && script !== undefined && script.text !== "-" && !script.literal) return "shell-write";
  if (!fromStdin && script?.literal && script.text !== "-") {
    const abs = resolve(cwd, script.text);
    const cause = abs === null ? "shell-write" : scriptFile(ctx, abs, "sh", cwd);
    if (cause !== null) return cause;
  }
  // `bash < run.sh`, `sh -s < run.sh`: the script arrives on stdin from a literal file.
  if (fromStdin && stdin?.file !== undefined) {
    const cause = scriptFile(ctx, stdin.file, "sh", cwd);
    if (cause !== null) return cause;
  }
  // A script file is not otherwise executed here, but it is named like a command: `sh "$(which pregate)" approve`.
  return fromStdin ? interactive(args, stdin) ?? inline(stdin, cwd, ctx) : run(operands, cwd, ctx, stdin);
}

// `make approve` runs the recipe, which the command line does not contain. A literal Makefile is
// scanned. A non-literal `-f` path is shell-write: the file it names cannot be read.
function makefile(args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  let named: Word | undefined;
  for (let i = 0; i < args.length; i++) {
    const word = args[i]!;
    const attached = /^(?:-f|--file|--makefile)=([\s\S]*)$/.exec(word.text);
    if (attached !== null) named = { ...word, text: attached[1]! };
    else if (word.literal && (word.text === "-f" || word.text === "--file" || word.text === "--makefile")) named = args[i + 1];
  }
  if (named !== undefined && !named.literal) return "shell-write";
  const paths = named !== undefined ? [resolve(cwd, named.text)] : ["Makefile", "makefile", "GNUmakefile"].map((name) => resolve(cwd, name));
  return first(paths, (path) => controlFile(ctx, path));
}

// A shell that reads its script from the terminal is a session (MH-29).
function interactive(args: Word[], stdin: Word | null): Cause | null {
  return stdin === null && !args.some((w) => INFORMATIVE.test(w.text)) ? "shell-write" : null;
}

function powershell(args: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  for (let i = 0; i < args.length; i++) {
    const param = /^-([a-z]+)$/i.exec(args[i]!.text)?.[1]!.toLowerCase();
    if (param === undefined) continue;
    if ("encodedcommand".startsWith(param) || param === "ec") return "shell-write";
    if (param === "file" || param === "f") {
      const target = args[i + 1];
      if (target !== undefined && !target.literal) return "shell-write";
      if (!target?.literal) return null;
      const abs = resolve(cwd, target.text);
      return abs === null ? "shell-write" : scriptFile(ctx, abs, "powershell", cwd);
    }
    if ("command".startsWith(param)) {
      const rest = args.slice(i + 1);
      return inline(rest.length === 1 && rest[0]!.text === "-" ? stdin : joined(rest), cwd, ctx);
    }
  }
  // Windows PowerShell runs bare operands as a command; for pwsh they name a script file, which
  // analyzed as a command finds nothing.
  const operands = args.filter((w) => !w.text.startsWith("-"));
  return operands.length > 0 ? inline(joined(operands), cwd, ctx) : interactive(args, stdin) ?? inline(stdin, cwd, ctx);
}

// perl's `$ARGV` names the file `-n`/`-p` is reading, not an argument: it lets the program write
// only through a call that opens, renames, runs or evaluates. `@ARGV`, `$ARGV[0]`, shift and pop
// read the arguments.
const PERL_ARGUMENTS = /ARGV\s*[[{]|[@#]\{?ARGV|\$\{ARGV|\bshift\b|\bpop\b/;
const PERL_EFFECT = /\b(open|sysopen|rename|unlink|truncate|link|symlink|chmod|chown|utime|mkdir|rmdir|system|exec|eval|do|require|syscall|qx)\b|`/;
function readsArgv(name: string, program: string): boolean {
  if (name !== "perl") return /argv/i.test(program);
  return PERL_ARGUMENTS.test(program) || (/ARGV/.test(program) && PERL_EFFECT.test(program));
}

function interpret(name: string, args: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  if (name === "python" && pythonInspection(args)) return null;
  const codeFlag = INTERPRETERS.get(name)!;
  if (codeFlag === NODE && nodeInspection(args)) return null;
  const program: Word[] = [];
  const operands: Word[] = [];
  for (let i = 0; i < args.length; i++) {
    const w = args[i]!;
    const eq = w.text.indexOf("=");
    if (codeFlag.test(w.text)) {
      if (args[i + 1] !== undefined) program.push(args[++i]!);
    } else if (w.text.startsWith("--") && eq > 0 && codeFlag.test(w.text.slice(0, eq))) {
      program.push({ ...w, text: w.text.slice(eq + 1) });
    } else if (!/^-./.test(w.text)) {
      operands.push(w);   // a script file, an option's value or the program's own arguments
    }
  }
  // A harness run by its interpreter: the entry script lives in the package's folder. A project
  // folder that shares a harness name is not one.
  const entry = operands[0]?.text.toLowerCase() ?? "";
  if (entry.includes("node_modules/") && HARNESS.test(entry)) return "shell-admin";
  // A REPL: run bare, on `-` or `repl` (bun, deno), or with -i, which python and node keep open
  // after the script. Options alone (`node --test`) usually run something else.
  const repl = args.length === 0 || entry === "-" || entry === "repl"
    || ((name === "python" || name.startsWith("node")) && args.some((w) => /^(-i|--interactive)$/.test(w.text)));
  if (repl && stdin === null) return "shell-write";
  const inlined = program.length > 0;
  if (!inlined && stdin !== null && (entry === "" || entry === "-")) program.push(stdin);
  const options = args.filter((w) => /^-./.test(w.text)).map((w) => w.text);
  // Inline code and a literal script file: `python3 -c "subprocess.run(['pregate','approve'...])"`,
  // `node -e`, `perl -e`, `ruby -e`, and `python3 attack.py`.
  const interp = name.replace(/^python[\d.]*$/, "python");
  const control = first(program, (w) => w.literal ? (w.file === undefined ? pregateControlCause(w.text) : controlFile(ctx, w.file)) : null)
    ?? (!inlined && operands[0] !== undefined && !["-", "repl"].includes(operands[0].text) && !(interp === "bun" && BUN_SUBCOMMANDS.has(operands[0].text))
      ? (operands[0].literal ? ((abs) => abs === null ? "shell-write" : scriptFile(ctx, abs, interp, cwd, options))(resolve(cwd, operands[0].text)) : "shell-write") : null);
  if (control !== null) return control;
  // Code that reads its arguments (`sys.argv[1]`, `process.argv`, `@ARGV`) may write the files they
  // name; other code only reads them (`perl -ne 'print' src/a.ts`).
  const argv = program.some((w) => readsArgv(name, w.text));
  // perl and ruby edit files in place with -i, checked on every option: in `perl -pie`, -i takes
  // "e" as its backup suffix.
  const inPlace = (name === "perl" || name === "ruby") && args.some((w) => /^-[A-Za-z0-9]*i/.test(w.text));
  return first(argv ? [...program, ...operands] : program, (w) => code(w, cwd, ctx))
    ?? first(program, (w) => (w.literal && w.file === undefined && inlineSink(name, w.text, options) ? "shell-write" : null))
    ?? (inPlace ? writes(inlined ? operands : operands.slice(1), cwd, ctx.inScope) : null);
}
