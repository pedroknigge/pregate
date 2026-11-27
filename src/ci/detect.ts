import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "../git.ts";
import { isObject, parse } from "../harness/wire.ts";
import { pregateJobNames, type CiProviderId } from "./provider.ts";

export interface DetectedProvider {
  id: CiProviderId;
  detail: string;
  checks: string[];
}

interface CiConfiguration {
  providers: DetectedProvider[];
  text: string;
}

const SCRIPT = "scripts/pregate-vercel-build.sh";

// Local files that make a provider required. This does not call GitHub. A repository with no
// Actions workflow is not required to have an Actions check; a Vercel build recipe is required
// on its own.
export function detectProviders(dir: string): DetectedProvider[] {
  const top = git(dir, ["rev-parse", "--show-toplevel"])?.trim() || dir;
  const places = top === dir ? [dir] : [dir, top];
  const providers: DetectedProvider[] = [];
  const actions = detectActions(top);
  if (actions) providers.push(actions);
  const vercel = places.map(detectVercel).find((item) => item !== null) ?? null;
  if (vercel) providers.push(vercel);
  return providers;
}

export function describeCi(dir: string): CiConfiguration {
  const providers = detectProviders(dir);
  if (providers.length === 0) {
    return {
      providers,
      text: "CI providers: none configured. pregate install --ci github writes the GitHub Actions workflow. pregate install --ci vercel writes the Vercel build recipe. A repository can use either or both.",
    };
  }
  const parts = providers.map((provider) => provider.checks.length === 0
    ? `${provider.id} (${provider.detail})`
    : `${provider.id} (${provider.detail}, checks ${provider.checks.join(", ")})`);
  return { providers, text: `CI providers: ${parts.join("; ")}.` };
}

function detectActions(top: string): DetectedProvider | null {
  const directory = join(top, ".github/workflows");
  if (!existsSync(directory)) return null;
  let entries: string[] = [];
  try { entries = readdirSync(directory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const checks = new Set<string>();
  let found = false;
  for (const name of entries) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    const text = readText(join(directory, name));
    if (text === null || !/\bpregate\b/i.test(text)) continue;
    found = true;
    for (const job of pregateJobNames(text)) checks.add(job);
  }
  if (!found) return null;
  if (checks.size === 0) checks.add("pregate");
  return { id: "github-actions", detail: "workflow", checks: [...checks].sort() };
}

function detectVercel(dir: string): DetectedProvider | null {
  if (existsSync(join(dir, SCRIPT))) return vercel();
  const vercelJson = readText(join(dir, "vercel.json"));
  if (vercelJson !== null) {
    const parsed = parse(vercelJson);
    if (isObject(parsed) && typeof parsed.buildCommand === "string" && /\bpregate\b/i.test(parsed.buildCommand)) return vercel();
  }
  const pkg = readText(join(dir, "package.json"));
  if (pkg !== null) {
    const parsed = parse(pkg);
    const scripts = isObject(parsed) && isObject(parsed.scripts) ? parsed.scripts : null;
    if (scripts && Object.values(scripts).some((value) => typeof value === "string" && /\bpregate\b/i.test(value))) return vercel();
  }
  return null;
}

function vercel(): DetectedProvider {
  return { id: "vercel", detail: "build recipe", checks: [] };
}

function readText(path: string): string | null {
  try { return readFileSync(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
