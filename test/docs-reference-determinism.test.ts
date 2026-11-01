import { expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
setDefaultTimeout(120_000);

test("generated docs and the README catalog do not depend on the process locale", () => {
  const index = readFileSync(join(root, "docs/README.md"), "utf8");
  expect(index).toContain("[benchmarks/false-positives.md](benchmarks/false-positives.md)");
  expect(index).toContain("| [benchmarks/false-positives.md](benchmarks/false-positives.md) | Measurement record |");
  for (const locale of ["C", "C.UTF-8", "en_US.UTF-8", "POSIX"]) {
    for (const script of ["scripts/docs-reference.ts", "scripts/readme-catalog.ts"]) {
      const result = spawnSync(process.execPath, [script, "--check"], {
        cwd: root, env: { ...process.env, LANG: locale, LC_ALL: locale }, encoding: "utf8", timeout: 60_000,
      });
      expect(result.stderr, `${script} ${locale}`).not.toContain("stale");
      expect(result.status, `${script} ${locale}\n${result.stderr}\n${result.stdout}`).toBe(0);
    }
  }
});
