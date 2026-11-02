import { basename } from "node:path";
import type { Cause } from "./types.ts";

// Scan of one literal script, Makefile or interpreter program, whole. This is a text heuristic:
// it does not execute the program or expand variables (control-file.ts decodes file encodings).
// A pregate invocation whose subcommand it cannot read (`pregate "$verb"`) counts as one.
const SWITCH = new Set(["uninstall", "setup", "install"]);
const ADMIN = new Set(["approve", "disable", "enable"]);
const PACK = new Set(["enable", "disable", "remove", "add", "apply", "update"]);
// Subcommands that write a contract, consent, a reviewed draft or session state.
const APPLY: Record<string, RegExp> = {
  preset: /^(?:compile|apply)$/, feedback: /^apply$/, storage: /^(?:apply|prune|recover)$/, issue: /^submit$/, session: /^rebase$/,
};

// `pregate` as a command word, then a separator on the same line, then a verb. A quoted-list
// separator (`'pregate',` then the next quoted word) may continue on the next line: that is one
// argument list, not prose. Plain whitespace does not cross a line: `# notes on pregate` followed
// by a line that starts with `install:` is two lines, not an invocation.
const HEAD = /\bpregate(?:\.(?:exe|cmd|bat))?\b/gi;
const SEPARATOR = /['"`][ \t]*,\s*['"`\s]*|[ \t'"`]+|\)[ \t]*/y;
const VERB = /[A-Za-z][\w-]*/y;
// A subcommand the shell or the program computes: a variable, a substitution, a splat or a format field.
const COMPUTED = /[ \t'"]*(?:\$[\w{(@*#!?-]|%\w+%)|[ \t]+['"]*(?:`|@\w|\{\w)/y;
// A line that is only a comment: shell, Python, Makefile (`#`) or JavaScript (`//`).
const COMMENT_LINE = /^[ \t]*(?:#|\/\/).*$/gm;
// A backslash (POSIX shell, make), backtick (PowerShell) or caret (cmd) before a line break joins lines.
const CONTINUATION = /(?:\\|`|\^)[ \t]*\r?\n/g;
// `CI=1 pregate …`, `export CI=1`, `CI=1` on its own line, `CI = 1` as a Makefile variable.
const CI_ASSIGNMENT = /(?:^|[ \t;&|(])(?:export[ \t]+)?CI=|^[ \t]*CI[ \t]*[:?]?=/m;
// Variables that reveal approval codes, approve without a terminal or accept a loosened contract.
const APPROVAL_VARIABLE = /\bPREGATE_(?:TEST(?:ING|_ANSWER)|UNATTENDED_APPROVAL|ACCEPT_CONTRACT)\b/;
// PREGATE's consent and session records, which a script must not rewrite or delete.
const STATE_PATH = /\bpregate[\\/]+(?:consent|sessions|contract-approvals|pending|proposals)\b/i;

// A pregate invocation an agent must not run: approve/disable/enable, install/setup/update/uninstall,
// a pack mutation, a contract compile or apply, init/promote --yes, a review application, or a
// hook-trust edit. Read-only previews (`approve --preview`, `update --preview`, `pack … --preview`
// without `--yes`) stay visible. Comments are removed before and after joining continued lines,
// and the stronger finding wins: a continued line may or may not be part of a comment.
export function pregateControlCause(input: string): Cause | null {
  const a = scan(input.replace(COMMENT_LINE, "").replace(CONTINUATION, ""));
  if (a === "hook-switch") return a;
  return scan(input.replace(CONTINUATION, "").replace(COMMENT_LINE, "")) ?? a;
}

function scan(text: string): Cause | null {
  // Inline code must not set CI and call pregate.
  if (/\bpregate\b/i.test(text) && (CI_ASSIGNMENT.test(text) || /(?:environ|env|putenv|setenv)[^;\n]{0,80}['"]CI['"]/.test(text))) return "hook-switch";
  if (/trusted_hash\s*["']?\s*[:=]|dangerously-bypass-hook-trust|hooks\.state\s*=/i.test(text)) return "hook-switch";
  // The shell guard already rejects PREGATE_* assignments; inline programs and scripts must not set them either.
  if (APPROVAL_VARIABLE.test(text) || STATE_PATH.test(text)) return "hook-switch";
  let cause: Cause | null = null;
  for (const match of text.matchAll(HEAD)) {
    const next = invocation(text, (match.index ?? 0) + match[0].length);
    if (next === "hook-switch") return next;
    cause ??= next;
  }
  return cause;
}

function invocation(text: string, at: number): Cause | null {
  COMPUTED.lastIndex = at;
  if (COMPUTED.test(text)) return "shell-admin";
  SEPARATOR.lastIndex = at;
  const sep = SEPARATOR.exec(text);
  if (sep === null) return null;
  // `['pregate', verb]`: the list goes on with a name, not a quoted word.
  if (/^['"`][ \t]*,/.test(sep[0]) && !/['"`]\s*$/.test(sep[0]) && /^[A-Za-z_]/.test(text.slice(SEPARATOR.lastIndex))) return "shell-admin";
  VERB.lastIndex = SEPARATOR.lastIndex;
  const verb = VERB.exec(text);
  if (verb === null) return null;
  return classify(verb[0].toLowerCase(), text.slice(VERB.lastIndex, VERB.lastIndex + 180));
}

function classify(verb: string, rest: string): Cause | null {
  const preview = /--preview\b/.test(rest) && !/--yes\b/.test(rest) && !/--digest\b/.test(rest);
  if (SWITCH.has(verb)) return "hook-switch";
  if (verb === "update") return preview ? null : "hook-switch";
  if (ADMIN.has(verb)) {
    if (verb === "approve" && preview && !/\b[0-9a-f]{12,64}\b/.test(rest)) return null;
    return "shell-admin";
  }
  if (verb === "init" || verb === "promote") return preview ? null : "shell-admin";
  const sub = /^(?:['"`][ \t]*,\s*['"`\s]*|[ \t]+)([A-Za-z]+)/.exec(rest)?.[1]?.toLowerCase() ?? "";
  if (Object.hasOwn(APPLY, verb)) return APPLY[verb]!.test(sub) && !(preview && sub !== "compile") ? "shell-admin" : null;
  if (verb !== "pack") return null;
  return PACK.has(sub) && !preview ? "shell-admin" : null;
}

// Shell scripts, PowerShell scripts, Makefiles and shebang programs. Other source files are judged when executed.
export function scriptControlCause(path: string, content: string): Cause | null {
  const base = basename(path);
  const script = /\.(?:sh|bash|zsh|ksh|ps1|psm1|cmd|bat)$/i.test(base) || /^(?:GNUmakefile|makefile|Makefile)$/.test(base) || content.startsWith("#!");
  return script ? pregateControlCause(content) : null;
}
