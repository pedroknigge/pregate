import { closeSync, openSync, readSync, statSync } from "node:fs";
import { basename } from "node:path";
import type { Cause } from "./types.ts";

// Bounded scan of one literal script, Makefile or interpreter program. This is a text heuristic:
// it does not execute the program, expand variables, or decode encodings.
const MAX_SCAN = 1_048_576;
const SWITCH = new Set(["uninstall", "setup", "install"]);
const ADMIN = new Set(["approve", "disable", "enable"]);
const PACK = new Set(["enable", "disable", "remove", "add", "apply", "update"]);

// `pregate` as a command word, then a shell separator or a quoted-list separator, then a verb.
const HEAD = /\bpregate(?:\.(?:exe|cmd|bat))?\b/gi;
const SEPARATOR = /^(?:['"`]\s*,\s*['"`\s]*|[\s'"`]+|\)\s*)/;

// A pregate invocation an agent must not run: approve/disable/enable, install/setup/update/uninstall,
// a pack mutation, or a hook-trust edit. Read-only previews (`approve --preview`, `update --preview`,
// `pack … --preview` without `--yes`) stay visible.
export function pregateControlCause(text: string): Cause | null {
  if (text.length > MAX_SCAN) return "shell-admin";
  // CI in the environment shows approval codes. Inline code must not set it and call pregate.
  if (/\bpregate\b/i.test(text) && (/\bCI\s*=/.test(text) || /(?:environ|env|putenv|setenv)[^;\n]{0,80}['"]CI['"]/.test(text))) return "hook-switch";
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
  const sub = /^(?:['"`]\s*,\s*['"`\s]*|\s+)([A-Za-z]+)/.exec(rest);
  const name = sub?.[1]?.toLowerCase() ?? "";
  return PACK.has(name) && !preview ? "shell-admin" : null;
}

// The first 1 MiB of a literal file, or null when it cannot be read as a regular file.
export function controlInFile(path: string | null): Cause | null {
  if (path === null || path === "") return null;
  let fd: number | null = null;
  try {
    if (!statSync(path).isFile()) return null;
    fd = openSync(path, "r");
    const buf = Buffer.alloc(MAX_SCAN);
    const n = readSync(fd, buf, 0, MAX_SCAN, 0);
    return n > 0 ? pregateControlCause(buf.toString("utf8", 0, n)) : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

// Shell scripts, Makefiles and shebang programs. Other source files are judged when executed.
export function scriptControlCause(path: string, content: string): Cause | null {
  const base = basename(path);
  const script = /\.(?:sh|bash|zsh|ksh)$/i.test(base) || /^(?:GNUmakefile|makefile|Makefile)$/.test(base) || content.startsWith("#!");
  return script ? pregateControlCause(content) : null;
}
