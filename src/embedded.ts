import { builtinContentHash as hashBuiltin, installEvaluator, readAssets, readCatalog, readDemo } from "./disk.ts" with { type: "macro" };
import type { Files } from "./types.ts";

// Bun 1.4 leaves a macro call unreplaced when one static import graph reaches its module twice, so
// consumers `require` this module during evaluation. Literals stay inside factories (see library-assets.ts).
// The macro functions resolve the repository from their own file, so a test can chdir first.
export function builtinCatalog(): Files {
  return readCatalog();
}

// Inlined at bundle time so a hook can name the catalog bytes without parsing them.
export function builtinContentHash(): string {
  return hashBuiltin();
}
export function installAssets(): Files {
  return readAssets();
}
export function demoFiles(): Files {
  return readDemo();
}
export function evaluator(): string {
  return installEvaluator();
}
