import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dir, "../../src/harness");
const ALLOWED: Record<string, readonly string[]> = {
  "agy.ts": ["./wire.ts", "../types.ts"],
  "claude.ts": ["./wire.ts", "../types.ts"],
  "codex.ts": ["./wire.ts", "../types.ts", "../paths.ts", "node:path", "node:crypto"],
  "cursor.ts": ["./wire.ts", "../types.ts"],
  "grok.ts": ["./wire.ts", "../types.ts"],
  "opencode.ts": ["./wire.ts", "../types.ts", "../paths.ts", "../product.ts", "node:path"],
  "profile.ts": ["./agy.ts", "./claude.ts", "./codex.ts", "./cursor.ts", "./grok.ts", "./opencode.ts", "./wire.ts", "../types.ts"],
  "wire.ts": ["../consent.ts", "../paths.ts", "../types.ts"],
};

function specs(source: string): string[] {
  const found: string[] = [];
  const pattern = /(?:from\s+|require\(\s*)["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) found.push(match[1]!);
  return found;
}

test("harness files import only the modules that keep the encoder and the decoders apart", () => {
  const files = readdirSync(DIR).filter((name) => name.endsWith(".ts")).sort();
  expect(files).toEqual(Object.keys(ALLOWED).sort());
  for (const name of files) {
    const source = readFileSync(join(DIR, name), "utf8");
    const unexpected = specs(source).filter((spec) => !ALLOWED[name]!.includes(spec));
    expect(unexpected, name).toEqual([]);
  }
});

test("enabledWire is the adapter seam, not the hook path", () => {
  const root = join(import.meta.dir, "../../src");
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (name.endsWith(".ts")) {
        if (readFileSync(path, "utf8").includes("enabledWire")) hits.push(path.slice(root.length + 1));
      } else if (!name.includes(".")) walk(path);
    }
  };
  walk(root);
  expect(hits.sort()).toEqual(["harness/wire.ts", "supervisor.ts"]);
});
