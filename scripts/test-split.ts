// Splits `bun test` into the fast half and the compiled-binary half. A shell glob of
// `test/*.test.ts` misses `test/harness/` and drops `test/e2e.test.ts` from both halves:
// `grep -v e2e` excludes it, and `*.e2e.test.ts` does not name it. `e2e-real-evidence.test.ts`
// is a unit file whose name contains "e2e"; it stays in the fast half.
import { Glob } from "bun";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

export function isE2eTest(rel: string): boolean {
  const base = rel.split(/[/\\]/).pop() ?? rel;
  return base === "e2e.test.ts" || base.endsWith(".e2e.test.ts");
}

export function partition(root = ROOT): { all: string[]; unit: string[]; e2e: string[] } {
  const all = [...new Glob("**/*.test.ts").scanSync({ cwd: join(root, "test") })].map((file) => file.split("\\").join("/")).sort();
  return { all, unit: all.filter((file) => !isE2eTest(file)), e2e: all.filter(isE2eTest) };
}

if (import.meta.main) {
  const which = process.argv[2];
  const { unit, e2e } = partition();
  const files = which === "unit" ? unit : which === "e2e" ? e2e : null;
  if (files === null || files.length === 0) {
    console.error("usage: bun scripts/test-split.ts unit|e2e");
    process.exit(2);
  }
  const result = spawnSync(process.execPath, ["test", ...files.map((file) => join("test", file))], { cwd: ROOT, stdio: "inherit" });
  process.exit(result.status ?? 1);
}
