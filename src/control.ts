import { basename } from "node:path";
import type { Cause } from "./types.ts";

// Bounded scan of one literal script, Makefile or interpreter program. This is a text heuristic:
// it does not execute the program, expand variables, or decode encodings. Only the first MAX_SCAN
// characters of a longer text are judged; the rest is not proof either way.
const MAX_SCAN = 1_048_576;
const SWITCH = new Set(["uninstall", "setup", "install"]);
const ADMIN = new Set(["approve", "disable", "enable"]);
const PACK = new Set(["enable", "disable", "remove", "add", "apply", "update"]);

// `pregate` as a command word, then a separator on the same line, then a verb. A quoted-list
// separator (`'pregate',` then the next quoted word) may continue on the next line: that is one
// argument list, not prose. Plain whitespace does not cross a line: `# notes on pregate` followed
// by a line that starts with `install:` is two lines, not an invocation.
const HEAD = /\bpregate(?:\.(?:exe|cmd|bat))?\b/gi;
const SEPARATOR = /^(?:['"`][ \t]*,\s*['"`\s]*|[ \t'"`]+|\)[ \t]*)/;
// A line that is only a comment: shell, Python, Makefile (`#`) or JavaScript (`//`).
const COMMENT_LINE = /^[ \t]*(?:#|\/\/).*$/gm;
// `CI=1 pregate …`, `export CI=1`, `CI=1` on its own line, `CI = 1` as a Makefile variable.
const CI_ASSIGNMENT = /(?:^|[ \t;&|(])(?:export[ \t]+)?CI=|^[ \t]*CI[ \t]*[:?]?=/m;

// A pregate invocation an agent must not run: approve/disable/enable, install/setup/update/uninstall,
// a pack mutation, or a hook-trust edit. Read-only previews (`approve --preview`, `update --preview`,
// `pack … --preview` without `--yes`) stay visible.
export function pregateControlCause(input: string): Cause | null {
  const text = (input.length > MAX_SCAN ? input.slice(0, MAX_SCAN) : input).replace(COMMENT_LINE, "");
  // CI in the environment shows approval codes. Inline code must not set it and call pregate.
  if (/\bpregate\b/i.test(text) && (CI_ASSIGNMENT.test(text) || /(?:environ|env|putenv|setenv)[^;\n]{0,80}['"]CI['"]/.test(text))) return "hook-switch";
  if (/trusted_hash\s*["']?\s*[:=]|dangerously-bypass-hook-trust|hooks\.state\s*=/i.test(text)) return "hook-switch";
  // The test hook reveals approval codes. The shell guard already rejects PREGATE_* assignments;
  // inline programs and scripts must not set it either.
  if (/\bPREGATE_TEST(?:ING|_ANSWER)\b/.test(text)) return "hook-switch";
  let cause: Cause | null = null;
  for (const match of text.matchAll(HEAD)) {
    let at = (match.index ?? 0) + match[0].length;
    const sep = SEPARATOR.exec(text.slice(at));
    if (sep === null) continue;
    at += sep[0].length;
    const verb = /^[A-Za-z][\w-]*/.exec(text.slice(at));
    if (verb === null) continue;
    const name = verb[0].toLowerCase();
    const rest = text.slice(at + verb[0].length, at + verb[0].length + 180);
    const next = classify(name, rest);
    if (next === "hook-switch") return next;
    cause ??= next;
  }
  return cause;
}

function classify(verb: string, rest: string): Cause | null {
  const preview = /--preview\b/.test(rest) && !/--yes\b/.test(rest) && !/--digest\b/.test(rest);
  if (SWITCH.has(verb)) return "hook-switch";
  if (verb === "update") return preview ? null : "hook-switch";
  if (ADMIN.has(verb)) {
    if (verb === "approve" && preview && !/\b[0-9a-f]{12,64}\b/.test(rest)) return null;
    return "shell-admin";
  }
  if (verb !== "pack") return null;
  const sub = /^(?:['"`][ \t]*,\s*['"`\s]*|[ \t]+)([A-Za-z]+)/.exec(rest);
  const name = sub?.[1]?.toLowerCase() ?? "";
  return PACK.has(name) && !preview ? "shell-admin" : null;
}

// Shell scripts, Makefiles and shebang programs. Other source files are judged when executed.
export function scriptControlCause(path: string, content: string): Cause | null {
  const base = basename(path);
  const script = /\.(?:sh|bash|zsh|ksh)$/i.test(base) || /^(?:GNUmakefile|makefile|Makefile)$/.test(base) || content.startsWith("#!");
  return script ? pregateControlCause(content) : null;
}
