import { builtinContentHash as hashBuiltin, evaluationFingerprint, readTree } from "./disk.ts" with { type: "macro" };
import type { Files } from "./types.ts";

// Bun 1.4 leaves a macro call unreplaced when one static import graph reaches its module twice, so
// consumers `require` this module during evaluation. Literals stay inside factories (see library-assets.ts).
export function builtinCatalog(): Files {
  return readTree("catalog", false);
}

// Inlined at bundle time so a hook can name the catalog bytes without parsing them.
export function builtinContentHash(): string {
  return hashBuiltin();
}
export function installAssets(): Files {
  return readTree("assets", true);
}
export function demoFiles(): Files {
  return readTree("examples/demo", true);
}
export function evaluator(): string {
  return evaluationFingerprint();
}
