import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyPreset } from "./approval-command.ts";
import { foldArkgateText } from "./arkgate-import.ts";
import { visible } from "./contract.ts";
import { canonical, findRoot } from "./disk.ts";
import { grammars, PRESET, readText } from "./gate.ts";
import { repoFiles } from "./init.ts";
import { absolutePath, relativePath } from "./paths.ts";
import type { Preset } from "./types.ts";

const USAGE = "usage: pregate import arkgate --preview [--config <path>]";

// A review of ark.config.json: the layer map and coexist.arkgate. Approval stays the existing
// human route (`pregate approve <code>`). There is no --yes.
export async function importArkgate(args: string[], directory = process.cwd()): Promise<{ code: number; text: string }> {
  const parsed = flags(args);
  if (parsed === null) return { code: 1, text: USAGE };
  if (!parsed.preview) return { code: 1, text: `import arkgate only prepares a review; add --preview. The human approves it with pregate approve <code>.\n${USAGE}` };
  try {
    const root = findRoot(canonical(directory), () => true);
    if (root === null) return { code: 1, text: "Set up PREGATE first: pregate guide --preview. Nothing staged." };
    const config = configFile(directory, root, parsed.config);
    if (typeof config === "string") return { code: 1, text: config };
    const current = readText(join(root, PRESET));
    if (current === null) return { code: 1, text: "Set up PREGATE first: pregate guide --preview. Nothing staged." };
    await grammars();
    const folded = foldArkgateText(root, JSON.parse(current) as Preset, repoFiles(root), config.rel, config.text);
    if ("errors" in folded) return { code: 1, text: folded.errors.join("\n") };
    const text = `${JSON.stringify(folded.preset, null, 2)}\n`;
    if (text === current.replaceAll("\r\n", "\n")) return { code: 0, text: "ArkGate coexistence is already in this contract. Nothing staged." };
    const review = await applyPreset(root, text, { preview: true, stable: true });
    if (review.code !== 0) return review;
    return { code: 0, text: visible([...folded.notes, ...folded.evidenceLines, review.text].join("\n")) };
  } catch (e) { return { code: 1, text: visible(`import arkgate failed: ${(e as Error).message}. Nothing staged.`) }; }   // fail-closed: exit 1, nothing staged
}

function flags(args: string[]): { preview: boolean; config: string | null } | null {
  if (args[0] !== "arkgate") return null;
  let preview = false, config: string | null = null;
  const rest = args.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg === "--preview") { if (preview) return null; preview = true; continue; }
    if (arg === "--config") {
      const value = rest[++i];
      if (config !== null || value === undefined || value.startsWith("-")) return null;
      config = value;
      continue;
    }
    return null;
  }
  return { preview, config };
}

function configFile(directory: string, root: string, given: string | null): { rel: string; text: string } | string {
  const spelled = given ?? "ark.config.json";
  const path = given === null ? join(root, spelled) : absolutePath(given) ? given : resolve(directory, given);
  let rel: string;
  try { rel = relativePath(root, canonical(path)); }
  catch (e) {
    if (!(e instanceof Error) || !/no existing ancestor|too many symbolic links/.test(e.message)) throw e;
    return `${spelled} is outside this repository. Nothing staged.`;
  }
  if (rel === "" || rel.startsWith("../") || absolutePath(rel)) return `${spelled} is outside this repository. Nothing staged.`;
  const file = join(root, rel);
  if (!existsSync(file)) return `No ${rel}. Nothing staged.`;
  try { return { rel, text: readFileSync(file, "utf8") }; }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code === undefined) throw e;
    return `Could not read ${rel}: ${(e as Error).message}. Nothing staged.`;
  }
}
