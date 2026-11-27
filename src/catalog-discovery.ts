import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { dataHome } from "./consent.ts";
import { packCatalog } from "./compile.ts";
import { librarySource, librarySources } from "./library.ts";
import { ENGINE_FILE } from "./platform.ts";
import { VERSIONS } from "./versions.ts";
import type { Preset } from "./types.ts";

interface CatalogEntry { ns: string; version: string; category?: string | null; checks: number; methodologies: string[] }

export function availableCatalog(): CatalogEntry[] {
  return librarySources().map(pin => {
    const catalog = packCatalog(librarySource(pin.ns)!);
    if ("errors" in catalog) throw new Error(catalog.errors.join("\n"));
    return { ns: pin.ns, version: pin.version, category: catalog.category, checks: catalog.checks.length,
      methodologies: catalog.methodologies.map(method => method.id) };
  });
}

// Read the prior immutable engine's public catalog, outside any project/delegation.
// Missing history is unknown; it must not turn every available pack into a "new" pack.
export function previousCatalog(version: string | null): CatalogEntry[] | null {
  if (!version || version === VERSIONS.engine || !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) return null;
  const binary = join(dataHome(), version, ENGINE_FILE);
  if (!existsSync(binary)) return null;
  return engineCatalog(binary, version);
}

function engineCatalog(binary: string, version: string): CatalogEntry[] | null {
  try {
    const options = { cwd: dirname(binary), stdin: "ignore" as const, stdout: "pipe" as const, stderr: "pipe" as const, timeout: 5000 };
    const identity = Bun.spawnSync([binary, "--version"], options);
    if (identity.exitCode !== 0 || !identity.stdout.toString().startsWith(`pregate ${version} (core `)) return null;
    const result = Bun.spawnSync([binary, "pack", "list", "--library", "--json"], options);
    if (result.exitCode !== 0 || result.stdout.length > 2 * 1024 * 1024) return null;
    const packs: unknown = JSON.parse(result.stdout.toString()).packs;
    if (!Array.isArray(packs) || packs.some(pack => !pack || typeof pack.ns !== "string" || typeof pack.version !== "string"
      || !Number.isSafeInteger(pack.checks) || pack.checks < 0 || !Array.isArray(pack.methodologies))) return null;
    return packs.map(pack => ({ ns: pack.ns, version: pack.version, checks: pack.checks,
      methodologies: pack.methodologies.map((method: { id: string }) => method.id) }));
  } catch (error) {
    // Unknown history must not mark every available pack as new.
    if (error instanceof SyntaxError || error instanceof TypeError || typeof (error as NodeJS.ErrnoException).code === "string") return null;
    throw error;
  }
}

export function catalogDiscovery(catalog: CatalogEntry[], previous: CatalogEntry[] | null, preset: Preset | null, recommended: { ns: string; methodologies: string[] }[]) {
  const old = new Map(previous?.map(pack => [pack.ns, pack]));
  const added = previous === null ? [] : catalog.filter(pack => !old.has(pack.ns));
  const changed = previous === null ? [] : catalog.filter(pack => old.has(pack.ns) && old.get(pack.ns)!.version !== pack.version);
  return { available: catalog, comparisonAvailable: previous !== null, newPacks: added, changedPacks: changed,
    newPackChecks: added.reduce((count, pack) => count + pack.checks, 0),
    suggestedAdditions: recommended.filter(item => item.methodologies.some(method => !preset?.methodologies.includes(method))),
    next: "Review this repo with the current catalog: pregate scan. Choose useful packs together with pregate guide --preview --packs <names>. Nothing is added automatically." };
}
