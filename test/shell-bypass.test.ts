import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandOnPath, controlInFile, readScriptFile } from "../src/control-file.ts";
import { inScope, protectedGlobs, protects, scopeUnder } from "../src/paths.ts";
import { guard } from "../src/shell.ts";
import type { Lock } from "../src/types.ts";

const ROOT = "/repo";
const globs = protectedGlobs(ROOT, ["team-rules"], { home: "/home/u", data: "/home/u/.local/state/pregate", engine: "/home/u/.local/share/pregate" });
const scope = { include: ["src/**", "test/**"], exclude: [] } as Lock["scope"];
const rel = (abs: string): string | null => (abs === ROOT ? "" : abs.startsWith(`${ROOT}/`) ? abs.slice(ROOT.length + 1) : null);
const lock = { scope } as Lock;
const ctx = {
  machineOnly: false, harness: "claude-code" as const, touched: () => true,
  launcher: `${ROOT}/.pregate/bin/pregate`,
  isProtected: (abs: string) => protects(abs, globs),
  inScope: (abs: string) => rel(abs) !== null && inScope(lock, rel(abs)!),
  under: (abs: string) => rel(abs) !== null && scopeUnder(lock, rel(abs)!),
  readControlFile: controlInFile, readScriptFile, commandPath: commandOnPath,
};

test("rsync, tar extract, formatters that write, and literal script files are denied in scope", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-shell-bypass-"));
  const writer = join(dir, "writer.js");
  const sh = join(dir, "w.sh");
  writeFileSync(writer, `require('fs').writeFileSync('${ROOT}/src/a.ts', 'x');`);
  writeFileSync(join(dir, "writer2.cjs"), `require('fs').writeFileSync('${ROOT}/src/a.ts', 'x');`);
  writeFileSync(sh, `#!/bin/sh\necho x > ${ROOT}/src/a.ts\n`);
  chmodSync(sh, 0o755);
  writeFileSync(join(dir, "ok.js"), "console.log(1);\n");
  writeFileSync(join(dir, "ok.sh"), "#!/bin/sh\necho hello\n");
  chmodSync(join(dir, "ok.sh"), 0o755);
  for (const command of [
    "rsync -a /tmp/evil.ts src/application/",
    "rsync -a /tmp/evil.ts src/application",
    "tar xzf /tmp/evil.tar.gz -C src/application",
    "tar -xzf /tmp/evil.tar.gz",
    "npx prettier --write src/a.ts",
    "eslint --fix src/a.ts",
    "ruff check --fix src/a.ts",
    `node ${writer}`,
    `node ${join(dir, "writer2.cjs")}`,
    `sh ${sh}`,
  ]) {
    expect(guard(command, ROOT, ctx), command).toBe("shell-write");
  }
  for (const command of [
    "tar tzf /tmp/evil.tar.gz",
    "tar -tf /tmp/evil.tar.gz",
    "prettier --check src/a.ts",
    "rsync -a --dry-run /tmp/evil.ts src/application/",
    `node ${join(dir, "ok.js")}`,
    `sh ${join(dir, "ok.sh")}`,
    'python3 -c "print(1)"',
  ]) {
    expect(guard(command, ROOT, ctx), command).toBeNull();
  }
});

test("a node script file: literal imports of modules that do not write pass, writers and computed imports are sinks", async () => {
  const { nodeFile } = await import("../src/inline-sinks.ts");
  for (const text of [
    "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport x, { y } from '../index.js';\ntest('x', () => assert.equal(x, y));\n",
    "const assert = require('assert');\nconst app = require('../lib/app');\nmodule.exports = class A { constructor() { this.a = app[assert.name]; } };\n",
    "import type { A } from './a.ts';\nimport './setup.js';\nconst here = import.meta.dirname;\nconst m = await import('./m.js');\nsetTimeout(() => process.exit(0), 10);\n",
    "console.log(process.argv.slice(2), process.env.CI, globalThis.name);\n",
  ]) expect(nodeFile(text).sink, text).toBe(false);
  for (const text of [
    "import fs from 'node:fs';\n", "import { writeFile } from 'fs/promises';\n", "const { execSync } = require('child_process');\n",
    "const cp = await import('node:child_process');\n", "import { $ } from 'bun';\n", "import { write } from 'fs-extra';\n",
    "import vm from 'node:vm';\n", "import { createRequire } from 'node:module';\n", "import { dlopen } from 'bun:ffi';\n",
    "const r = require; r('f' + 's');\n", "const name = 'fs'; require(name);\n", "await import(spec);\n", "require(`fs`);\n",
    "eval('1');\n", "new Function('return 1')();\n", "Bun.write('a', 'b');\n", "Deno.writeTextFileSync('a', 'b');\n",
    "process.binding('fs');\n", "process.mainModule.require('fs');\n", "globalThis.process.mainModule;\n",
    "import x from 'ok';\nfs.writeFileSync('a', 'b');\n",
  ]) expect(nodeFile(text).sink, text).toBe(true);
  const { noNewNodeSinks } = await import("../src/inline-sinks.ts");
  const had = "import vm from 'node:vm';\nimport fs from 'node:fs';\nfs.readFileSync('a');\nvm.runInNewContext('1');\n";
  expect(noNewNodeSinks(had, `${had}console.log(1);\n`)).toBe(true);
  expect(noNewNodeSinks(had, had.replace("fs.readFileSync('a');\n", ""))).toBe(true);
  for (const more of ["fs.writeFileSync('a', 'b');\n", "vm.runInNewContext('2');\n", "import cp from 'node:child_process';\n", "eval('1');\n", "require(name);\n"])
    expect(noNewNodeSinks(had, had + more), more).toBe(false);
  // A sink is the name with its member: a read turned into a write is a new sink.
  expect(noNewNodeSinks(had, had.replace("fs.readFileSync('a')", "fs.writeFileSync('a', 'b')"))).toBe(false);
  expect(noNewNodeSinks(had, had.replace("fs.readFileSync('a')", "fs . writeFileSync('a', 'b')"))).toBe(false);
  // The imports leave the text that is scanned for path tokens: an imported project file is not a write.
  expect(nodeFile("import a from './src/a.ts';\n").rest).not.toContain("src/a.ts");
});
