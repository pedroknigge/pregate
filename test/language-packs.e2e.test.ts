import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { ENGINE_FILE } from "../src/platform.ts";

setDefaultTimeout(60_000);
const area = mkdtempSync(join(tmpdir(), "pregate-language-packs-"));
const binary = join(area, "engine", "version", ENGINE_FILE);
const repo = join(import.meta.dir, "..");
beforeAll(() => compileBinary(hostTarget(), binary, true));
afterAll(() => rmSync(area, { recursive: true, force: true }));

function releasedCapture<T>(capture: string, descriptors: number[], body: () => T): T {
  try { return body(); } finally {
    for (const fd of descriptors) closeSync(fd);
    rmSync(capture, { recursive: true, force: true });
  }
}

function project(files: Record<string, string>) {
  const root = join(area, randomUUID());
  mkdirSync(root);
  const env = { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(root, "home"), XDG_DATA_HOME: join(root, "data"),
    XDG_STATE_HOME: join(root, "state"), CODEX_HOME: join(root, "codex"), GROK_HOME: join(root, "grok"),
    GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com" };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  for (const [path, text] of Object.entries(files)) put(path, text);
  const run = (args: string[], input?: string) => {
    // Use regular files to distinguish process completion from pipe capture on Windows.
    // Exit status and the same deadline still decide success; printed fixture rows cannot.
    const capture = mkdtempSync(join(area, "capture-")), descriptors: number[] = [];
    const opened = (name: string, flags: string) => {
      const fd = openSync(join(capture, name), flags);
      descriptors.push(fd);
      return fd;
    };
    return releasedCapture(capture, descriptors, () => {
      if (input !== undefined) writeFileSync(join(capture, "stdin"), input);
      const out = spawnSync(binary, args, { cwd: root, env,
        stdio: [input === undefined ? "ignore" : opened("stdin", "r"), opened("stdout", "w"), opened("stderr", "w")], timeout: 20000 });
      const text = readFileSync(join(capture, "stdout"), "utf8"), error = readFileSync(join(capture, "stderr"), "utf8");
      if (out.error || out.signal) throw new Error(`Candidate command ${JSON.stringify(args)} failed: ${out.error?.message ?? out.signal}\nstdout:\n${text}\nstderr:\n${error}`);
      return { code: out.status, text, error };
    });
  };
  const approve = (args: string[]) => {
    const preview = run(args);
    expect(preview.code).toBe(0);
    const digest = preview.text.match(/Digest: ([a-f0-9]{64})/)![1]!;
    const applied = run(["approve", "--yes", "--digest", digest]);
    expect(applied.code).toBe(0);
    return preview.text;
  };
  const request = (patch: unknown[]) => {
    put(".pregate/requests/test.json", JSON.stringify({ why: "Test an explicitly reviewed policy.", patch }));
    const out = run(["preset", "apply", ".pregate/requests/test.json", "--yes"]);
    expect(out.code).toBe(0);
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20000 });
    if (out.signalCode) throw new Error(`Fixture git ${JSON.stringify(args)} terminated: ${out.signalCode}; ${out.stderr.toString()}`);
    expect(out.exitCode).toBe(0);
    return out.stdout.toString().trim();
  };
  const hook = (event: string, sid: string, fields: object = {}) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: event,
    permission_mode: "acceptEdits", prompt_id: "turn", ...fields,
  }));
  return { root, put, run, approve, request, git, hook };
}

test("the compiled library is discoverable and its fixtures run offline before initialization", () => {
  const p = project({});
  for (const flag of ["--help", "-h"]) {
    const help = p.run([flag]);
    expect(help.code).toBe(0);
    expect(help.text).toContain("--category invariants|language|pattern|library|practice|process");
    expect(help.text).toContain("pregate audit");
  }
  expect(p.run(["--help", "--json"]).code).toBe(1);
  const listed = p.run(["pack", "list", "--library", "--json"]);
  expect(listed.code).toBe(0);
  const packs = JSON.parse(listed.text).packs;
  expect(packs).toHaveLength(48);
  // The binary must embed every check authored under packs/, pack by pack.
  const authored: Record<string, number> = {};
  for (const path of new Bun.Glob("*/checks/*/*/check.json").scanSync(join(repo, "packs"))) {
    const ns = path.split(/[\\/]/)[0]!;
    authored[ns] = (authored[ns] ?? 0) + 1;
  }
  expect(Object.fromEntries(packs.map((pack: { ns: string; checks: number }) => [pack.ns, pack.checks]))).toEqual(authored);
  const documented = /(\d+) optional packs; (\d+) distinct check IDs/.exec(readFileSync(join(repo, "docs/packs.md"), "utf8"))!;
  expect([packs.length, Object.values(authored).reduce((n, c) => n + c, 0)]).toEqual([Number(documented[1]), Number(documented[2])]);
  expect(packs.find((pack: { ns: string }) => pack.ns === "maintainability")).toMatchObject({ checks: 209, source: { version: "1.2.0" } });
  expect(packs.find((pack: { ns: string }) => pack.ns === "pstack")).toMatchObject({ checks: 97, source: { version: "1.1.1" } });
  expect(packs.find((pack: { ns: string }) => pack.ns === "mattpocock")).toMatchObject({ checks: 7, source: { version: "1.1.1" } });
  const languages = p.run(["pack", "list", "--library", "--category", "language", "--json"]);
  expect(languages.code).toBe(0);
  expect(JSON.parse(languages.text).packs.map((pack: { ns: string }) => pack.ns)).toEqual(["go", "javascript", "python", "rust", "typescript"]);
  const processes = p.run(["pack", "list", "--library", "--category", "process", "--json"]);
  expect(processes.code).toBe(0);
  expect(JSON.parse(processes.text).packs.map((pack: { ns: string }) => pack.ns)).toEqual(["musk", "pstack"]);
  expect(p.run(["pack", "list", "--library", "--category", "unknown"]).code).toBe(1);
  const shown = p.run(["pack", "show", "--library", "python/quality", "--json"]);
  expect(shown.code).toBe(0);
  expect(JSON.parse(shown.text).packs[0]).toMatchObject({ ns: "python", languages: ["python"], source: { kind: "library", version: JSON.parse(readFileSync(join(repo, "packs/python/source.json"), "utf8")).version } });
  for (const ns of ["python", "go", "rust", "dcouplr", "mattpocock", "security-audit"]) expect(p.run(["rules", "test", "--library", ns]).code).toBe(0);
  expect(p.run(["pack", "add", "--library", "python", "--path", "."]).code).toBe(1);
  expect(p.run(["pack", "show", "--library", "missing"]).code).toBe(1);
  expect(existsSync(join(p.root, ".pregate"))).toBe(false);
});

test.each([
  ["python-starter", { "a.py": "def f(a, b, c, d, e): pass\n" }, ["python"], 1],
  ["go-starter", { "a.go": "package app\nfunc f(a, b, c, d, e int) {}\n" }, ["go"], 1],
  ["python-starter", { "pyproject.toml": "" }, ["python"], 0],
  ["go-starter", { "go.mod": "module example.com/app\n" }, ["go"], 0],
  ["mixed-starter", { "a.py": "def f(a, b, c, d, e): pass\n", "a.go": "package app\nfunc f(a, b, c, d, e int) {}\n", "a.ts": "export const a = 1;" }, ["python", "go", "clean-code"], 2],
] as const)("init recommends %s and approval preserves shadow debt inventory", (name, files, languages, count) => {
  const p = project(files);
  const preview = p.run(["init", "--preview"]);
  expect(preview.code).toBe(0);
  expect(preview.text).toContain("Recommended: " + name);
  expect(existsSync(join(p.root, ".pregate/preset.json"))).toBe(false);
  p.approve(["init", "--preview"]);
  const preset = JSON.parse(readFileSync(join(p.root, ".pregate/preset.json"), "utf8"));
  expect(preset.sources.filter((s: { kind: string }) => s.kind === "library").map((s: { ns: string }) => s.ns)).toEqual(languages);
  expect(preset.enforcement).toBe("shadow");
  expect(preset.methodologies.some((m: string) => /\/(architecture|effects)$/.test(m))).toBe(false);
  expect(p.run(["audit", "--json"]).code).toBe(0); // shadow debt and unbound requirements block nothing
  const audit = p.run(["audit", "--json", "--strict"]);
  expect(audit.code).toBe(2); // All core requirements apply even while language policy observes debt.
  const result = JSON.parse(audit.text);
  expect(result.fitness).toHaveLength(64);
  expect(result.fitness.every((r: { status: string }) => r.status === "unverified")).toBe(true);
  const lock = JSON.parse(readFileSync(join(p.root, ".pregate/pregate.lock.json"), "utf8"));
  expect(lock.rules.filter((r: { integrity: boolean }) => r.integrity)).toHaveLength(68);
  expect(lock.rules.filter((r: { integrity: boolean }) => r.integrity).every((r: { enforcement: string }) => r.enforcement === "enforce")).toBe(true);
  expect(result.summary.violations).toBe(count);
  expect(result.summary.shadow).toBe(count);
  expect(result.errors).toEqual([]);
  expect(result.uncovered).toEqual([]);
  expect(p.run(["rules", "test"]).code).toBe(0);
  expect(p.run(["disable", "--yes"]).code).toBe(0);
  expect(p.run(["init", "--yes"]).code).toBe(0);
  expect(p.run(["status"]).text).toContain("is inactive");
});

test("library addition selects no rules; selective enable, update and removal are reviewed", () => {
  const p = project({ "a.ts": "export const a = 1;", "a.py": "def f(a, b, c, d, e): pass\n", "notes.txt": "preserve me" });
  p.approve(["init", "--preview", "--preset", "legacy-safe"]);
  p.request([{ op: "add", path: "/scope", value: { include: ["**"], exclude: [] } }]);
  const before = readFileSync(join(p.root, ".pregate/preset.json"), "utf8");
  const proposed = p.run(["pack", "add", "--library", "python", "--preview"]);
  expect(proposed.code).toBe(0);
  expect(proposed.text).toMatch(/^Selected: python\/legacy, python\/quality\. Skipped: python\/architecture \(.*\); python\/effects \(/m);
  expect(readFileSync(join(p.root, ".pregate/preset.json"), "utf8")).toBe(before);
  p.approve(["pack", "add", "--library", "python", "--source-only", "--preview"]);
  expect(JSON.parse(p.run(["audit", "--json"]).text).uncovered).toContain("a.py");
  p.approve(["pack", "enable", "python/quality", "--only", "PY-FN-002", "--preview"]);
  const audit = JSON.parse(p.run(["audit", "--json"]).text);
  expect(audit.findings.map((f: { rule: string }) => f.rule)).toEqual(["python/PY-FN-002"]);
  p.approve(["pack", "update", "python", "--preview"]);
  expect(p.run(["pack", "add", "--library", "python", "--preview"]).code).toBe(1);
  p.approve(["pack", "remove", "python", "--preview"]);
  expect(JSON.parse(readFileSync(join(p.root, ".pregate/preset.json"), "utf8")).sources).toEqual(JSON.parse(before).sources);
  expect(readFileSync(join(p.root, "notes.txt"), "utf8")).toBe("preserve me");
});

test.each(["python", "go"])("%s policies freeze existing debt through stdin, Pre, Stop, index and base", (language) => {
  const path = language === "python" ? "a.py" : "a.go";
  const source = (n: number) => language === "python" ? "def f(" + ["a", "b", "c", "d", "e", "f"].slice(0, n).join(", ") + "): pass\n"
    : "package app\nfunc f(" + ["a", "b", "c", "d", "e", "f"].slice(0, n).join(", ") + " int) {}\n";
  const alias = language === "python" ? "PY-FN-002" : "GO-FN-002";
  const p = project({ [path]: source(5) });
  p.git("init", "-q");
  p.approve(["init", "--preview"]);
  p.approve(["pack", "disable", "core/software-invariants", "--preview"]); // Review an explicit override to isolate language backstops.
  p.request([{ op: "add", path: "/enforcement", value: "enforce" }]);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");
  const base = p.git("rev-parse", "HEAD");
  expect(p.run(["check", "--stdin", "--path", path], source(5)).code).toBe(0);
  expect(p.run(["check", "--stdin", "--path", path], source(6)).text).toContain(alias);
  const sid = randomUUID();
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);
  const denied = p.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: "write", tool_input: { file_path: join(p.root, path), content: source(6) } });
  expect(JSON.parse(denied.text).hookSpecificOutput.permissionDecision).toBe("deny");
  expect(denied.text).toContain(alias);
  p.put(path, source(6));
  const stop = p.hook("Stop", sid, { stop_hook_active: false, last_assistant_message: "done", background_tasks: [], session_crons: [] });
  expect(JSON.parse(stop.text).decision).toBe("block");
  expect(stop.text).toContain(alias);
  p.git("add", path);
  expect(p.run(["check", "--staged", "--ratchet"]).text).toContain(alias);
  expect(p.run(["check", "--ratchet", "--base", base]).text).toContain(alias);
});

test.each(["python", "go"])("%s dependency edits recheck unchanged importers through every backstop", (language) => {
  const python = language === "python";
  const changed = python ? "pkg/__init__.py" : "go.mod";
  const importer = python ? "pkg/core/a.py" : "internal/core/a.go";
  const original = python ? "" : "module example.com/app\nreplace example.com/lib => ./internal/core\n";
  const proposed = python ? "from .infra import DB\n" : "module example.com/app\nreplace example.com/lib => ./internal/infra\n";
  const files = python ? { [changed]: original, [importer]: "import pkg.core.model\n", "pkg/core/__init__.py": "", "pkg/core/model.py": "", "pkg/infra.py": "class DB: pass\n" }
    : { [changed]: original, [importer]: 'package core\nimport _ "example.com/lib"\n', "internal/infra/db.go": "package infra\n" };
  const p = project(files);
  p.git("init", "-q");
  p.approve(["init", "--preview"]);
  p.approve(["pack", "disable", "core/software-invariants", "--preview"]); // Core defaults are verified by the onboarding cases above.
  p.request([
    { op: "add", path: "/enforcement", value: "enforce" },
    { op: "add", path: "/layers", value: {
      core: { paths: [python ? "pkg/core/**" : "internal/core/**"], mayImport: [], kind: "core" },
      infra: { paths: [python ? "pkg/infra.py" : "internal/infra/**"], mayImport: [], kind: "adapter" },
    } },
  ]);
  p.approve(["pack", "enable", language + "/architecture", "--preview"]);
  p.git("add", "-A"); p.git("commit", "-qm", "baseline");
  const base = p.git("rev-parse", "HEAD");
  const alias = python ? "PY-LAYER-001" : "GO-LAYER-001";
  const stdin = p.run(["check", "--stdin", "--path", changed], proposed);
  expect(stdin.code).toBe(1);
  expect(stdin.text).toContain(importer);
  expect(stdin.text).toContain(alias);
  const sid = randomUUID();
  p.hook("SessionStart", sid, { source: "startup" });
  const pre = p.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: "dependency", tool_input: { file_path: join(p.root, changed), content: proposed } });
  expect(pre.code).toBe(2);
  expect(pre.text).toContain(importer);
  p.put(changed, proposed);
  const stop = p.hook("Stop", sid, { stop_hook_active: false, last_assistant_message: "done", background_tasks: [], session_crons: [] });
  expect(stop.code).toBe(2);
  expect(stop.text).toContain(importer);
  p.git("add", changed);
  for (const args of [["check", "--staged", "--ratchet"], ["check", "--ratchet", "--base", base]]) {
    const out = p.run(args);
    expect(out.code).toBe(1);
    expect(out.text).toContain(importer);
    expect(out.text).toContain(alias);
  }
});

test("mattpocock pass, fail and trap fixtures reach check and the Pre hook", () => {
  const p = project({ "src/keep.ts": "export const kept = 1;\n" });
  p.git("init", "-q");
  p.approve(["init", "--preview", "--preset", "integrity-only"]);
  p.approve(["pack", "add", "--library", "mattpocock", "--source-only", "--preview"]);
  for (const method of ["testing", "design", "diagnosis"]) p.approve(["pack", "enable", `mattpocock/${method}`, "--preview"]);
  p.request([{ op: "replace", path: "/enforcement", value: "enforce" }]);
  const shown = JSON.parse(p.run(["pack", "show", "mattpocock", "--json"]).text);
  expect(shown.packs[0].source.version).toBe("1.1.1");
  p.git("add", "-A");
  p.git("commit", "-qm", "contract");
  const sid = randomUUID();
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);
  const aliases = new Map<string, string>();
  for (const method of ["testing", "design", "diagnosis"]) {
    const manifest = JSON.parse(readFileSync(join(repo, "packs/mattpocock/methodologies", method + ".json"), "utf8"));
    for (const rule of manifest.invariants) aliases.set(rule.check, rule.id);
  }
  const counts = new Map<string, { pass: number; fail: number; trap: number }>();
  const fixtures = [...new Bun.Glob("mattpocock/checks/**/fixture.json").scanSync(join(repo, "packs"))].sort();
  expect(fixtures.length).toBeGreaterThan(0);
  for (const rel of fixtures) {
    const parts = rel.split(/[\\/]/);
    const at = parts.indexOf("fixtures");
    const kind = parts[at + 1] as "pass" | "fail" | "trap";
    const spec = JSON.parse(readFileSync(join(repo, "packs", rel), "utf8")) as { target: string; expect: { verdict: string } };
    const checkId = JSON.parse(readFileSync(join(repo, "packs", ...parts.slice(0, at), "check.json"), "utf8")).id as string;
    const short = aliases.get(checkId);
    if (short === undefined) throw new Error(`No alias for ${checkId}`);
    const alias = `mattpocock/${short}`;
    const content = readFileSync(join(repo, "packs", ...parts.slice(0, at + 3), "files", spec.target + ".fixture"), "utf8");
    const want = kind === "pass" ? "pass" : "fail";
    if (spec.expect.verdict !== want) throw new Error(`${rel} expects ${spec.expect.verdict}`);
    const checked = p.run(["check", "--stdin", "--path", spec.target], content);
    const warned = p.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: rel, tool_input: { file_path: join(p.root, spec.target), content } });
    const detail = `${rel}\ncheck ${checked.code}: ${checked.text}\nhook ${warned.code}: ${warned.text}\n${checked.error}${warned.error}`;
    if (kind === "pass") {
      expect(checked.code, detail).toBe(0);
      expect(checked.text, detail).not.toContain(alias);
      expect(warned.code, detail).toBe(0);
      expect(warned.text, detail).not.toContain(alias);
    } else {
      expect(checked.code, detail).toBe(0);
      expect(checked.text, detail).toContain(`PREGATE WARN ${alias}`);
      expect(warned.code, detail).toBe(0);
      const context = JSON.parse(warned.text).hookSpecificOutput.additionalContext as string;
      expect(context, detail).toContain(`PREGATE WARN ${alias}`);
    }
    const row = counts.get(checkId) ?? { pass: 0, fail: 0, trap: 0 };
    row[kind] += 1;
    counts.set(checkId, row);
  }
  expect([...counts.keys()].sort()).toEqual([
    "mattpocock/diagnostics/no-tagged-debug-log",
    "mattpocock/interfaces/fn-max-params",
    "mattpocock/tests/no-call-count-or-order",
    "mattpocock/tests/no-conditional-mock",
    "mattpocock/tests/no-internal-module-mock",
    "mattpocock/tests/no-self-equality",
    "mattpocock/types/no-enum",
  ]);
  for (const [check, row] of counts) {
    expect(row.pass, check).toBeGreaterThanOrEqual(2);
    expect(row.fail, check).toBeGreaterThanOrEqual(2);
    expect(row.trap, check).toBeGreaterThanOrEqual(1);
  }
}, 180_000);

test("TypeScript 7 hook and CLI catch module-keyword namespaces and import assertions", () => {
  const rates = "declare module \"rates\" {\n  export const currency: string;\n}\nimport rates from \"./rates.json\" with { type: \"json\" };\nexport const currency = rates;\n";
  const asserted = "import rates from \"./rates.json\" assert { type: \"json\" };\nexport const currency = rates;\n";
  const keyword = "module Billing {\n  export const currency = \"USD\";\n}\n";
  const namespace = "namespace Billing {\n  export const currency = \"USD\";\n}\n";
  const open = (typescript: string) => {
    const p = project({ "package.json": JSON.stringify({ devDependencies: { typescript } }), "src/rates.ts": rates });
    p.git("init", "-q");
    p.approve(["init", "--preview"]);
    p.approve(["pack", "disable", "core/software-invariants", "--preview"]);
    p.request([{ op: "add", path: "/enforcement", value: "enforce" }]);
    p.approve(["pack", "enable", "typescript/strict-types", "--only", "TS-NS-001,TS-MODKW-001", "--preview"]);
    p.approve(["pack", "enable", "typescript/legacy", "--only", "TS-ASSERT-001", "--preview"]);
    return p;
  };
  const current = open("7.0.2");
  const stdinAssert = current.run(["check", "--stdin", "--path", "src/rates.ts"], asserted);
  expect(stdinAssert.code).toBe(1);
  expect(stdinAssert.text).toContain("typescript/TS-ASSERT-001");
  expect(stdinAssert.text).toContain("with");
  const stdinModule = current.run(["check", "--stdin", "--path", "src/billing.ts"], keyword);
  expect(stdinModule.code).toBe(1);
  expect(stdinModule.text).toContain("typescript/TS-MODKW-001");
  expect(stdinModule.text).toContain("namespace");
  expect(stdinModule.text).not.toContain("typescript/TS-NS-001");
  const stdinNamespace = current.run(["check", "--stdin", "--path", "src/billing.ts"], namespace);
  expect(stdinNamespace.code).toBe(0);
  expect(stdinNamespace.text).toContain("typescript/TS-NS-001");
  expect(stdinNamespace.text).not.toContain("typescript/TS-MODKW-001");
  const stdinGood = current.run(["check", "--stdin", "--path", "src/rates.ts"], rates);
  expect(stdinGood.code).toBe(0);
  expect(stdinGood.text).not.toContain("typescript/TS-ASSERT-001");
  expect(stdinGood.text).not.toContain("typescript/TS-NS-001");
  const sid = randomUUID();
  expect(current.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);
  const denied = current.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: "assert", tool_input: { file_path: join(current.root, "src/rates.ts"), content: asserted } });
  expect(denied.code).toBe(2);
  expect(denied.text).toContain("typescript/TS-ASSERT-001");
  expect(denied.text).toContain("Write with instead");
  expect(denied.text).toContain("with { type:");
  const deniedModule = current.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: "module", tool_input: { file_path: join(current.root, "src/billing.ts"), content: keyword } });
  expect(deniedModule.code).toBe(2);
  expect(deniedModule.text).toContain("typescript/TS-MODKW-001");
  expect(deniedModule.text).toContain("namespace");
  const warnedNamespace = current.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: "namespace", tool_input: { file_path: join(current.root, "src/namespace.ts"), content: namespace } });
  expect(warnedNamespace.code).toBe(0);
  expect(warnedNamespace.text).toContain("typescript/TS-NS-001");
  expect(warnedNamespace.text).not.toContain("typescript/TS-MODKW-001");
  const allowed = current.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: "with", tool_input: { file_path: join(current.root, "src/rates.ts"), content: rates } });
  expect(allowed.code).toBe(0);
  expect(allowed.text).not.toContain("typescript/TS-ASSERT-001");
  expect(allowed.text).not.toContain("typescript/TS-NS-001");
  current.put("src/rates.ts", asserted);
  const stop = current.hook("Stop", sid, { stop_hook_active: false, last_assistant_message: "done", background_tasks: [], session_crons: [] });
  expect(stop.code).toBe(2);
  expect(stop.text).toContain("typescript/TS-ASSERT-001");
  const older = open("5.9.3");
  const legacy = older.run(["check", "--stdin", "--path", "src/rates.ts"], asserted);
  expect(legacy.code).toBe(0);
  expect(legacy.text).not.toContain("typescript/TS-ASSERT-001");
  const stillWarned = older.run(["check", "--stdin", "--path", "src/billing.ts"], keyword);
  expect(stillWarned.code).toBe(0);
  expect(stillWarned.text).toContain("typescript/TS-MODKW-001");
  expect(stillWarned.text).not.toContain("typescript/TS-NS-001");
  const olderNamespace = older.run(["check", "--stdin", "--path", "src/namespace.ts"], namespace);
  expect(olderNamespace.code).toBe(0);
  expect(olderNamespace.text).toContain("typescript/TS-NS-001");
  expect(olderNamespace.text).not.toContain("typescript/TS-MODKW-001");
  const olderSid = randomUUID();
  expect(older.hook("SessionStart", olderSid, { source: "startup" }).code).toBe(0);
  const olderHook = older.hook("PreToolUse", olderSid, { tool_name: "Write", tool_use_id: "old-assert", tool_input: { file_path: join(older.root, "src/rates.ts"), content: asserted } });
  expect(olderHook.code).toBe(0);
  expect(olderHook.text).not.toContain("typescript/TS-ASSERT-001");
  const olderModule = older.hook("PreToolUse", olderSid, { tool_name: "Write", tool_use_id: "old-module", tool_input: { file_path: join(older.root, "src/billing.ts"), content: keyword } });
  expect(olderModule.code).toBe(0);
  expect(olderModule.text).toContain("typescript/TS-MODKW-001");
});

test("python legacy denies a 3.15 removal only for that target and warns on a 3.16 removal", () => {
  const named = "from typing import NamedTuple\n\nPoint = NamedTuple(\"Point\", x=int, y=int)\n";
  const later = "import asyncio\n\ndef run(fn):\n    return asyncio.iscoroutinefunction(fn)\n";
  const p = project({
    "pyproject.toml": "[project]\nname = \"app\"\nrequires-python = \">=3.15\"\n",
    "src/a.py": "x = 1\n",
  });
  p.git("init", "-q");
  p.approve(["init", "--preview"]);
  p.approve(["pack", "disable", "core/software-invariants", "--preview"]);
  p.approve(["pack", "enable", "python/legacy", "--preview"]);
  p.request([{ op: "add", path: "/enforcement", value: "enforce" }]);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");
  const denied = p.run(["check", "--stdin", "--path", "src/a.py"], named);
  expect(denied.code).toBe(1);
  expect(denied.text).toContain("PY-315-NT-001");
  expect(denied.text).toContain("class Point(NamedTuple)");
  const sid = randomUUID();
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);
  const hookDenied = p.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: "nt", tool_input: { file_path: join(p.root, "src/a.py"), content: named } });
  expect(hookDenied.code).toBe(2);
  expect(JSON.parse(hookDenied.text).hookSpecificOutput.permissionDecision).toBe("deny");
  expect(hookDenied.text).toContain("PY-315-NT-001");
  expect(hookDenied.text).toContain("NamedTuple(\\\"Point\\\", [(\\\"x\\\", int)])");
  p.put("pyproject.toml", "[project]\nname = \"app\"\nrequires-python = \">=3.12\"\n");
  const older = p.run(["check", "--stdin", "--path", "src/a.py"], named);
  expect(older.code).toBe(0);
  expect(older.text).not.toContain("PY-315-NT-001");
  const hookOlder = p.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: "old", tool_input: { file_path: join(p.root, "src/a.py"), content: named } });
  expect(hookOlder.code).toBe(0);
  expect(hookOlder.text).not.toContain("PY-315-NT-001");
  p.put("pyproject.toml", "[project]\nname = \"app\"\nrequires-python = \">=3.15\"\n");
  const warned = p.run(["check", "--stdin", "--path", "src/a.py"], later);
  expect(warned.code).toBe(0);
  expect(warned.text).toContain("PY-316-ASYNC-001");
  expect(warned.text).toContain("inspect.iscoroutinefunction");
  const hookWarn = p.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: "warn", tool_input: { file_path: join(p.root, "src/a.py"), content: later } });
  expect(hookWarn.code).toBe(0);
  expect(hookWarn.text).toContain("PY-316-ASYNC-001");
  expect(hookWarn.text).not.toContain("\"permissionDecision\": \"deny\"");
  p.put("pyproject.toml", "[project]\nname = \"app\"\nrequires-python = \">=3.16\"\n");
  const future = p.run(["check", "--stdin", "--path", "src/a.py"], later);
  expect(future.code).toBe(1);
  expect(future.text).toContain("PY-316-ASYNC-001");
  const hookFuture = p.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: "future", tool_input: { file_path: join(p.root, "src/a.py"), content: later } });
  expect(hookFuture.code).toBe(2);
  expect(JSON.parse(hookFuture.text).hookSpecificOutput.permissionDecision).toBe("deny");
  p.put("pyproject.toml", "# application metadata without a Python floor\n");
  p.put("setup.cfg", "[options]\npython_requires = >=3.15\n");
  const cgi = p.run(["check", "--stdin", "--path", "src/a.py"], "from http.server import CGIHTTPRequestHandler\n");
  expect(cgi.code).toBe(1);
  expect(cgi.text).toContain("PY-315-CGI-001");
  expect(cgi.text).toContain("BaseHTTPRequestHandler");
});
