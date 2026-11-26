import { basename, posix, win32 } from "node:path";
import { absolutePath, matches, pathKey, PROTECTED_NAMES, REQUESTS, slash } from "./paths.ts";
import type { Cause, HarnessId } from "./types.ts";
import { pregateControlCause } from "./control.ts";
import { nodeInspection, pythonInspection } from "./python-inspection.ts";
import { literalWriteTargets } from "./inline-sinks.ts";

// Executable names each supported harness is launched as. `claude` and `cursor-agent` stay in the
// list because status and the shell guard already look those up. Any one of a harness's names being
// gated means every alias is: `claude` and `claude-code` are the same installation.
export const HARNESS_NAMES: Record<HarnessId, readonly string[]> = {
  "claude-code": ["claude", "claude-code"],
  codex: ["codex"],
  cursor: ["cursor-agent", "agent", "cursor"],
  grok: ["grok"],
  agy: ["agy", "antigravity"],
  opencode: ["opencode", "opencode-ai"],
};

// Recognized CLIs that PREGATE cannot register. Launching one stays denied, and the message says so
// instead of inventing a `pregate setup` step that would not gate them.
export const UNGATED_HARNESSES: readonly string[] = [
  "gemini", "gemini-cli", "qwen", "qwen-code", "copilot", "kilo", "kilocode", "amp", "cline", "junie",
  "kiro-cli", "droid", "auggie", "aider", "aider-chat",
];

const ID_BY_NAME = new Map<string, HarnessId>(
  (Object.entries(HARNESS_NAMES) as [HarnessId, readonly string[]][]).flatMap(([id, names]) => names.map((name) => [name, id])),
);

export function harnessIdOf(name: string): HarnessId | null {
  return ID_BY_NAME.get(name) ?? null;
}

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
// denies a command only when the text acts on PREGATE itself: `.pregate/`, the contract, lock,
// config and baseline files, PREGATE's own hook entries, `pregate enable` / `pregate disable`,
// an approval-forging variable, or a git hook bypass when the installed hook is PREGATE's.
// A source edit (`sed -i src/a.ts`, `echo > src/a.ts`, `git checkout -- file`) is not one of those:
// source gating belongs to the edit tools. Syntax the lexer cannot finish is shell-uncertain.
// A finished token the heuristic does not classify, such as select or coproc, is not a deny by itself.
// Stop, pre-commit and CI see the resulting tree.

// `under`: whether an in-scope path can lie at or below `abs`, for a directory written whole.
// `touched`: whether a path the guard asked about (isProtected, inScope or under) reached a root.
export interface GuardContext {
  launcher: string | null; isProtected: (abs: string) => boolean; inScope: (abs: string) => boolean; under: (abs: string) => boolean;
  touched: () => boolean;
  gated?: Pick<ReadonlySet<string>, "has">;
  engines?: string;
  policyRead?: (abs: string, kind: "admitted" | "inspect" | "inventory") => boolean;
  configurationRead?: (abs: string) => boolean;
  // The text a file had when the session began. Script runs do not consult it: an edit during
  // the session must not flip a code runner from allow to deny. Callers may still pass it.
  sessionBase?: (abs: string) => string | null;
  // Whether a path is the skill file that setup installed for the agent to read.
  skillRead?: (abs: string) => boolean;
  // Reads one literal script for pregate control commands. The shell layer supplies it; the core does not open files.
  readControlFile?: (path: string) => Cause | null;
  // Reads script bytes for sink and control scanning without the lexer importing the filesystem.
  readScriptFile?: (path: string) => { kind: "text"; text: string } | { kind: "native" } | { kind: "admin" } | { kind: "missing" } | { kind: "unreadable" };
  // Resolves a bare command name on PATH. The shell layer supplies it; the core does not read the environment.
  commandPath?: (name: string) => string | null;
  // Whether a program found on PATH lies outside every project root the guard knows: an installed
  // tool, not project code. Without it every script found on PATH is read like a project script.
  outsideRoots?: (abs: string) => boolean;
  // Set when a shell-admin denial should replace the generic sentence: an orca verb, an ungated
  // harness, or a human-only pregate enable/disable. Absent in callers that only need the cause.
  shellDetail?: { text: string | null };
  // The files a git command that moves history or the worktree would change (`args` from the
  // subcommand on), or null when they cannot be known. Without it such a command may write anything.
  // `worktree` paths are edits when they are in scope. `index` paths deny only when protected.
  // A clean checkout of an existing branch reports its files on `index` only.
  gitChanges?: (cwd: string, args: string[]) => GitChanges | null;
  // True when this checkout's git hook is the one pregate installed. Absent means it is not.
  pregateGitHook?: (cwd: string) => boolean;
}
export interface GitChanges { worktree: string[]; index: string[] }
// `machineOnly`: neither the cwd nor the session reached a root (MH-17). `held`: the first cause
// that applies only with a root, kept while the rest of the command is read. `origin`: the call's
// cwd, where a command whose cwd is unknown most likely runs. `bound`: the variables the command
// line binds POSIX-style, shared by its nested scripts.
type Ctx = GuardContext & { machineOnly: boolean; harness: HarnessId; held: Cause | null; origin: string; guideInspection: boolean; configurationInspection: boolean;
  vars: Map<string, string>; pendingProtected: Set<string>; bound: Set<string>; ciSet: boolean; direct: boolean };

// What denies in any session: the machine's protected paths (isProtected answers which), what
// switches off the hooks of every repo, and an agent granting itself approval. The rest needs a
// path of the command to reach a root.
const ALWAYS: ReadonlySet<Cause> = new Set<Cause>(["protected-path", "hook-switch", "approval"]);

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
  if (read.kind === "native" || read.kind === "missing" || read.kind === "admin") return null;
  if (read.kind === "unreadable") return shellWrite(ctx, "the script could not be read");
  const lang = interpreter.replace(/^python[\d.]*$/, "python").replace(/^nodejs$/, "node");
  if (SHELL_INTERPRETERS.has(lang)) {
    const src = lang === "powershell" && read.text.includes("\\") ? read.text.replace(/\\(?=[\w.-])/g, "/") : read.text;
    return nestedScript(src, cwd, ctx);
  }
  // A node, python, ruby, perl or php file is allowed unless it names a literal write into a
  // gated or protected path. Importing a file-system module, or differing from the session base,
  // is not that write. The session snapshot used to forgive an unchanged file and deny it after
  // any edit; that flip is what made `pnpm run` deny a script `node` still allowed.
  return programWrites(read.text, cwd, ctx);
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
interface Command { words: Word[]; redirs: Redir[]; op: string; grouped: boolean }
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
// orca, orca-dev, orca-ide, agent-browser and agent-desktop drive a browser or a desktop.
// They are not harnesses. hostPolicy judges their subcommands. Do not add those names here.
// Git takes any unambiguous prefix of a long option: `--no-veri` is the shortest --no-verify.
// `core.hooksPath` is a hook switch when a command sets it. A read-only `git config` query names
// that key and is not one; `readOnlyGitConfig` is the only exemption (issue 114).
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
// Names that forge approval, reveal a test answer, or accept a loosened contract. They match
// PREGATE_\w+ below, so callers check this first and report `approval` instead of `hook-switch`.
const APPROVAL_VAR = /^PREGATE_(?:UNATTENDED_APPROVAL|TESTING|TEST_ANSWER|ACCEPT_CONTRACT)$/;
const HOOK_SWITCH = /^(HOME|USERPROFILE|LOCALAPPDATA|APPDATA|XDG_\w+|PREGATE_\w+|GROK_CLAUDE_HOOKS_ENABLED|CODEX_HOME|GROK_HOME|CLAUDE_CONFIG_DIR)$/;

function variableCause(name: string): "approval" | "hook-switch" | null {
  if (APPROVAL_VAR.test(name)) return "approval";
  return HOOK_SWITCH.test(name) ? "hook-switch" : null;
}
// Real flags that skip a harness's permissions or approvals. They are options, never prompt text:
// `claude -p "--yolo"` is a prompt, `claude --yolo` is the flag.
const SKIP_PERMISSION = /^(--dangerously-skip-permissions|--yolo|--dangerously-bypass-approvals-and-sandbox|--dangerously-bypass-hook-trust)$/i;
// Replacing the config file, or naming a plugin directory, leaves the installed hooks behind.
// `-c` is a single override and is a hook switch only when that override names hooks.
const HARNESS_CONFIG_FILE = new Set(["--config", "--config-file", "--plugins-path", "--plugin-dir"]);
const HARNESS_PROMPT = new Set(["-p", "--print", "--prompt"]);
// Flags whose next word is a value, not a hook subcommand and not a prompt to scan.
const HARNESS_VALUE = new Set(["-p", "--print", "--prompt", "--model", "-m", "--output-format", "--resume", "--session-id",
  "--permission-mode", "--add-dir", "--append-system-prompt", "--system-prompt"]);
const LAUNCH_MODE = /^(exec|run|e|x|review|resume|chat|prompt)$/i;
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
    vars: new Map(), pendingProtected: new Set(), bound: new Set(), ciSet: false, direct: true };
  const cause = script(command, cwd, ctx) ?? (command.includes("\\") ? script(command.replace(/\\(?=[\w.-])/g, "/"), cwd, ctx) : null);
  if (cause !== null) return cause;
  // The lexer finished no stronger cause. An unfinished token was not classified, so it denies.
  if (syntaxGap(command)) return "shell-uncertain";
  return ctx.held !== null && ctx.touched() ? ctx.held : null;
}

// True when a quote, a command substitution, an arithmetic expansion, a [[ test, a { group,
// or a heredoc is opened and not closed. A finished word the heuristic does not know is not a gap.
export function syntaxGap(src: string): boolean {
  return unfinished(src, 0, src.length, "none").open;
}

function unfinished(src: string, from: number, to: number, stop: "none" | ")" | "}"): { i: number; open: boolean } {
  let i = from;
  let quote: "'" | '"' | null = null;
  let braces = 0;
  while (i < to) {
    const c = src[i]!;
    const next = src[i + 1];
    if (quote === "'") {
      if (c === "'") quote = null;
      i++;
      continue;
    }
    if (c === "\\") { i += next === undefined ? 1 : 2; continue; }
    if (quote === '"') {
      if (c === '"') { quote = null; i++; continue; }
      const sub = substitution(src, i, to);
      if (sub !== null) {
        if (sub.open) return sub;
        i = sub.i;
        continue;
      }
      i++;
      continue;
    }
    if (c === "#" && (i === from || /[\s;|&]/.test(src[i - 1]!))) {
      const nl = src.indexOf("\n", i);
      i = nl < 0 || nl >= to ? to : nl + 1;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; i++; continue; }
    if (c === "<" && next === "<" && src[i + 2] !== "<") {
      const heredoc = skipHeredoc(src, i, to);
      if (heredoc === null) { i += 2; continue; }
      if (heredoc < 0) return { i, open: true };
      i = heredoc;
      continue;
    }
    if (groupOpen(src, i)) { braces++; i++; continue; }
    if (c === "}" && braces > 0) { braces--; i++; continue; }
    const sub = substitution(src, i, to);
    if (sub !== null) {
      if (sub.open) return sub;
      i = sub.i;
      continue;
    }
    if (src.startsWith("((", i)) {
      const end = matchClose(src, i + 2, to, "(", ")");
      if (end < 0 || end + 1 >= to || src[end] !== ")" || src[end + 1] !== ")") return { i, open: true };
      i = end + 2;
      continue;
    }
    if (src.startsWith("[[", i) && (i + 2 >= to || /\s/.test(src[i + 2]!))) {
      const end = src.indexOf("]]", i + 2);
      if (end < 0 || end >= to) return { i, open: true };
      i = end + 2;
      continue;
    }
    if (stop !== "none" && c === stop && braces === 0) return { i, open: false };
    i++;
  }
  return { i, open: quote !== null || braces !== 0 };
}

function substitution(src: string, i: number, to: number): { i: number; open: boolean } | null {
  if (src[i] === "`") {
    const end = src.indexOf("`", i + 1);
    if (end < 0 || end >= to) return { i, open: true };
    return { i: end + 1, open: false };
  }
  if (src[i] !== "$") return null;
  const next = src[i + 1];
  if (next === "(" && src[i + 2] === "(") {
    const end = matchClose(src, i + 3, to, "(", ")");
    if (end < 0 || end + 1 >= to || src[end] !== ")" || src[end + 1] !== ")") return { i, open: true };
    return { i: end + 2, open: false };
  }
  if (next === "(") {
    const inner = unfinished(src, i + 2, to, ")");
    if (inner.open || src[inner.i] !== ")") return { i, open: true };
    return { i: inner.i + 1, open: false };
  }
  if (next === "{") {
    const inner = unfinished(src, i + 2, to, "}");
    if (inner.open || src[inner.i] !== "}") return { i, open: true };
    return { i: inner.i + 1, open: false };
  }
  return null;
}

function groupOpen(src: string, i: number): boolean {
  if (src[i] !== "{") return false;
  const prev = i === 0 ? " " : src[i - 1]!;
  const next = src[i + 1];
  return /[\s;|&(]/.test(prev) && (next === undefined || /\s/.test(next));
}

function matchClose(src: string, from: number, to: number, open: string, close: string): number {
  let depth = 1;
  for (let i = from; i < to; i++) {
    const c = src[i]!;
    if (c === "\\") { i++; continue; }
    if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1);
      if (end < 0 || end >= to) return -1;
      i = end;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return -1;
}

// The index after a closed heredoc, -1 when the body never ends, null when this << is not one.
function skipHeredoc(src: string, i: number, to: number): number | null {
  let j = i + 2;
  const strip = src.startsWith("<<-", i);
  if (strip) j++;
  while (j < to && (src[j] === " " || src[j] === "\t")) j++;
  let delim = "";
  if (src[j] === "'" || src[j] === '"') {
    const q = src[j]!;
    const end = src.indexOf(q, j + 1);
    if (end < 0 || end >= to) return -1;
    delim = src.slice(j + 1, end);
    j = end + 1;
  } else if (src[j] === "\\") {
    j++;
    while (j < to && /[A-Za-z0-9_]/.test(src[j]!)) delim += src[j++];
  } else {
    while (j < to && /[A-Za-z0-9_]/.test(src[j]!)) delim += src[j++];
  }
  if (delim === "") return null;
  const nl = src.indexOf("\n", j);
  if (nl < 0 || nl >= to) return -1;
  let at = nl + 1;
  while (at <= to) {
    const next = src.indexOf("\n", at);
    const end = next < 0 || next > to ? to : next;
    const line = src.slice(at, end);
    if ((strip ? line.replace(/^\t+/, "") : line) === delim) return end === to ? end : end + 1;
    if (next < 0 || next >= to) return -1;
    at = next + 1;
  }
  return -1;
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

// Literal paths this command names, including redirect targets and substitutions. The caller
// decides which of them are enforced. A non-literal target is omitted.
export function literalPaths(command: string, cwd: string): string[] {
  const found: string[] = [];
  const pending = [command];
  const seen = new Set<string>();
  while (pending.length > 0 && seen.size < 32) {
    const source = pending.pop()!;
    if (seen.has(source)) continue;
    seen.add(source);
    for (const call of lex(source)) {
      const words = [...call.words, ...call.redirs.map((redir) => redir.target)];
      for (const word of words) {
        if (word.subs.length > 0) pending.push(...word.subs);
        if (!word.literal || word.text === "" || word.text.startsWith("-")) continue;
        const abs = resolve(cwd, word.text);
        if (abs !== null) found.push(abs);
      }
    }
  }
  return found;
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
  let cmd: Omit<Command, "op" | "grouped"> = { words: [], redirs: [] };
  // `{ … }` runs in this shell, but it is not the command the human typed. A function body is the
  // same shape (`cd() { pregate approve --yes; }`). Those commands are not an in-harness approval.
  let depth = 0;
  const finish = (op: string): void => {
    commands.push({ ...cmd, op, grouped: depth > 0 });
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
      depth++;
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
      if (word.text === "}" && depth > 0 && cmd.words.length === 0) depth--;
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

function shellWrite(_ctx: Ctx | undefined, _reason: string): null {
  return null;
}

// A literal path a program writes. Protected paths stay protected-path. A path inside the
// project scope is shell-write and the message names that path. Anything else is not a gated edit.
function programWrites(program: string, cwd: string | null, ctx: Ctx): Cause | null {
  for (const target of literalWriteTargets(program)) {
    const abs = resolve(cwd, target);
    if (abs === null) return shellWrite(ctx, `the write target \`${shown(target)}\` is not a literal path`);
    try {
      if (ctx.isProtected(abs)) {
        if (ctx.shellDetail && ctx.shellDetail.text === null) ctx.shellDetail.text = `the write target \`${shown(target)}\` is protected`;
        return "protected-path";
      }
    } catch (error) {
      if ((error as { code?: string }).code === "ENAMETOOLONG") return shellWrite(ctx, `the write target \`${shown(target)}\` is longer than a file name allows`);
      throw error;
    }
    const scoped = writes([{ text: target, literal: true, subs: [] }], cwd, ctx.inScope, ctx);
    if (scoped !== null) return scoped;
  }
  return null;
}

// The program writes whatever path its arguments name (`open(sys.argv[1], "w")`, `unlink $ARGV`).
// A literal operand that lands in scope or on a protected path is that write. An operand that
// does not is not.
function argvWrites(name: string, program: string, operands: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  if (!readsArgv(name, program)) return null;
  if (!/\b(?:open|writeFile|unlink|file_put_contents|File\.write|system|exec)\b/.test(program) && !/>\s*\$/.test(program)) return null;
  for (const operand of operands) {
    if (!operand.literal || operand.text === "" || operand.text.startsWith("-")) continue;
    const abs = resolve(cwd, operand.text);
    if (abs === null) return shellWrite(ctx, `the argument \`${shown(operand.text)}\` is not a literal path`);
    try {
      if (ctx.isProtected(abs)) {
        if (ctx.shellDetail && ctx.shellDetail.text === null) ctx.shellDetail.text = `the argument \`${shown(operand.text)}\` is protected`;
        return "protected-path";
      }
    } catch (error) {
      if ((error as { code?: string }).code === "ENAMETOOLONG") return shellWrite(ctx, `the argument \`${shown(operand.text)}\` is longer than a file name allows`);
      throw error;
    }
    const scoped = writes([operand], cwd, ctx.inScope, ctx);
    if (scoped !== null) return scoped;
  }
  return null;
}

function shown(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 160 ? `${one.slice(0, 157)}...` : one;
}

// `inScope` decides for a file; `ctx.under` for a path that may be a directory written whole.
function writes(targets: Word[], cwd: string | null, inScope: (abs: string) => boolean, ctx?: Ctx): Cause | null {
  // PowerShell's /dev/null, and a process substitution (a pipe; its command is analyzed as a sub).
  const files = targets.filter((t) => t.text.toLowerCase() !== "$null" && (t.literal || !/^[<>]\(/.test(t.text)));
  for (const t of files) {
    const abs = t.literal ? resolve(cwd, t.text) : null;
    if (abs === null) return shellWrite(ctx, `the write target \`${shown(t.text)}\` is not a literal path`);
    // Windows may not report ENAMETOOLONG during scope inspection. Deny oversized
    // components before treating an unprovable write target as outside the scope.
    if (abs.split(/[\\/]/).some((name) => name.length > 255)) return shellWrite(ctx, "the write target is longer than a file name allows");
    if (inScopeOrTooLong(abs, inScope)) return shellWrite(ctx, `the write target \`${shown(abs)}\` is inside the project`);
  }
  return null;
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
  return writes(files, cwd, ctx.inScope, ctx);
}

// A script given as text (sh -c, eval, a heredoc or a pipe to a shell) is analyzed again when the
// text is known; when it is not, it may write anything.
function inline(w: Word | null | undefined, cwd: string | null, ctx: Ctx): Cause | null {
  if (!w?.literal) return null;
  return nestedScript(w.text, cwd, ctx);
}

// eval, Invoke-Expression and pwsh -Command join their arguments into one script.
function joined(args: Word[]): Word {
  return { text: args.map((w) => w.text).join(" "), literal: args.every((w) => w.literal), subs: [] };
}

// A script, substitution or `sh -c` string is not the human's typed command. `held` is how a
// machine-only shell-admin still denies once the caller has touched a root: it has to travel back
// to the context `guard` owns, which a copied context would otherwise keep.
function nestedScript(src: string, cwd: string | null, ctx: Ctx, block = false): Cause | null {
  const child: Ctx = { ...ctx, direct: false };
  const cause = script(src, cwd, child, block);
  if (child.held !== null) ctx.held ??= child.held;
  return cause;
}

// `block`: a PowerShell script block, where only `&` calls a statement that starts with `$`.
function script(src: string, cwd: string | null, ctx: Ctx, block = false): Cause | null {
  const saved: (string | null)[] = [];
  const subCtx: Ctx = { ...ctx, vars: new Map(ctx.vars), pendingProtected: new Set() };
  let pipedIn = false, called = false, calling = false, subshell = 0, forged = false;
  for (const command of lex(src)) {
    bindNames(command, subCtx.bound);
    const { words } = command;
    // A brace group or a subshell is another command the human did not type as `pregate approve`.
    const savedDirect = subCtx.direct;
    if (command.grouped || subshell > 0) subCtx.direct = false;
    const raw = computed(command, calling) ? null : simple(statement(command, block && !called, saved.length === 0), cwd, subCtx, pipedIn);
    const cause = raw === "shell-write" ? null : raw;
    subCtx.direct = savedDirect;
    // An approval-forging assignment stays denied. A later statement that really switches hooks
    // off, or touches a protected path, keeps that cause. A source write is not a shell denial.
    if (cause === "hook-switch" || cause === "protected-path") return cause;
    if (cause === "approval") forged = true;
    else if (cause !== null && !forged && (!subCtx.machineOnly || ALWAYS.has(cause))) return cause;
    else ctx.held ??= subCtx.held ?? cause;
    const { op } = command;
    if (op === "(") subshell++;
    else if (op === ")" && subshell > 0) subshell--;
    const pipe = op === "|" || op === "|&";
    // A cd inside a pipeline or in the background runs in a subshell and moves nothing.
    if (!pipedIn && !pipe && op !== "&") cwd = moved(command.words, cwd);
    pipedIn = pipe;
    called = op === "&";
    calling = called && words.length + command.redirs.length === 0;   // a leading `&` calls
    if (op === "(") saved.push(cwd);
    if (op === ")" && saved.length > 0) cwd = saved.pop()!;
  }
  if (subCtx.pendingProtected.size > 0) return "protected-path";
  return forged ? "approval" : null;
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
  const nested = first(all.flatMap((w) => w.subs), (sub) => nestedScript(sub, cwd, ctx))
    ?? first(all.flatMap((w) => w.blocks ?? []), (body) => nestedScript(body, cwd, ctx, true));
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
  return run(words, cwd, ctx, stdin) ?? writes(outputs.map((r) => r.target), cwd, ctx.inScope, ctx);
}

const GIT_READS: ReadonlySet<string> = new Set(["status", "log", "diff", "show", "ls-files", "blame", "rev-parse", "cat-file", "grep", "ls-tree"]);
const READERS: ReadonlySet<string> = new Set(["head", "tail", "wc", "stat", "grep", "egrep", "fgrep", "rg", "jq", "shasum", "sha256sum", "md5", "md5sum", "du"]);

function policyReadKind(words: Word[]): "admitted" | "inspect" | "inventory" | null {
  if (!words.every(w => w.literal)) return null;
  const head = words[0]?.text ?? "";
  if (head === "git" && words[1]?.text === "add" && words.slice(2).every(w => w.text === "--" || !w.text.startsWith("-"))) return "admitted";
  if (head === "git" && words[1]?.text === "diff" && words[2]?.text === "--" && words.slice(3).every(w => !w.text.startsWith("-"))) return "inspect";
  if (head === "cat" && words.slice(1).every(w => w.text === "--" || !w.text.startsWith("-"))) return "inspect";
  // Commands that only read. An option that writes a file (--output) or runs a program on the
  // files it found (git grep -O, --ext-diff, rg --pre) is not a read.
  if (head === "git" && GIT_READS.has(words[1]?.text ?? "") && !words.some(w => /^(--output|-O|--open-files-in-pager|--ext-diff|--textconv|--filters)/.test(w.text))) return "inventory";
  if (READERS.has(head) && !words.some(w => /^(--pre|--pre-glob|--hostname-bin)(=|$)/.test(w.text))) return "inventory";
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
  const admin = administers({ words: words.filter(w => !descriptions.includes(w)), assigned, head, args }, ctx, cwd);
  if (admin === "hook-switch" || head === undefined) return admin;
  const was = ctx.ciSet;
  if (ci) ctx.ciSet = true;
  const cause = invoke(head, args, cwd, ctx, stdin);
  if (ci) ctx.ciSet = was;   // `export CI=1` inside invoke binds the rest of the line and is kept
  // The assignment forged approval. A command that itself switches hooks off, or touches a
  // protected path, keeps that cause. Anything else stays `approval`, still denied.
  if (admin === "approval") return cause === "hook-switch" || cause === "protected-path" ? cause : "approval";
  return admin === null || (cause !== null && ALWAYS.has(cause)) ? cause : admin;
}

// Host-automation CLIs drive a browser or a desktop for an agent. They are not harnesses.
// The policy applies once the guard can place files (`outsideRoots` is set), which is both the
// consent path and the inactive-consent path. A context that cannot place the file still reads
// the launcher as a project script. A drive or inventory command is not a project write: the
// launcher text is read for control commands only. An output path still goes through `writes`.
// Launching another agent is shell-admin. Switching that agent's hooks off is hook-switch.
// An orca verb that is none of those, when the launcher is inside a project, is shell-admin and
// names the tool and the verb. The same verb on a launcher outside every project stays allowed.
const HOST_TOOLS = new Set(["orca", "orca-dev", "orca-ide", "agent-browser", "agent-desktop"]);
const OUTPUT_FLAGS = ["--output", "--out", "-o", "--path", "--file", "--trace", "--screenshot", "--annotate"];
const HOST_VALUED = [...OUTPUT_FLAGS, "--url", "--element", "--value", "--text", "--worktree", "--page", "--limit", "--selector",
  "--depth", "--name", "--index", "--command", "--expression", "--input", "--files", "--key", "--direction", "--amount",
  "--timeout", "--timeout-ms", "--host", "--environment", "--agent", "--prompt", "--model", "--effort", "--device", "--app",
  "--window-id", "--screen", "--session", "--fps", "--threshold", "--agent-id", "--wait-timeout"];
const OUTPUT_COMMANDS = new Set(["screenshot", "full-screenshot", "pdf", "record", "download"]);
const OUTPUT_EXT = /\.(?:png|jpe?g|gif|webp|pdf|html?|jsonl|webm|mp4|mkv|txt)$/i;
const ORCA_DRIVE = new Set(["console", "network", "snapshot", "click", "type", "navigate", "goto", "screenshot", "full-screenshot", "pdf",
  "fill", "wait", "exec", "back", "reload", "forward", "select", "check", "uncheck", "scroll", "hover", "focus", "keypress", "key", "press",
  "upload", "eval", "cookie", "cookies", "inserttext", "viewport", "status", "open"]);
const BROWSER_DRIVE = new Set(["open", "back", "forward", "reload", "read", "snapshot", "get", "is", "click", "dblclick", "fill", "type",
  "press", "keyboard", "hover", "focus", "select", "check", "uncheck", "scroll", "drag", "upload", "mouse", "find", "wait", "screenshot",
  "pdf", "record", "download", "diff", "cookies", "storage", "network", "set", "clipboard", "eval", "pushstate", "tab", "frame", "dialog",
  "console", "errors", "highlight", "inspect", "trace", "profiler", "vitals", "react", "a11y", "session", "state", "auth", "profiles",
  "close", "connect", "goto", "navigate", "scrollintoview", "key", "keydown", "keyup", "confirm", "deny"]);
const DESKTOP_DRIVE = new Set(["snapshot", "find", "get", "is", "screenshot", "list-surfaces", "click", "double-click", "triple-click",
  "right-click", "type", "set-value", "clear", "focus", "select", "toggle", "check", "uncheck", "expand", "collapse", "scroll", "scroll-to",
  "press", "hover", "drag", "mouse-move", "mouse-click", "mouse-wheel", "key-down", "key-up", "mouse-down", "mouse-up", "launch", "close-app",
  "list-apps", "list-windows", "list-displays", "focus-window", "resize-window", "move-window", "minimize", "maximize", "restore",
  "open-system-surface", "notifications", "clipboard", "wait", "status", "permissions", "version"]);

function hostPolicy(name: string, head: Word, args: Word[], cwd: string | null, ctx: Ctx): Cause | null | undefined {
  if (!HOST_TOOLS.has(name) || ctx.outsideRoots === undefined) return undefined;
  const located = hostPath(head, cwd, ctx);
  const control = controlFile(ctx, located);
  if (control !== null) return control;
  const { flags, operands } = getopt(args, HOST_VALUED);
  const words = operands.map((word) => word.text);
  const kind = classifyHost(name, words, flags);
  if (kind.deny !== null) return kind.deny;
  const spilled = hostOutputs(words, flags, operands, cwd, ctx);
  if (spilled !== null) return spilled;
  if (kind.drive) return null;
  if (located !== null && ctx.outsideRoots(located)) return null;
  if (name === "orca" || name === "orca-dev" || name === "orca-ide") return orcaUnknown(name, words, ctx);
  return undefined;
}

function hostPath(head: Word, cwd: string | null, ctx: Ctx): string | null {
  if (/[\\/]/.test(head.text)) return resolve(cwd, head.text);
  if (ctx.commandPath === undefined || head.text === "" || head.text.includes("\0")) return null;
  const found = ctx.commandPath(head.text);
  return found === null || found === "" ? null : found;
}

function classifyHost(name: string, words: string[], flags: Flag[]): { drive: boolean; deny: Cause | null } {
  if (name === "orca" || name === "orca-dev" || name === "orca-ide") {
    if (orcaInspect(words, flags)) return { drive: true, deny: null };
    return { drive: orcaDrive(words), deny: orcaDenied(words, flags) };
  }
  const [a, b] = words;
  const verbs = name === "agent-browser" ? BROWSER_DRIVE : DESKTOP_DRIVE;
  return { drive: (a !== undefined && verbs.has(a)) || (a === "skills" && (b === "get" || b === "list")), deny: null };
}

// Read-only inventory. The real orca CLI has `ports`, `diagnostics memory`, `agent-context`,
// `status`, bare help, and `--help`/`--version` (version only when no subcommand is present).
// `doctor`, `info`, `version`, `list` and a second word `list`/`info`/`help`/`version`
// (`worktree list`, `project list`) are the same kind of read: they do not launch an agent.
// `--help`/`-h` returns before dispatch, including on a command that would otherwise be denied.
function orcaInspect(words: string[], flags: Flag[]): boolean {
  if (words.length === 0) return true;
  if (flags.some(([flag]) => flag === "--help" || flag === "-h")) return true;
  const [a, b] = words;
  if (a === "ports" || a === "doctor" || a === "version" || a === "info" || a === "help" || a === "list" || a === "agent-context") return true;
  if (a === "diagnostics" && (b === undefined || b === "memory")) return true;
  return b === "list" || b === "info" || b === "help" || b === "version";
}

// The launcher is project code, so an unclassified verb is not silently re-parsed. The sentence
// names the tool and the verb; agent launch and hooks off keep the generic sentences.
function orcaUnknown(_name: string, _words: string[], _ctx: Ctx): Cause | null {
  return null;
}

function orcaDrive(words: string[]): boolean {
  const [a, b] = words;
  if (a === undefined) return false;
  if (ORCA_DRIVE.has(a) || a === "computer" || a === "emulator" || a === "tab" || a === "capture") return true;
  if (a === "skills" && (b === "get" || b === "list")) return true;
  return a === "set" && b === "device";
}

// `agent launch` starts an agent. `worktree create --agent` launches one in the new worktree.
// `automations run` runs a scheduled agent prompt. `terminal create|split --command` starts a
// harness when its command's first token is one. `agent hooks off` removes the status hooks.
function orcaDenied(words: string[], flags: Flag[]): Cause | null {
  const [a, b, c] = words;
  if (a === "agent" && b === "hooks" && c === "off") return "hook-switch";
  return null;
}

function hostOutputs(words: string[], flags: Flag[], operands: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  const flagged = flags.flatMap((entry): Word[] => {
    const [flag, value] = entry;
    return OUTPUT_FLAGS.includes(flag) && value !== undefined ? [value] : [];
  });
  const at = words.findIndex((word) => OUTPUT_COMMANDS.has(word));
  const positional = at < 0 ? [] : operands.slice(at + 1).filter((word) => !word.literal || outputPath(word.text));
  return writes([...flagged, ...positional], cwd, ctx.inScope, ctx);
}

function outputPath(text: string): boolean {
  if (text === "" || text.startsWith("-") || text.startsWith("@")) return false;
  return text.startsWith(".") || text.startsWith("~") || text.includes("/") || text.includes("\\") || OUTPUT_EXT.test(text);
}

// Registry reads, installs, and build/test/dev runners write dependency and build output,
// not gated source. A project script they launch is scanned like any other script.
const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "yarnpkg"]);
const REGISTRY_READS = new Set(["view", "info", "show", "ll", "ls", "list", "outdated", "audit", "why", "ping", "explain", "search", "help", "version", "root", "bin", "prefix", "repo", "docs", "bugs", "fund", "get", "config"]);
const PACKAGE_MUTATORS = new Set(["install", "i", "ci", "add", "update", "up", "upgrade", "link", "unlink", "rebuild", "remove", "rm", "uninstall", "un", "prune", "dedupe"]);
const NPM_SCRIPTS = new Set(["run", "run-script", "test", "t", "start", "dev", "build", "serve"]);

function developer(name: string, args: Word[], cwd: string | null, ctx: Ctx): Cause | null | undefined {
  if (name === "docker" || name === "docker-compose" || name === "podman" || name === "next" || name === "tsc" || name === "vitest") return null;
  if (!PACKAGE_MANAGERS.has(name)) return undefined;
  const sub = args.find((w) => w.literal && !w.text.startsWith("-"))?.text;
  if (sub === undefined) return null;
  if (REGISTRY_READS.has(sub) || PACKAGE_MUTATORS.has(sub)) return null;
  const yarn = name === "yarn" || name === "yarnpkg";
  // pnpm lint and pnpm gate are package scripts, the same as pnpm run lint. Yarn already
  // treated every other word that way. A name package.json does not define stays denied.
  if (!yarn && !NPM_SCRIPTS.has(sub)) {
    const defined = packageScript(cwd, ctx, sub);
    if (defined === null) return shellWrite(ctx, `the ${name} subcommand \`${shown(sub)}\` is not a registry read, an install, or a project script`);
    if (typeof defined !== "string") return defined.cause;
  }
  return projectScript(sub, args, cwd, ctx);
}

function projectScript(sub: string, args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  const script = scriptName(sub, args);
  if (script === null) return null;
  const body = packageScript(cwd, ctx, script);
  if (body === null) return null;
  if (typeof body !== "string") return body.cause;
  const at = args.findIndex((w) => w.text === "--");
  const extra = at < 0 ? "" : args.slice(at + 1).map((w) => w.text).join(" ");
  return nestedScript(extra === "" ? body : `${body} ${extra}`, cwd, ctx);
}

function scriptName(sub: string, args: Word[]): string | null {
  if (sub !== "run" && sub !== "run-script") return sub;
  let seen = false;
  for (const word of args) {
    if (!word.literal || word.text.startsWith("-")) continue;
    if (!seen) { seen = true; continue; }
    return word.text;
  }
  return null;
}

function packageScript(cwd: string | null, ctx: Ctx, name: string): string | { cause: Cause } | null {
  const path = resolve(cwd, "package.json");
  if (path === null) return null;
  const read = ctx.readScriptFile?.(path) ?? { kind: "missing" as const };
  if (read.kind === "missing") return null;
  if (read.kind !== "text") return null;
  let parsed: unknown;
  try { parsed = JSON.parse(read.text); }
  catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const scripts = (parsed as { scripts?: unknown }).scripts;
  if (scripts === null || typeof scripts !== "object" || Array.isArray(scripts)) return null;
  const body = (scripts as Record<string, unknown>)[name];
  return typeof body === "string" ? body : null;
}

// A package manager, container tool, or compiler is decided before a shim script is read.
function recognized(name: string, head: Word, args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  const developed = developer(name, args, cwd, ctx);
  if (developed !== undefined) return developed;
  return head.literal ? namedScript(head, name, cwd, ctx) : null;
}

function invoke(head: Word, args: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  const name = basename(slash(head.text)).toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
  if (!head.literal) return unnamed(head, args, cwd, ctx, stdin);
  if (EXPORTS.has(name)) return run(args.filter((w) => ASSIGNMENT.test(w.text)), cwd, ctx, stdin);
  // A sourced script runs like a command: `. pregate approve` runs the launcher in this shell.
  if (name === "source" || name === ".") return run(args, cwd, ctx, stdin);
  if (name === "pregate") {
    const cause = ctx.ciSet ? "hook-switch" : pregate(args, ctx.guideInspection, ctx.direct);
    if (cause === "shell-admin" && ctx.shellDetail && ctx.shellDetail.text === null) {
      const sub = args.find((w) => w.literal && !w.text.startsWith("-"));
      if (sub?.text === "enable" || sub?.text === "disable") ctx.shellDetail.text = `pregate ${sub.text} is the user's command: they run pregate ${sub.text} --yes in a terminal or on a Claude Code ! line`;
    }
    return cause;
  }
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
  if (name === "eval" || name === "invoke-expression" || name === "iex") {
    // A literal `eval 'echo ok'` is scanned. `eval "$l"` is the stdin loop a pty can type
    // `pregate approve` into without another hook. That command is not readable, so it stays denied.
    const body = joined(args);
    if (!body.literal) return shellWrite(ctx, "`eval` runs a command this process cannot read");
    return inline(body, cwd, ctx);
  }
  const interpreter = name.replace(/^python[\d.]*$/, "python");
  if (INTERPRETERS.has(interpreter)) return interpret(interpreter, args, cwd, ctx, stdin);
  if (name === "make" || name === "gmake" || name === "mingw32-make") return makefile(args, cwd, ctx) ?? writes(targets(name, args), cwd, ctx.inScope, ctx);
  const hosted = hostPolicy(name, head, args, cwd, ctx);
  if (hosted !== undefined) return hosted;
  const scripted = recognized(name, head, args, cwd, ctx);
  if (scripted !== null) return scripted;
  if (COPIES.has(name)) return copies(name === "copy" || name === "move" ? args.filter((w) => !/^\/-?[yabvndz]$/i.test(w.text)) : args, cwd, ctx);
  if (SESSIONS.has(name)) return "shell-write";
  if (EDITORS.has(name)) return stdin === null ? "shell-write" : first([...args, stdin], (w) => code(w, cwd, ctx));
  // A patch names its files inside: read like code when it comes in the command (a heredoc).
  if (name === "patch" || name === "apply_patch" || name === "applypatch") {
    if (args.some((w) => /^(--dry-run|--check|-C)$/.test(w.text))) return null;
    return (stdin === null ? null : code(stdin, cwd, ctx)) ?? "shell-write";
  }
  return writes(targets(name, args), cwd, ctx.inScope, ctx);
}

// A command name the shell builds (`${T}fia`, `$(echo pregate)`, `` `…` ``, `$'\x74…'`, a brace or
// glob) may be any command, PREGATE's own approval included: shell-admin. When only its directory
// expands (`"$DIR"/tool`, `~/bin/tool`) the name is known; such a command might still write any of
// its operands. A PowerShell value names no command, but an assignment runs its right-hand side.
function unnamed(head: Word, args: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  const value = psValue(head, args, ctx.bound);
  if (value !== null) return run(value, cwd, ctx, stdin);
  const name = head.text.slice(head.text.lastIndexOf("/") + 1);
  if (/[$`\\{}()*?[]/.test(name)) return null;
  const cause = invoke({ ...head, literal: true }, args, cwd, ctx, stdin);
  // Under the home folder the path is as known as a literal one: `~/bin/tool` is `/home/u/bin/tool`.
  // Only the home prefix may expand: `$HOME/$DIR/tool` is as unknown as `"$DIR"/tool`.
  return cause ?? (/^(~|\$HOME|\$\{HOME\})\/[^$`\\{}()*?[]*$/.test(head.text) ? null : writes(getopt(args, []).operands, cwd, ctx.inScope, ctx));
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

// The harness a command launches, by its executable name: `claude`, `claude.exe`, an absolute path,
// `claude-code` from `npx @anthropic-ai/claude-code`, or `cli.js` inside that package's folder.
// Cursor's CLI is also `agent`, only as the command itself.
function launchedHarness(command: string): string | null {
  const base = basename(slash(command).toLowerCase().replace(/\.(exe|cmd|bat)$/, ""));
  if (base === "agent" || harnessIdOf(base) !== null || UNGATED_HARNESSES.includes(base)) return base;
  return HARNESS.exec(command)?.[2] ?? null;
}

function harnessGated(name: string, gated: GuardContext["gated"]): boolean {
  if (gated === undefined) return false;
  if (gated.has(name)) return true;
  const id = harnessIdOf(name);
  if (id === null) return false;
  return gated.has(id) || HARNESS_NAMES[id].some((alias) => gated.has(alias));
}

// What the denial tells the agent: the harness, and the command a human runs to gate it.
export function ungatedHarnessMessage(name: string): string {
  const id = harnessIdOf(name);
  if (id === null) return `${name} has no PREGATE registration. Do not launch it. The human runs \`pregate setup\` for claude-code, codex, cursor, grok, agy or opencode.`;
  const project = id === "grok" || id === "opencode" ? "" : ` or \`pregate project hooks --harness ${id}\``;
  return `${name} (${id}) is not gated. Gate it: \`pregate setup\`${project}.`;
}

// Options and subcommands that manage hooks, plugins or config, or that skip permissions.
// A prompt (`-p`, `--prompt`, or the words after `exec`/`run`) is not one of those, even when it
// mentions pregate or hooks.
function harnessSwitchesHooks(args: Word[]): boolean {
  let prompt = false;
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const text = args[i]!.text;
    if (text === "--") break;
    if (text.startsWith("-") && text !== "-") {
      const eq = text.indexOf("=");
      const name = eq > 0 ? text.slice(0, eq) : text;
      const inline = eq > 0 ? text.slice(eq + 1) : undefined;
      if (SKIP_PERMISSION.test(name) || HOOK_FLAG.test(name) || HOOK_WORD.test(name) || HARNESS_CONFIG_FILE.has(name)) return true;
      if (name === "-c") {
        const value = inline ?? args[i + 1]?.text ?? "";
        if (HOOK_WORD.test(value) || /\b(hooks|disableAllHooks|pregate)\b/i.test(value)) return true;
        if (inline === undefined) i++;
        continue;
      }
      if (HARNESS_PROMPT.has(name)) prompt = true;
      if (HARNESS_VALUE.has(name) && inline === undefined) i++;
      continue;
    }
    if (prompt) continue;
    positionals.push(text);
    if (LAUNCH_MODE.test(text)) prompt = true;
  }
  if (positionals.some((word) => HOOK_STEM.test(word))) return true;
  const head = positionals[0]?.toLowerCase() ?? "";
  if (/^(plugins?|hooks?)$/.test(head)) return true;
  if (head === "features" && positionals.some((word) => /^hooks?$/i.test(word) || HOOK_STEM.test(word))) return true;
  if (head === "config" && positionals.some((word) => HOOK_WORD.test(word) || /\b(hooks|disableAllHooks|pregate)\b/i.test(word))) return true;
  return false;
}

// What switches hooks off or reaches past this harness. hook-switch: an option or variable that
// runs a harness without the user's configuration, or a harness command that manages its hooks or
// the pregate plugin, or a harness run with another HOME. A prompt is not a hook switch.
// shell-admin: a git hook switch, such as --no-verify or `HUSKY=0 git …` (PowerShell's
// `$env:HUSKY=0` sets it for the commands that follow), setting `core.hooksPath`, or an ungated
// harness as the command. Reading that key with `git config` is not one.
function administers({ words, assigned, head, args }: { words: Word[]; assigned: string[]; head: Word | undefined; args: Word[] }, ctx: Ctx, cwd: string | null): Cause | null {
  const psEnv = /^\$env:(\w+)/i.exec(head?.text ?? "")?.[1]!.toUpperCase() ?? "";
  const cmdEnv = head?.text.toLowerCase() === "set" ? /^(\w+)=/.exec(args[0]?.text ?? "")?.[1]?.toUpperCase() ?? "" : "";
  const names = [...assigned, psEnv, cmdEnv];
  const named = names.map(variableCause);
  const command = slash(head?.text ?? "").toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
  const launched = head === undefined ? null : launchedHarness(command);
  const harness = launched !== null;
  // A harness prompt is free-form. Every other command still matches a hook flag wherever it sits
  // (`jq '.disableAllHooks = true'`, `some-tool --settings`). An approval variable is not a hook
  // switch: `run` reports `approval` unless the command itself switches hooks off.
  if (!harness && words.some((w) => HOOK_WORD.test(w.text) || HOOK_FLAG.test(w.text))) return "hook-switch";
  if (named.includes("hook-switch") || (harness && harnessSwitchesHooks(args))) return "hook-switch";
  if (named.includes("approval")) return "approval";
  // `--no-verify`, `core.hooksPath` and a hook-manager variable deny only when the hook they
  // skip is PREGATE's. Another project's husky or lefthook is not this guard's job.
  const query = words.some((w) => /core\.hookspath/i.test(w.text)) && commandAllowsHooks(words, 0);
  const bypass = words.some((w) => query ? /--no-veri/i.test(w.text) : ADMIN_WORD.test(w.text)) || names.some((n) => GIT_SWITCH.test(n));
  if (!bypass || !pregateOwnsGitHook(cwd, ctx)) return null;
  if (ctx.shellDetail && ctx.shellDetail.text === null) ctx.shellDetail.text = "this skips a pregate-installed git hook. core.hooksPath points at .pregate/git-hooks, or the pre-commit script runs pregate.";
  return "shell-admin";
}

function pregateOwnsGitHook(cwd: string | null, ctx: Ctx): boolean {
  return cwd !== null && ctx.pregateGitHook?.(cwd) === true;
}

// Global git options that do not assign config. `-c` and `--config-env` are checked apart: a
// `core.hooksPath` value there skips hooks for the command that follows.
const GIT_PLAIN = new Set(["-p", "-P", "-v", "-h", "--paginate", "--no-pager", "--version", "--help", "--bare",
  "--no-replace-objects", "--literal-pathspecs", "--glob-pathspecs", "--noglob-pathspecs", "--icase-pathspecs",
  "--no-optional-locks", "--html-path", "--man-path", "--info-path", "--exec-path"]);
const GIT_PATH = new Set(["-C", "--git-dir", "--work-tree", "--namespace"]);
// `git config` actions. A write, an unknown option, or `--no-get` (it sets) is not a query.
// Git accepts a unique prefix (`--replace-al` is `--replace-all`); an option not spelled here is not one.
const CONFIG_WRITE = new Set(["--add", "--replace-all", "--unset", "--unset-all", "--rename-section", "--remove-section", "--edit", "-e"]);
const CONFIG_GET = new Set(["--get", "--get-all", "--get-regexp", "--get-color", "--get-colorbool"]);
const CONFIG_MOD = new Set(["--global", "--system", "--local", "--worktree", "--file", "-f", "--blob", "--bool", "--int",
  "--bool-or-int", "--bool-or-str", "--path", "--expiry-date", "--null", "-z", "--name-only", "--includes", "--no-includes",
  "--show-origin", "--show-scope", "--fixed-value", "--type", "-t", "--default"]);
const CONFIG_VALUED = ["--file", "-f", "--blob", "--type", "-t", "--default"];

// True only when every word is a literal `git config` query: `--get`, `--get-all`, `--get-regexp`,
// `--list`/`-l`, `--show-origin`, or the one-argument get. A value after the name without one of
// those actions is a set (`git config core.hooksPath /dev/null`, and `git config core.hooksPath --get`
// sets the value to `--get`). Options after the key are that command's operands.
function readOnlyGitConfig(words: Word[]): boolean {
  const at = words.findIndex((w) => !ASSIGNMENT.test(w.text));
  const head = at < 0 ? undefined : words[at];
  if (head === undefined || !head.literal || head.subs.length !== 0) return false;
  if (basename(slash(head.text)).toLowerCase().replace(/\.(exe|cmd|bat)$/, "") !== "git") return false;
  const args = words.slice(at + 1);
  if (args.some((w) => !w.literal || w.subs.length !== 0)) return false;
  const { flags, operands } = getopt(args, ["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"], true);
  if (operands[0]?.text !== "config") return false;
  for (const [flag, value] of flags) {
    if (flag === "-c" || flag === "--config-env") {
      if (value === undefined || /core\.hookspath/i.test(value.text)) return false;
      continue;
    }
    if (GIT_PATH.has(flag)) {
      if (value === undefined) return false;
      continue;
    }
    if (!GIT_PLAIN.has(flag)) return false;
  }
  return configQuery(operands.slice(1));
}

function configQuery(args: Word[]): boolean {
  const { flags, operands } = getopt(args, CONFIG_VALUED, true);
  let action: "get" | "url" | "list" | null = null;
  for (const [flag, value] of flags) {
    if (CONFIG_WRITE.has(flag) || (flag.startsWith("--no-") && flag !== "--no-includes")) return false;
    if (flag === "--list" || flag === "-l") {
      if ((action !== null && action !== "list") || value !== undefined) return false;
      action = "list";
      continue;
    }
    if (flag === "--get-urlmatch") {
      if (action !== null || value !== undefined) return false;
      action = "url";
      continue;
    }
    if (CONFIG_GET.has(flag)) {
      if (action !== null || value !== undefined) return false;
      action = "get";
      continue;
    }
    if (!CONFIG_MOD.has(flag)) return false;
    if (CONFIG_VALUED.includes(flag) ? value === undefined || !value.literal : value !== undefined) return false;
  }
  const n = operands.length;
  if (action === "list") return n === 0;
  if (action === "url") return n === 2;
  if (action === "get") return n === 1 || n === 2;
  return n === 1;
}

// The literal script `sh -c`, `eval`, `pwsh -Command` and `cmd /c` run. null: this command is not one
// of those, or the script is not a literal this process can read.
function scriptBody(words: Word[]): Word | null {
  const at = words.findIndex((w) => !ASSIGNMENT.test(w.text));
  const head = at < 0 ? undefined : words[at];
  if (head === undefined || !head.literal || head.subs.length !== 0) return null;
  const name = basename(slash(head.text)).toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
  const args = words.slice(at + 1);
  if (SHELLS.has(name)) {
    const options = args.map((w) => (w.text.startsWith("+") ? { ...w, text: `-${w.text.slice(1)}` } : w));
    const { flags, operands } = getopt(options, ["-o", "-O", "--rcfile", "--init-file"], true);
    const command = flags.find(([flag]) => flag === "-c" || flag === "--command");
    return command === undefined ? null : command[1] ?? operands[0] ?? null;
  }
  if (name === "eval" || name === "invoke-expression" || name === "iex") {
    if (args.length === 0 || args.some((w) => !w.literal || w.subs.length !== 0)) return null;
    return { text: args.map((w) => w.text).join(" "), literal: true, subs: [] };
  }
  if (name === "pwsh" || name === "powershell") {
    for (let i = 0; i < args.length; i++) {
      const param = /^-([a-z]+)$/i.exec(args[i]!.text)?.[1]!.toLowerCase();
      if (param === undefined || !"command".startsWith(param)) continue;
      const rest = args.slice(i + 1);
      if (rest.length === 0 || rest.some((w) => !w.literal || w.subs.length !== 0) || rest[0]!.text === "-") return null;
      return { text: rest.map((w) => w.text).join(" "), literal: true, subs: [] };
    }
    return null;
  }
  if (name !== "cmd") return null;
  const flag = args.findIndex((w) => /^\/[ck]$/i.test(w.text));
  const rest = flag < 0 ? [] : args.slice(flag + 1);
  if (rest.length === 0 || rest.some((w) => !w.literal || w.subs.length !== 0)) return null;
  return { text: rest.map((w) => w.text).join(" "), literal: true, subs: [] };
}

// True when this command is a read-only git config query, or a script whose every command that
// names core.hooksPath is one. A write redirect stays out: the outer word would otherwise hide it.
function commandAllowsHooks(words: Word[], depth: number): boolean {
  if (readOnlyGitConfig(words)) return true;
  if (depth > 4) return false;
  const body = scriptBody(words);
  if (body === null || !body.literal || body.subs.length !== 0 || /--no-veri/i.test(body.text)) return false;
  const commands = lex(body.text);
  if (commands.length === 0) return false;
  return commands.every((command) => {
    const parts = [...command.words, ...command.redirs.map((r) => r.target)];
    if (parts.some((w) => w.subs.length !== 0)) return false;
    if (!parts.some((w) => /core\.hookspath/i.test(w.text))) return true;
    if (command.redirs.some((r) => WRITE_REDIRS.has(r.op))) return false;
    return commandAllowsHooks(command.words, depth + 1);
  });
}

// The read-only subcommands run; setup, update and uninstall, or one that cannot be named, change
// what every harness runs (MH-17).
function pregate(args: Word[], guideAllowed: boolean, direct: boolean): Cause | null {
  // enable and disable stay on a separate terminal, including inside `sh -c`. Every other
  // pregate command is an ordinary shell command. A non-literal name, or a wrapper around
  // prepare/setup/update/uninstall, can still switch the installed hooks off.
  const subWord = args.find((w) => !w.text.startsWith("-"));
  if (subWord?.literal && (subWord.text === "enable" || subWord.text === "disable")) return "shell-admin";
  if (direct && args.every((w) => w.literal && w.subs.length === 0)) return null;
  if (args.every((w) => w.literal) && args[0]?.text === "pack" && args[1]?.text === "init") return null;
  if (args.every((w) => w.literal) && args[0]?.text === "rules" && args[1]?.text === "draft") return null;
  if (args.every((w) => w.literal) && args[0]?.text === "rules" && args[1]?.text === "add" && !args.some((w) => w.text === "--yes")) return null;
  if (proposal(args)) return null;
  if (args[0]?.text === "guide" && guideAllowed) return null;
  if (readOnlyPregate(args, false)) return null;
  if (direct && inHarnessApproval(args)) return null;
  return subWord !== undefined && (!subWord.literal || MACHINE.test(subWord.text)) ? "hook-switch" : null;
}

// The human's in-harness confirmation: one literal `approve` with a code operand, or with `--yes`
// and an optional 12–64 hex `--digest`. `--no-commit` may sit on either side. Anything else,
// including `--digest` without `--yes` and a code combined with `--digest`, still needs a terminal.
function inHarnessApproval(args: Word[]): boolean {
  if (!args.every((w) => w.literal && w.subs.length === 0) || args[0]?.text !== "approve") return false;
  let yes = false, digest = false, code = false, commit = false;
  for (let i = 1; i < args.length; i++) {
    const word = args[i]!.text;
    if (word === "--yes") { if (yes) return false; yes = true; continue; }
    if (word === "--no-commit") { if (commit) return false; commit = true; continue; }
    if (word === "--digest") {
      const value = args[++i]?.text;
      if (value === undefined || digest || !/^[0-9a-f]{12,64}$/.test(value)) return false;
      digest = true;
      continue;
    }
    if (word.startsWith("-") || code || !/^[0-9a-f]{12,64}$/.test(word)) return false;
    code = true;
  }
  if (code && digest) return false;
  return code || yes;
}

// Every direct `pregate approve` this command runs, in the form the shell guard allows.
// Quote-concatenation (`pre''gate`) and a leading `!` are that command. A wrapper, a
// substitution, a script and a brace group are not: the guard denies those, and this
// list is only used to turn an already-allowed command into a prompt.
export function directApprovalArgv(command: string): string[][] {
  if (!command.includes("approve")) return [];
  const sources = [command, ...(command.includes("\\") ? [command.replace(/\\(?=[\w.-])/g, "/")] : [])];
  const found: string[][] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const call of lex(source)) {
      if (call.grouped || call.words.length === 0) continue;
      const head = call.words[0]!;
      if (!head.literal || head.subs.length !== 0) continue;
      const name = basename(slash(head.text)).toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
      if (name !== "pregate") continue;
      const args = call.words.slice(1);
      if (!inHarnessApproval(args)) continue;
      const argv = args.map((word) => word.text);
      const key = argv.join("\0");
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(argv);
    }
  }
  return found;
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
  const child: Ctx = { ...ctx, direct: false };
  const cause = runWrapped(name, args, cwd, child, stdin);
  if (child.held !== null) ctx.held ??= child.held;
  return cause;
}

function runWrapped(name: string, args: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  const { flags, operands } = getopt(args, WRAPPERS.get(name) ?? [], true);
  const inner = name === "xargs" ? xargs(flags, args.slice(0, args.length - operands.length), operands) : operands;
  const option = (re: RegExp) => flags.find(([flag]) => re.test(flag));
  const call = option(/^(-c|--call)$/);   // npx -c runs a shell command line
  if (name === "npx" && call !== undefined) return inline(call[1], cwd, ctx);
  if (name === "timeout") inner.shift();   // the duration
  if (name !== "env") return run(inner, cwd, ctx, stdin);
  const denial = envDenial(flags);
  if (denial === "hook-switch") return "hook-switch";
  const dir = option(/^(-C|--chdir)$/) === undefined ? cwd : null;   // the command runs elsewhere
  // -S splits one string into the command line.
  const split = option(/^(-S|--split-string)$/);
  const cause = split === undefined ? run(inner, dir, ctx, stdin) : inline(joined(split[1] === undefined ? inner : [split[1], ...inner]), dir, ctx);
  return denial === "approval" && cause !== "hook-switch" && cause !== "protected-path" ? "approval" : cause;
}

// `env -i` clears the harness configuration. `env -u` of a hook variable does too. Unsetting an
// approval-forging name is `approval` unless the command that follows is itself a hook switch.
function envDenial(flags: Flag[]): "approval" | "hook-switch" | null {
  let approval = false;
  for (const [flag, value] of flags) {
    if (flag === "-i" || flag === "--ignore-environment") return "hook-switch";
    if ((flag === "-u" || flag === "--unset") && value !== undefined) {
      const cause = variableCause(value.text);
      if (cause === "hook-switch") return "hook-switch";
      if (cause === "approval") approval = true;
    }
  }
  return approval ? "approval" : null;
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
  return writes([dest], cwd, ctx.inScope, ctx) ?? writes(inside, cwd, ctx.under, ctx);
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
  if (flags.some(([flag]) => /^(-[ef]|--expression|--file)$/.test(flag))) return operands;
  // `sed -i src/a.ts` has no expression. The one operand is the file when it looks like a path.
  if (operands.length === 1 && /[\\/]|\.[A-Za-z0-9]+$/.test(operands[0]!.text)) return operands;
  return operands.slice(1);
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
  return writes([dest], cwd, ctx.inScope, ctx) ?? (dest.literal && dest.text.endsWith("/") ? writes([{ ...dest, text: posix.join(dest.text, ".") }], cwd, ctx.under, ctx) : null);
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
    return writes([dest], cwd, ctx.inScope, ctx) ?? (dest.literal && dest.text.endsWith("/") ? writes([{ ...dest, text: posix.join(dest.text, ".") }], cwd, ctx.under, ctx) : null);
  }
  if (create && !extract) {
    for (let i = 0; i < args.length; i++) {
      const w = args[i]!;
      if (w.text === "-f" || w.text === "--file") {
        const archive = args[i + 1];
        return archive === undefined ? null : writes([archive], cwd, ctx.inScope, ctx);
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
  return targets.length === 0 ? null : writes(targets, cwd, ctx.inScope, ctx);
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
  return writes(paths, cwd, ctx.inScope, ctx)
    ?? writes(paths.filter((w) => w.literal && !w.text.endsWith("/")).map((w) => ({ ...w, text: posix.join(w.text, ".") })), cwd, ctx.under, ctx);
}

function git(args: Word[], cwd: string | null, ctx: Ctx): Cause | null {
  const { flags, operands } = getopt(args, ["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"], true);
  const base = flags.reduce((dir, [flag, v]) => (flag !== "-C" ? dir : v?.literal ? resolve(dir, v.text) : null), cwd);
  const [sub, rest] = [operands[0]?.text, operands.slice(1)];
  // Creating a repository writes `.git`, not gated source.
  if (sub === "init") return null;
  // `commit -n` is --no-verify. It denies only when this checkout's git hook is PREGATE's.
  // An option that takes a value ends the cluster (`-mn` is the message "n").
  if (sub === "commit" && getopt(rest, ["-m", "-F", "-c", "-C", "-t"]).flags.some(([flag]) => flag === "-n")) {
    if (!pregateOwnsGitHook(base ?? cwd, ctx)) return null;
    if (ctx.shellDetail && ctx.shellDetail.text === null) ctx.shellDetail.text = "git commit -n skips a pregate-installed git hook.";
    return "shell-admin";
  }
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
    return writes(change.worktree.map((text) => ({ text, literal: true, subs: [] })), base, ctx.inScope, ctx);
  }
  // Without `--` the first operand is a revision, unless it is `.`, which cannot name one.
  const changed = sub === "apply" ? (has(/^--(check|stat|numstat|summary)$/) ? [] : [UNKNOWN])
    : sub === "checkout" ? (dash >= 0 ? rest.slice(dash + 1) : getopt(rest, ["-b", "-B", "--orphan"]).operands.filter((w, k) => k > 0 || w.text === "."))
    : sub === "restore" ? (has(/^(--staged|-S)$/) && !has(/^(--worktree|-W)$/) ? [] : getopt(rest, ["-s", "--source"]).operands)
    : [];
  // Git expands pathspecs itself: a glob or a `:(magic)` pathspec may name any file.
  return writes(changed.map((w) => (/^:|[*?[]/.test(w.text) ? UNKNOWN : w)), base, ctx.under, ctx);
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
  // `bash "$SCRIPT"` does not name a file this process can read. Running it is not a proven write.
  if (!fromStdin && script !== undefined && script.text !== "-" && !script.literal) return null;
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
  if (named !== undefined && !named.literal) return null;
  const paths = named !== undefined ? [resolve(cwd, named.text)] : ["Makefile", "makefile", "GNUmakefile"].map((name) => resolve(cwd, name));
  const control = first(paths, (path) => controlFile(ctx, path));
  if (control !== null) return control;
  for (const path of paths) {
    if (path === null) continue;
    const read = ctx.readScriptFile?.(path) ?? { kind: "missing" as const };
    if (read.kind === "missing") continue;
    if (read.kind !== "text") return shellWrite(ctx, "the makefile could not be read, so its recipes cannot be checked");
    return recipes(read.text, cwd, ctx);
  }
  return null;
}

// A recipe line is the command `make` runs. A control command was already denied above.
function recipes(text: string, cwd: string | null, ctx: Ctx): Cause | null {
  for (const raw of text.split("\n")) {
    if (!/^[\t ]/.test(raw)) continue;
    const line = raw.replace(/^\s+/, "").replace(/\s+$/, "");
    if (line === "" || line.startsWith("#")) continue;
    const cause = nestedScript(line, cwd, ctx);
    if (cause !== null) return cause;
  }
  return null;
}

// A shell that reads its script from the terminal is a session (MH-29).
function interactive(args: Word[], stdin: Word | null): Cause | null {
  return stdin === null && !args.some((w) => INFORMATIVE.test(w.text)) ? "shell-write" : null;
}

function powershell(args: Word[], cwd: string | null, ctx: Ctx, stdin: Word | null): Cause | null {
  for (let i = 0; i < args.length; i++) {
    const param = /^-([a-z]+)$/i.exec(args[i]!.text)?.[1]!.toLowerCase();
    if (param === undefined) continue;
    if ("encodedcommand".startsWith(param) || param === "ec") return null;
    if (param === "file" || param === "f") {
      const target = args[i + 1];
      if (target !== undefined && !target.literal) return null;
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
// `python3 -m scripts.write` is `scripts/write.py`, `scripts/write.pyw`, or `scripts/write/__init__.py`
// when one of those exists. A name that resolves to none of them (`unittest`, `pytest`, `pip`) is
// not a script path. A file whose name is only the bare module is not that module.
function pythonModuleCause(name: string, cwd: string | null, ctx: Ctx, options: string[]): Cause | null {
  const rel = name.split(".").join("/");
  for (const suffix of [".py", ".pyw", "/__init__.py"]) {
    const abs = resolve(cwd, `${rel}${suffix}`);
    if (abs === null) return "shell-write";
    const peek = ctx.readScriptFile?.(abs) ?? { kind: "missing" as const };
    if (peek.kind === "missing") continue;
    return scriptFile(ctx, abs, "python", cwd, options);
  }
  return null;
}

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
  // `python -m name` names a module, not a script file. Words after it belong to the module.
  // A script path before `-m` keeps the old reading: `-m` is then the script's own argument.
  let moduleWord: Word | undefined;
  let scriptStarted = false;
  for (let i = 0; i < args.length; i++) {
    const w = args[i]!;
    const eq = w.text.indexOf("=");
    if (name === "python" && moduleWord === undefined && !scriptStarted && /^-m(.+)$/.test(w.text)) {
      moduleWord = { ...w, text: w.text.slice(2) };
      continue;
    }
    if (name === "python" && moduleWord === undefined && !scriptStarted && /^-[A-Za-z]*m$/.test(w.text)) {
      if (args[i + 1] !== undefined) moduleWord = args[++i]!;
      continue;
    }
    if (moduleWord !== undefined) continue;
    if (codeFlag.test(w.text)) {
      if (args[i + 1] !== undefined) program.push(args[++i]!);
    } else if (w.text.startsWith("--") && eq > 0 && codeFlag.test(w.text.slice(0, eq))) {
      program.push({ ...w, text: w.text.slice(eq + 1) });
    } else if (!/^-./.test(w.text)) {
      operands.push(w);   // a script file, an option's value or the program's own arguments
      scriptStarted = true;
    }
  }
  // A word that is not a module name (`python3 -m node_modules/...`) stays a script path.
  if (moduleWord !== undefined && program.length === 0 && !/^[A-Za-z_][\w.]*$/.test(moduleWord.text)) operands.unshift(moduleWord);
  // A harness run by its interpreter: the entry script lives in the package's folder. A project
  // folder that shares a harness name is not one.
  const entry = operands[0]?.text.toLowerCase() ?? "";
  if (entry.includes("node_modules/") && HARNESS.test(entry)) return null;
  const inlined = program.length > 0;
  if (!inlined && stdin !== null && (entry === "" || entry === "-")) program.push(stdin);
  const options = args.filter((w) => /^-./.test(w.text)).map((w) => w.text);
  if (name === "python" && moduleWord !== undefined && program.length === 0 && /^[A-Za-z_][\w.]*$/.test(moduleWord.text)) {
    // `python3 -m "$MOD"` names a module this process cannot read. That is not a proven write.
    if (!moduleWord.literal) return null;
    return pythonModuleCause(moduleWord.text, cwd, ctx, options);
  }
  const interp = name.replace(/^python[\d.]*$/, "python");
  // `bun run lint` is the package script, scanned like `pnpm run lint`. A following file
  // (`bun run x.ts`, or a script name that is also a file) is scanned when the script body is not.
  if (interp === "bun" && operands[0]?.text === "run") {
    const script = projectScript("run", args, cwd, ctx);
    if (script !== null) return script;
    const file = operands[1];
    if (file?.literal && /\.(?:[cm]?[jt]sx?)$/i.test(file.text)) {
      const abs = resolve(cwd, file.text);
      if (abs !== null) {
        const scanned = scriptFile(ctx, abs, interp, cwd, options);
        if (scanned !== null) return scanned;
      }
    }
    return null;
  }
  // Inline code and a literal script file. A non-literal path (`node "$P"`, `ruby` with no
  // script) is opaque: it is not denied for being unreadable.
  const control = first(program, (w) => w.literal ? (w.file === undefined ? pregateControlCause(w.text) : controlFile(ctx, w.file)) : null)
    ?? (!inlined && operands[0] !== undefined && !["-", "repl"].includes(operands[0].text) && !(interp === "bun" && BUN_SUBCOMMANDS.has(operands[0].text)) && operands[0].literal
      ? ((abs) => abs === null ? shellWrite(ctx, `the script \`${shown(operands[0]!.text)}\` is not a literal path`) : scriptFile(ctx, abs, interp, cwd, options))(resolve(cwd, operands[0].text))
      : null);
  if (control !== null) return control;
  const text = program.filter((w) => w.literal && w.file === undefined).map((w) => w.text).join("\n");
  const wrote = text === "" ? null : programWrites(text, cwd, ctx);
  if (wrote !== null) return wrote;
  const fromArgv = argvWrites(name, program.map((w) => w.text).join("\n"), operands, cwd, ctx);
  if (fromArgv !== null) return fromArgv;
  // perl and ruby edit files in place with -i, checked on every option: in `perl -pie`, -i takes
  // "e" as its backup suffix.
  const inPlace = (name === "perl" || name === "ruby") && args.some((w) => /^-[A-Za-z0-9]*i/.test(w.text));
  return inPlace ? writes(inlined ? operands : operands.slice(1), cwd, ctx.inScope, ctx) : null;
}
