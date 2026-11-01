import type { Alias, Manifest, Preset } from "./types.ts";

type Entry = { ns: string; methodology: string; alias: Alias };

function entries(manifests: Manifest[]): Entry[] {
  return manifests.flatMap((m) => m.invariants.map((alias) => ({ ns: m.id.split("/")[0]!, methodology: m.id, alias })));
}

function refers(key: string, entry: Entry): boolean {
  return [entry.methodology, entry.alias.id, `${entry.ns}/${entry.alias.id}`, entry.alias.check].includes(key);
}

// Compose existing preset fields. Unrelated policies survive; compile diagnoses remaining conflicts.
export function selectMethodology(input: Preset, manifest: Manifest, only?: string[]): Preset | { errors: string[] } {
  const ns = manifest.id.split("/")[0]!;
  const selected = new Set(only ?? manifest.invariants.map((a) => a.id));
  const unknown = [...selected].filter((id) => !manifest.invariants.some((a) => id === a.id || id === `${ns}/${a.id}`));
  if (unknown.length || selected.size === 0) return { errors: [`Unknown or empty invariant selection for ${manifest.id}: ${unknown.join(", ")}. Use pack show ${manifest.id}.`] };
  const preset = structuredClone(input);
  preset.methodologies = [...new Set([...preset.methodologies, manifest.id])];
  // A pack that names how two of its methodologies share a dimension is applied
  // when the second one is selected, so guide does not stop on its own suggestion.
  recordSuggestedResolution(preset, manifest);
  if (only === undefined && ns !== "core") return preset;
  const overrides = preset.overrides ??= {};
  for (const alias of manifest.invariants) {
    const key = Object.hasOwn(overrides, alias.id) ? alias.id : `${ns}/${alias.id}`;
    const before = overrides[key];
    if (!selected.has(alias.id) && !selected.has(`${ns}/${alias.id}`)) {
      overrides[key] = typeof before === "object" ? { ...before, severity: "off" } : "off";
    } else if (before === "off") delete overrides[key];
    else if (typeof before === "object" && before.severity === "off") {
      const { severity: _, ...rest } = before;
      if (Object.keys(rest).length) overrides[key] = rest; else delete overrides[key];
    }
    const checkPolicy = overrides[alias.check];
    if ((selected.has(alias.id) || selected.has(`${ns}/${alias.id}`))
      && (checkPolicy === "off" || (typeof checkPolicy === "object" && checkPolicy.severity === "off"))) {
      const policy = overrides[key];
      if (policy === undefined || (typeof policy === "object" && policy.severity === undefined)) {
        overrides[key] = { ...(typeof policy === "object" ? policy : {}), severity: alias.severity };
      }
    }
  }
  return preset;
}

// One more invariant of a methodology: an unselected methodology joins with only that invariant on;
// a selected one only loses the "off" override of that invariant, so the others keep their policy.
export function addInvariant(input: Preset, manifest: Manifest, aliasId: string): Preset | { errors: string[] } {
  const ns = manifest.id.split("/")[0]!;
  if (!manifest.invariants.some((a) => a.id === aliasId)) return { errors: [`Unknown invariant ${aliasId} in ${manifest.id}. Use pack show ${manifest.id}.`] };
  if (ns !== "core" && !input.methodologies.includes(manifest.id)) return selectMethodology(input, manifest, [aliasId]);
  const preset = structuredClone(input);
  for (const key of [aliasId, `${ns}/${aliasId}`]) switchOn(preset.overrides ?? {}, key);
  return preset;
}

function recordSuggestedResolution(preset: Preset, manifest: Manifest): void {
  const selected = new Set(preset.methodologies);
  const additions: [string, string][] = [];
  for (const conflict of manifest.conflicts) {
    if (!selected.has(conflict.with)) continue;
    if (preset.resolve?.[conflict.dimension]) continue;
    additions.push([conflict.dimension, conflict.suggest.use]);
  }
  if (!additions.length) return;
  const resolve = preset.resolve ??= {};
  for (const [dimension, use] of additions) resolve[dimension] ??= { use };
}

function switchOn(overrides: NonNullable<Preset["overrides"]>, key: string): void {
  const before = overrides[key];
  if (before === "off") delete overrides[key];
  if (typeof before !== "object" || before.severity !== "off") return;
  const { severity: _, ...rest } = before;
  if (Object.keys(rest).length) overrides[key] = rest; else delete overrides[key];
}

export function removeSelection(input: Preset, manifests: Manifest[], id: string, source = false): Preset | { errors: string[] } {
  if (source && id === "core") return { errors: ["The builtin core source cannot be removed. Disable individual rules or a core methodology in a reviewed contract instead."] };
  const removed = manifests.filter((m) => source ? m.id.startsWith(`${id}/`) : m.id === id);
  if (!source && id.startsWith("core/")) {
    if (!removed.length) return { errors: [`Unknown core methodology ${id}.`] };
    const preset = structuredClone(input);
    const overrides = preset.overrides ??= {};
    for (const entry of entries(removed)) {
      const key = Object.hasOwn(overrides, entry.alias.id) ? entry.alias.id : `${entry.ns}/${entry.alias.id}`;
      const before = overrides[key];
      overrides[key] = typeof before === "object" ? { ...before, severity: "off" } : "off";
    }
    return preset;
  }
  if (!source && !input.methodologies.includes(id)) return { errors: [`Methodology ${id} is not selected.`] };
  const preset = structuredClone(input);
  preset.methodologies = preset.methodologies.filter((m) => !removed.some((r) => r.id === m));
  if (source) preset.sources = preset.sources.filter((s) => s.ns !== id);
  const lost = entries(removed);
  const kept = entries(manifests.filter((m) => (preset.methodologies.includes(m.id) || m.id.startsWith("core/")) && !removed.includes(m)));
  const gone = (key: string) => lost.some((e) => refers(key, e)) && !kept.some((e) => refers(key, e));
  for (const key of Object.keys(preset.overrides ?? {})) if (gone(key)) delete preset.overrides![key];
  for (const [dimension, choice] of Object.entries(preset.resolve ?? {})) if (gone(choice.use)) delete preset.resolve![dimension];
  if (preset.settled) preset.settled = preset.settled.filter((s) => !s.rules.some(gone));
  if (preset.settled?.length === 0) delete preset.settled;
  if (preset.coexist?.arkgate) preset.coexist.arkgate.ownedByArkgate = preset.coexist.arkgate.ownedByArkgate.filter((key) => !gone(key));
  return preset;
}
