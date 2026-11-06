import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { nodeInspection, pythonInspection } from "../src/python-inspection.ts";
import { pathWithoutWindowsApps, pythonCommand } from "./host-command.ts";

const inspect = (source: string) => pythonInspection(["-I", "-c", source].map(text => ({ text, literal: true })));

function windowsPython(name: string): string | null {
  const path = pathWithoutWindowsApps(process.env.PATH ?? process.env.Path ?? "", delimiter);
  try {
    return Bun.which(name, { PATH: path });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // The Store alias stub raises EACCES from stat. It is not an interpreter.
    if (code === "EACCES" || code === "EPERM") return null;
    throw error;
  }
}

const PYTHON = pythonCommand(process.platform, windowsPython);
if (process.platform === "win32" && PYTHON === null) {
  console.log("skip: Python execution check: no real interpreter from `py -3`, `python`, or `python3` (WindowsApps aliases are not used)");
}

test("closed JSON inspection permits standard imports, local selectors and stdout formatting", () => {
  for (const source of [
    "import json, sys; print(json.dumps(json.load(sys.stdin), indent=2))",
    "import sys\nimport json\ndata = json.loads(sys.stdin.read())\nprint(data.get('groups', []))",
    "import sys,json; value=json.load(sys.stdin); print(len(value['groups']), json.dumps({'count': len(value.get('groups', []))}, sort_keys=True))",
    "import json,sys; data=json.load(sys.stdin); print(data.get('.pregate/preset.json'))",
  ]) {
    expect(inspect(source)).toBe(true);
    if (PYTHON === null) continue;
    const result = Bun.spawnSync([...PYTHON, "-I", "-c", source], { stdin: new TextEncoder().encode('{"groups":[]}'), stdout: "pipe", stderr: "pipe" });
    expect(result.exitCode).toBe(0);
  }
});

test("imports, aliases, writes, dynamic calls and unrecognized Python do not receive inspection admission", () => {
  for (const source of [
    "import os; os.system('touch src/a.ts')",
    "import sys,json; open('src/a.ts','w').write('x')",
    "import sys,json; print(json.load(sys.stdin)); exec('open(\"src/a.ts\",\"w\")')",
    "import sys,json; json=1; print(json)",
    "import sys as s; print(s.stdin.read())",
    "from json import load; print(load(sys.stdin))",
    "import sys,json; print(getattr(sys,'stdin'))",
    "import sys,json; print(json.load(sys.stdin).__class__)",
    "import sys,json; print(json.load(sys.stdin), file=open('src/a.ts','w'))",
    "import sys,json; print(json.dumps(json.load(sys.stdin), default=eval))",
    "import sys,json; print(__import__('os'))",
    "import sys,json; data=json.load(sys.stdin); print(data.pop('groups'))",
    "import sys,json; print(f'{open(\"src/a.ts\",\"w\")}')",
    "import sys,json; data=json.load(sys.stdin); for value in data: print(value)",
    "import sys,json; print(data)",
    "print(TrueSomething)",
    "print(FalseThing)",
    "print(NoneThing)",
  ]) expect(inspect(source)).toBe(false);
  expect(pythonInspection(["-c", "print(1)"].map(text => ({ text, literal: true })))).toBe(false);
  expect(pythonInspection(["-I", "-c", "print(1)", "src/a.ts"].map(text => ({ text, literal: true })))).toBe(false);
  expect(pythonInspection(["-I", "-c", "print(1)"].map(text => ({ text, literal: false })))).toBe(false);
  expect(inspect("print(" + "[".repeat(40) + "1" + "]".repeat(40) + ")")).toBe(false);
});

const node = (source: string, flag = "-e") => nodeInspection([flag, source].map(text => ({ text, literal: true })));

test("closed node inspection permits JSON requires, member reads and printing", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-node-inspection-"));
  writeFileSync(join(dir, "package.json"), '{"version":"1.2.3","scripts":{"test":"x"}}');
  for (const [flag, source] of [
    ["-e", 'const a=require("./package.json");const b=require("./package.json");console.log(a.version,b["scripts"])'],
    ["-e", "console.log(JSON.stringify(Object.keys(require('./package.json').scripts), null, 2))"],
    ["-p", 'require("./package.json").version'],
    ["--eval", 'let p = require("./package.json"); console.log("v" + p.version, [p.version, {name: p.version}])'],
  ]) {
    expect(node(source!, flag)).toBe(true);
    expect(Bun.spawnSync(["node", flag!, source!], { cwd: dir, stdout: "pipe", stderr: "pipe" }).exitCode).toBe(0);
  }
  rmSync(dir, { recursive: true, force: true });
});

test("writes, execs, dynamic code and non-JSON requires do not receive node inspection admission", () => {
  for (const source of [
    'require("fs").writeFileSync("src/a.ts","x")',
    'require("fs")',
    'require("child_process").execSync("touch src/a.ts")',
    'require("./src/a.js")',
    'require("./package.json/../src/a.js")',
    'require("lodash.json")',
    'require("./a" + ".json")',
    'const x=require("./a.json");x.constructor.constructor("return process")()',
    'const x=require("./a.json");x["constructor"]["constructor"]("y")()',
    'console.log(process.env)',
    'process.chdir("src")',
    'Bun.write("src/a.ts","x")',
    'import("./src/a.js")',
    'eval("1")',
    'globalThis["eval"]("1")',
    'const require=1',
    'const console=1',
    'JSON.parse("{}")',
    'console.log(`${1}`)',
    'console.log("\\x41")',
    'console.log(require("./a.json"))\nrequire("fs").writeFileSync("src/a.ts","x")',
    'x => x',
    'a.b = 1',
  ]) expect(node(source)).toBe(false);
  expect(nodeInspection(["-e", "console.log(1)", "src/a.ts"].map(text => ({ text, literal: true })))).toBe(false);
  expect(nodeInspection(["-e", "console.log(1)"].map(text => ({ text, literal: false })))).toBe(false);
  expect(nodeInspection(["-r", "console.log(1)"].map(text => ({ text, literal: true })))).toBe(false);
  expect(node("console.log(" + "(".repeat(40) + "1" + ")".repeat(40) + ")")).toBe(false);
});
