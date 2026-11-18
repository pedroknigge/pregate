// A denial's concrete repair, computed from the rule's own data. Nothing here is invented:
// a path comes from the layer map, the scope, or a path the rule already names, and a
// replacement comes from the pack's fix.use or from a parameter the check already requires.
// When either side is missing, the sentence says so and keeps the pack's fixHint.
import { languageApplies } from "./languages.ts";
import { layerOf, ruleApplies } from "./paths.ts";
import type { Cause, DecisionFix, Layer, Lock, LockRule, Violation } from "./types.ts";

const ANALYZED = new Set([
  "metric", "layer-edge", "banned-import", "typescript-fact", "python-legacy", "sibling-test",
  "required-import", "drizzle-bounded-select", "interval-cleanup", "react-index-key",
  "credential-literal", "diff", "churn-ratchet",
]);
const EXTENSIONS = ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs", "vue", "svelte", "py", "go", "rs"];
const TOKEN = /[^A-Za-z0-9@/._[\]:\\-]/g;

export function unknownFix(text: string): DecisionFix {
  return { where: null, use: null, deterministic: false, text: one(text) };
}

export function ruleFix(v: Violation, lock: Lock): DecisionFix {
  const rule = lock.rules.find((r) => r.id === v.rule);
  const hint = prose(rule?.text.fix ?? "");
  const declaredWhere = rule?.text.where ? prose(rule.text.where) : null;
  const declaredUse = rule?.text.use ? prose(rule.text.use) : null;
  const derived = rule ? derive(v, rule, lock) : { where: null, use: null };
  const use = declaredUse || derived.use;
  return finish(declaredWhere || derived.where, use, hint, v.rule, use ? undefined : derived.note);
}

export function causeFix(cause: Cause, rel: string | null, line: number | null, detail: string | null): DecisionFix {
  const file = rel === null ? null : `${token(rel)}${line === null ? "" : `:${line}`}`;
  switch (cause) {
    case "protected-path":
    case "hook-switch":
      return both(
        ".pregate/requests/<name>.json",
        "pregate preset apply <request.json> --preview",
        "Put the change in .pregate/requests/<name>.json. Use pregate preset apply <request.json> --preview instead of editing this protected path.",
      );
    case "request-invalid":
      return both(
        ".pregate/requests/<name>.json",
        "schema/request.v1.json",
        "Fix the JSON in .pregate/requests/<name>.json so it matches schema/request.v1.json and resend it.",
      );
    case "shell-write": {
      const target = shellTarget(detail) ?? file;
      const use = "Write, Edit, or apply_patch";
      return target
        ? both(target, use, `Write ${target} with Write, Edit, or apply_patch instead of this shell command.`)
        : side(null, use, `Write the project file with Write, Edit, or apply_patch instead of this shell command. No literal target path was declared.`);
    }
    case "syntax":
      return file
        ? both(file, "resend that file", `Fix the syntax at ${file} and resend that file.`)
        : side(null, "resend that file", "Fix the syntax error and resend that file. No file path was declared.");
    case "unresolvable-import":
      return side(file, null, `No replacement module is declared for the unresolved import${file ? ` in ${file}` : ""}. Import by a path that resolves inside the repo.`);
    case "tool-will-fail":
      return file
        ? both(file, "re-read the file and resend the edit", `Re-read ${file} and resend an edit whose old text is in that file and unique.`)
        : side(null, "re-read the file and resend the edit", "Re-read the file and resend an edit whose old text is in that file and unique. No file path was declared.");
    case "cannot-reconstruct":
      return side(null, "an exact replacement or a full write of the file", "No path was declared for this edit. Resend it as an exact replacement or a full write of the file.");
    case "shell-admin":
      return side(null, "a literal command name", "No deterministic path or replacement is declared for this command. Spell every command name literally and do not run it.");
    case "approval":
      return side(null, "pregate approve <code> in a separate terminal", "No code path is declared for this approval. Ask the human to run pregate approve <code> in a separate terminal.");
    case "git-missing":
      return side(null, "install Git and open a new terminal so git is on PATH", "No code path is declared for this cause. Install Git and open a new terminal so git is on PATH.");
    case "git-not-repository":
      return side(null, "git init", "No code path is declared for this cause. Run git init here, or restore the removed .git directory.");
    case "git-error":
      return side(null, "git status", "No code path is declared for this cause. Run git status in this directory and repair the Git error.");
    case "lock-stale":
      return side(null, "pregate preset diagnose --json", "No code path is declared for this cause. Inspect pregate preset diagnose --json and prepare pregate update --project --preview.");
    case "version-mismatch":
      return side(null, "pregate update --project --preview", "No code path is declared for this cause. Install the pinned engine or review pregate update --project --preview.");
    case "snapshot-missing":
      return side(null, "a new session", "No code path is declared for this cause. Start a new session.");
    case "state-io":
      return side(null, "pregate storage inspect", "No code path is declared for this cause. Run pregate storage inspect and review pregate storage recover --preview.");
    case "regex-limit":
      return side(null, "pregate preset compile", "No code path is declared for this cause. Rewrite the rule regex without repeated groups and run pregate preset compile.");
    case "contract-loosened":
      return side(null, "a reviewed request", "No code path is declared for this cause. The human restores the contract or applies a reviewed preview.");
    case "shell-uncertain":
      return side(null, "close every quote, substitution, and group", "No code path is declared for this cause. Close every quote, substitution, and group.");
    case "payload-unrecognized":
      return side(null, null, "No deterministic path or replacement is declared for this cause. Report the harness payload to the user.");
  }
}

function derive(v: Violation, rule: LockRule, lock: Lock): { where: string | null; use: string | null; note?: string } {
  const impl = rule.impl;
  if (impl.kind === "primitive" && impl.primitive === "layer-edge") return layerFix(v, lock);
  if (impl.kind === "primitive" && impl.primitive === "banned-import") return bannedFix(v, rule, lock);
  if (impl.kind === "primitive" && impl.primitive === "placement") return placementFix(v, lock);
  if (impl.kind === "primitive" && impl.primitive === "required-import") {
    const specs = strings(rule.params.specifiers).map(token);
    return { where: token(v.path), use: specs.length ? joinCap(specs, " or ") : null };
  }
  if (impl.kind === "primitive" && impl.primitive === "sibling-test") {
    const first = siblingTestCandidates(v.path)[0];
    return first ? { where: token(first), use: "a sibling or mirrored test file" } : { where: null, use: null };
  }
  if (impl.kind === "primitive" && impl.primitive === "forbidden-path") return { where: null, use: `remove ${token(v.path)}` };
  if (impl.kind === "primitive" && impl.primitive === "adr-touch") {
    const adr = strings(rule.params.adr).map(place);
    return adr.length ? { where: joinCap(adr), use: "an ADR file matching those paths in the same change" } : { where: null, use: null };
  }
  return { where: null, use: null };
}

function layerFix(v: Violation, lock: Lock): { where: string | null; use: string | null } {
  const edge = v.edge;
  const from = edge ? lock.layers[edge.from] : undefined;
  if (!edge || !from) return { where: null, use: null };
  const names = [edge.from, ...from.mayImport.filter((name) => name !== "*" && lock.layers[name])];
  const parts = names.map((name) => label(name, lock.layers[name]!));
  const hosts = Object.entries(lock.layers)
    .filter(([name, layer]) => name !== edge.from && layer.mayImport.includes(edge.from))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (hosts.length) parts.push(`implement the outer side under ${hosts.map(([name, layer]) => label(name, layer)).join(", ")}`);
  const places = names.flatMap((name) => lock.layers[name]!.paths.map(place));
  return { where: parts.join("; "), use: `a module under ${joinCap(places)} instead of ${token(edge.spec)}` };
}

function bannedFix(v: Violation, rule: LockRule, lock: Lock): { where: string | null; use: string | null; note?: string } {
  const spec = token(v.spec ?? "that import");
  const homes = Object.entries(lock.layers).flatMap(([name, layer]) => {
    const free = layer.paths.filter((glob) => {
      const sample = sampleOf(glob, "ts");
      return sample !== null && !covered(rule, sample);
    });
    return free.length === layer.paths.length && free.length > 0 ? [label(name, layer)] : [];
  });
  const where = homes.length ? homes.join(", ") : null;
  const missing = where ? "" : "No path is declared for this import. ";
  return { where, use: null, note: `${missing}No replacement API is declared for ${spec}.` };
}

function placementFix(v: Violation, lock: Lock): { where: string | null; use: string | null; note?: string } {
  if (v.placed === "no-language-pack-in-layer") {
    const layer = layerOf(lock, v.path);
    const globs = layer ? lock.layers[layer]!.paths : [];
    const exts = checkedExtensions(lock, globs).slice(0, 8).map((ext) => `.${ext}`);
    const places = globs.map(place);
    const shown = exts.length ? joinCap(exts) : null;
    if (!places.length) return { where: null, use: shown, note: shown ? undefined : "No checked language is declared for that layer." };
    const where = shown ? `${joinCap(places)} as ${shown}, or outside ${joinCap(places)}` : `outside ${joinCap(places)}`;
    return { where, use: shown, note: shown ? undefined : "No checked language is declared for that layer." };
  }
  if (v.placed === "new-in-exclude") {
    const includes = lock.scope.include.map(place);
    return includes.length
      ? { where: joinCap(includes), use: "a source file under those paths" }
      : { where: null, use: null, note: "No in-scope path is declared." };
  }
  if (v.placed === "edit-generated-or-excluded") return { where: null, use: null, note: "No generator output path is declared." };
  return { where: null, use: null };
}

function finish(where: string | null, use: string | null, hint: string, rule: string, note?: string): DecisionFix {
  const place = where && where.length > 0 ? where : null;
  const instead = use && use.length > 0 ? use : null;
  const id = token(rule);
  const lead = place && instead
    ? `Put the code in ${place}. Use ${instead}.`
    : place
      ? `Put the code in ${place}. ${note ?? `No replacement is declared for ${id}.`}`
      : instead
        ? `${note ?? `No path is declared for ${id}.`} Use ${instead}.`
        : `${note ?? `No deterministic path or replacement is declared for ${id}.`}`;
  const extra = hint !== "" && !lead.includes(hint) ? ` ${hint}` : "";
  return { where: place, use: instead, text: one(`${lead}${extra}`), deterministic: place !== null && instead !== null };
}

function both(where: string, use: string, text: string): DecisionFix {
  return { where, use, text: one(text), deterministic: true };
}

function side(where: string | null, use: string | null, text: string): DecisionFix {
  return { where, use, text: one(text), deterministic: false };
}

function covered(rule: LockRule, rel: string): boolean {
  return Array.isArray(rule.params.paths) && ruleApplies(rule, rel);
}

function analyzes(rule: LockRule): boolean {
  if (rule.impl.kind === "pattern") return true;
  return rule.impl.kind === "primitive" && ANALYZED.has(rule.impl.primitive);
}

function checkedExtensions(lock: Lock, globs: string[]): string[] {
  const base = globs[0];
  if (!base) return [];
  return EXTENSIONS.filter((ext) => {
    const sample = sampleOf(base, ext);
    return sample !== null && lock.rules.some((rule) => analyzes(rule) && languageApplies(rule, sample) && covered(rule, sample));
  });
}

function sampleOf(glob: string, ext: string): string | null {
  if (glob.includes("**")) return `${glob.slice(0, glob.indexOf("**"))}a.${ext}`.replace(/\/{2,}/g, "/");
  if (glob.includes("*")) {
    const replaced = glob.replace(/\*/g, "a");
    return /\.[A-Za-z0-9]+$/.test(replaced) ? replaced.replace(/\.[A-Za-z0-9]+$/, `.${ext}`) : `${replaced.replace(/\/$/, "")}/a.${ext}`;
  }
  if (/\.[A-Za-z0-9]+$/.test(glob)) return glob.replace(/\.[A-Za-z0-9]+$/, `.${ext}`);
  return `${glob.replace(/\/$/, "")}/a.${ext}`;
}

function label(name: string, layer: Layer): string {
  return `${token(name)} (${joinCap(layer.paths.map(place))})`;
}

function place(glob: string): string {
  const leaf = glob.split("/").pop() ?? glob;
  const directory = glob.endsWith("/") || glob.endsWith("/**") || glob.endsWith("/*") || !/\.[A-Za-z0-9]+$/.test(leaf);
  const stem = glob.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\?/g, "").replace(/\/{2,}/g, "/").replace(/\/$/, "");
  const shown = token(stem.length > 0 ? stem : ".");
  return directory ? `${shown}/` : shown;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

function joinCap(items: string[], sep = ", "): string {
  if (items.length <= 4) return items.join(sep);
  return `${items.slice(0, 4).join(sep)}${sep === " or " ? " or " : ", "}${items.length - 4} more`;
}

const CODE_EXT = ["ts", "tsx", "js", "jsx"];

// Same directory, `__tests__` beside the file, or `src/` mirrored under `test/`, `tests/`, or `__tests__/`.
export function siblingTestCandidates(rel: string): string[] {
  const parts = rel.split("/");
  const file = parts.pop() ?? rel;
  const dot = file.lastIndexOf(".");
  const base = dot < 0 ? file : file.slice(0, dot);
  const ext = dot < 0 ? "" : file.slice(dot + 1);
  const leaves = [...new Set([ext, ...CODE_EXT].filter((item) => item !== ""))].flatMap((item) => [`${base}.test.${item}`, `${base}.spec.${item}`]);
  const folders = new Set<string>();
  const add = (folder: string): void => void folders.add(folder);
  const dir = parts.join("/");
  add(dir);
  add(dir === "" ? "__tests__" : `${dir}/__tests__`);
  const src = parts.indexOf("src");
  if (src >= 0) for (const root of ["test", "tests", "__tests__"]) {
    const mirrored = [...parts];
    mirrored[src] = root;
    add(mirrored.join("/"));
  }
  for (const root of ["test", "tests"]) add(dir === "" ? root : `${root}/${dir}`);
  const out: string[] = [];
  for (const folder of folders) for (const leaf of leaves) {
    const path = folder === "" ? leaf : `${folder}/${leaf}`;
    if (path !== rel) out.push(path);
  }
  return out;
}

function shellTarget(detail: string | null): string | null {
  if (!detail) return null;
  const found = /write target `([^`]{1,300})`/.exec(detail)?.[1];
  if (!found || (!/[\\/]/.test(found) && !/^[A-Za-z]:/.test(found))) return null;
  return token(found);
}

function token(s: string): string {
  const cleaned = s.replace(TOKEN, "_");
  if (cleaned.length <= 80) return cleaned || "_";
  const tail = cleaned.slice(-80);
  const slash = tail.indexOf("/");
  // Keep a path boundary. A raw tail can start in the middle of a directory name.
  return (slash > 0 && slash < 40 ? tail.slice(slash) : tail) || "_";
}

function prose(s: string): string {
  return one(s.replace(/[\u0000-\u001f]/g, " "));
}

function one(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
