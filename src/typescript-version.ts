import { compareVersions } from "./product.ts";
import type { LockRule, Read, Severity } from "./types.ts";

// TypeScript 7.0 makes a few 6.0 deprecations into hard errors. A rule opts into that
// boundary with `when`. The installed compiler wins over the declared range, because that
// is the compiler that will accept or reject the file. Without `otherwise`, an unknown or
// older compiler does not run the rule. With `otherwise: "warn"`, that same compiler still
// reports the finding as a warning. A pre-release is not 7.0.0.
export function gatedSeverity(rule: LockRule, rel: string, read: Read): Severity | null {
  const when = rule.when;
  if (when === undefined) return rule.severity;
  const version = typescriptVersion(rel, read);
  if (version !== null && compareVersions(version, when.min) >= 0) return rule.severity;
  return when.otherwise ?? null;
}

function typescriptVersion(rel: string, read: Read): string | null {
  const dirs = directories(rel);
  for (const dir of dirs) {
    const installed = installedVersion(read(`${dir}node_modules/typescript/package.json`));
    if (installed !== null) return installed;
  }
  for (const dir of dirs) {
    const declared = declaredMinimum(read(`${dir}package.json`));
    if (declared.present) return declared.version;
  }
  return null;
}

function directories(rel: string): string[] {
  const dirs = [""];
  let prefix = "";
  for (const part of rel.split(/[\\/]/).slice(0, -1)) {
    if (part === "") continue;
    prefix += `${part}/`;
    dirs.push(prefix);
  }
  return dirs.reverse();
}

function installedVersion(text: string | null): string | null {
  if (text === null) return null;
  try {
    const version = (JSON.parse(text) as { version?: unknown }).version;
    return typeof version === "string" ? concrete(version.trim().replace(/^v/, "")) : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function declaredMinimum(text: string | null): { present: boolean; version: string | null } {
  if (text === null) return { present: false, version: null };
  let pkg: Record<string, unknown>;
  try { pkg = JSON.parse(text) as Record<string, unknown>; }
  catch (error) { if (error instanceof SyntaxError) return { present: false, version: null }; throw error; }
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const table = pkg[field];
    if (table === null || typeof table !== "object" || Array.isArray(table)) continue;
    const spec = (table as Record<string, unknown>).typescript;
    if (typeof spec === "string") return { present: true, version: minimumVersion(spec) };
  }
  return { present: false, version: null };
}

// The lower bound when the range states one. A floating or disjunctive range stays unknown.
function minimumVersion(spec: string): string | null {
  const alias = /^npm:typescript@(.+)$/.exec(spec.trim());
  const raw = (alias?.[1] ?? spec).trim();
  const bounded = /^(?:\^|~|>=)\s*v?(\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.]+)?)$/.exec(raw)
    ?? /^>=\s*v?(\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.]+)?)\s+</.exec(raw)
    ?? /^v?(\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.]+)?)$/.exec(raw);
  return bounded ? concrete(bounded[1]!) : null;
}

function concrete(version: string): string | null {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.]+))?$/.exec(version);
  if (!match) return null;
  return `${match[1]}.${match[2] ?? "0"}.${match[3] ?? "0"}${match[4] ? `-${match[4]}` : ""}`;
}
