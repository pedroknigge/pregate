import type { Interface } from "node:readline/promises";
import { visible } from "./contract.ts";
import { APPROVAL_MS } from "./approval.ts";
import { writeAll } from "./write-all.ts";

export function interactiveTerminal(): boolean {
  return !!process.stdin.isTTY && !!process.stdout.isTTY && !process.env.CI;
}

export function say(text: string): void {
  writeAll(1, Buffer.from(visible(text) + "\n", "utf8"));
}

// Each question releases its reader before contract approval opens the human TTY.
// Redirected answers and CI never create an interactive coordinator.
export async function question(prompt: string): Promise<string | null> {
  if (!interactiveTerminal()) return null;
  const reader = (require("node:readline/promises") as typeof import("node:readline/promises")).createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), APPROVAL_MS);
  const closed = () => abort.abort();
  reader.once("close", closed);
  return awaitAnswer(reader, prompt, abort, deadline, closed);
}

async function awaitAnswer(reader: Interface, prompt: string, abort: AbortController, deadline: ReturnType<typeof setTimeout>, closed: () => void): Promise<string | null> {
  try {
    const answer = (await reader.question(visible(prompt) + " ", { signal: abort.signal })).trim();
    return /^(q|quit|cancel)$/i.test(answer) ? null : answer;
  } catch { return null; }
  finally {
    clearTimeout(deadline);
    reader.removeListener("close", closed);
    reader.close();
  }
}

export async function choose(prompt: string, options: string[], defaultIndex = 0): Promise<number | null> {
  say(options.map((label, index) => `${index + 1}. ${label}`).join("\n"));
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = await question(`${prompt} [${defaultIndex + 1}] (q cancels):`);
    if (answer === null) return null;
    const index = answer === "" ? defaultIndex : Number(answer) - 1;
    if (Number.isInteger(index) && index >= 0 && index < options.length) return index;
    say(`Choose a number from 1 to ${options.length}, or q to cancel.`);
  }
  return null;
}

export async function selectPacks(names: string[]): Promise<string[] | null> {
  say(names.length ? "Suggested packs:\n" + names.map((name, i) => `${i + 1}. ${name}`).join("\n") : "No optional pack was inferred. Core requirements still apply.");
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = await question("Packs [all] (names or numbers separated by commas; none skips optional additions; q cancels):");
    if (answer === null) return null;
    if (answer === "" || answer === "all") return names;
    if (answer === "none") return [];
    const selected = answer.split(",").map(value => value.trim()).map(value => /^\d+$/.test(value) ? names[Number(value) - 1] : value);
    if (selected.every((name): name is string => !!name && names.includes(name))) return [...new Set(selected)];
    say("Choose only listed packs, all, none, or q. Use guide --preview --packs <names> to review other bundled packs.");
  }
  return null;
}

export async function customPaths(): Promise<string[] | null> {
  const paths: string[] = [];
  for (;;) {
    const answer = await question("Custom pack path [none] (one directory, without quotes; blank finishes; q cancels):");
    if (answer === null) return null;
    if (answer === "") return paths;
    paths.push(answer);
  }
}
