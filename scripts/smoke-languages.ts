// Run after bun run scripts/build.ts: validates a temporary mixed-language pack against the native distribution.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { compile } from "../src/compile.ts";
import { canonical } from "../src/disk.ts";
import { sourcesOf, VERSIONS } from "../src/gate.ts";

import { hostTarget } from "./build.ts";
import { applyReviewedProposal } from "../src/approval-command.ts";
import { librarySources } from "../src/library.ts";
import { smokeBinary } from "./smoke-binary.ts";
import { confirmOnTerminal } from "./confirm-terminal.ts";
import { runNative } from "./smoke-native-command.ts";

const area = mkdtempSync(join(tmpdir(), "pregate-language-native-"));
const binary = smokeBinary();
const root = join(area, "repo");
function put(rel: string, text: string) {
  const file = join(root, rel); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text);
}
function json(rel: string, value: unknown) { put(rel, JSON.stringify(value, null, 2) + "\n"); }
function run(args: string[], stdin?: string, cwd = root) {
  return runNative({ binary, args, cwd, stdin,
    env: { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state") } });
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
function git(args: string[]): void {
  const result = spawnSync("git", ["-c", "user.name=Pregate Smoke", "-c", "user.email=smoke@example.com", "-c", "commit.gpgsign=false", ...args], {
    cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"],
  });
  assert(result.status === 0, `git ${args.join(" ")} failed: ${result.stderr?.toString() ?? ""}`);
}

// init --preview runs with CI set so its digest is printed. Applying that review does not.
// A bare `approve` still asks for y on a terminal. POSIX declines that prompt, which applies
// nothing, then `approve <digest>` applies the same review with no terminal. Windows has no
// /dev/tty, so the starter contract is applied by the same in-process function the CLI calls
// after a confirmation. That function is not a CLI flag.
async function acceptStarter(binary: string, starter: string, digest: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  if (process.platform === "win32") {
    const previous = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = join(area, "data");
    try {
      const applied = await applyReviewedProposal(canonical(starter), digest, { activate: true, commit: true });
      return { exitCode: applied.code, stdout: applied.text, stderr: "" };
    } finally {
      if (previous === undefined) delete process.env.XDG_DATA_HOME;
      else process.env.XDG_DATA_HOME = previous;
    }
  }
  const env: Record<string, string | undefined> = {
    ...process.env, HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"),
  };
  delete env.CI; delete env.PREGATE_UNATTENDED_APPROVAL; delete env.PREGATE_TESTING; delete env.PREGATE_TEST_ANSWER;
  const declined = confirmOnTerminal([binary, "approve"], starter, env, "n");
  assert(declined.code !== 0 && declined.stdout.includes("Approve?") && !declined.stdout.includes("Approved contract applied"),
    `a bare approve must still ask, and a decline must apply nothing:\n${declined.stdout}${declined.stderr}`);
  const child: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) if (value !== undefined) child[key] = value;
  const accepted = runNative({ binary, args: ["approve", digest], cwd: starter, env: child, stdin: "" });
  return { exitCode: accepted.exitCode ?? 1, stdout: accepted.stdout.toString(), stderr: accepted.stderr.toString() };
}
try {
  mkdirSync(root, { recursive: true });
  const library = run(["pack", "list", "--library", "--json"]);
  const bundled = JSON.parse(library.stdout.toString()).packs.map((p: { ns: string }) => p.ns).sort();
  assert(library.exitCode === 0 && JSON.stringify(bundled) === JSON.stringify(librarySources().map((s) => s.ns).sort()), "Bundled library missing or unexpected");
  for (const ns of ["python", "go"]) {
    const fixtures = run(["rules", "test", "--library", ns]);
    assert(fixtures.exitCode === 0, fixtures.stdout.toString() + fixtures.stderr.toString());
  }
  const pack = ".pregate/packs/demo/";
  json(pack + "source.json", { ns: "languages-demo", version: "1.0.0" });
  const check = { id: "languages-demo/quality/params", version: "1.0.0", area: "quality",
    cardinality: "singleton", dimension: "fn.params", minSeverity: null, languages: ["python", "go"],
    params: { max: { type: "integer", minimum: 0 } }, impl: { kind: "primitive", primitive: "metric", metric: "fn.params" },
    phase: ["pre", "stop", "commit", "ci"], feedback: { message: "{symbol} exceeds {limit} parameters." } };
  json(pack + "checks/quality/params/check.json", check);
  json(pack + "methodologies/quality.json", { id: "languages-demo/quality", version: "1.0.0", status: "complete", conflicts: [],
    invariants: [{ id: "LANG-PARAM-001", check: check.id, defaults: { max: 1 }, severity: "deny",
      source: { work: "Local smoke policy", locator: "revision 1", paraphrase: "At most one parameter." },
      why: "Demonstrate explicit cross-language policy.", fixHint: "Review the function interface.", avoid: "Do not discard inputs.",
      examples: { pass: "pass/python-small", fail: "fail/python-wide" } }] });
  for (const language of ["python", "go"]) for (const [name, n] of [["pass/small", 1], ["pass/empty", 0], ["fail/wide", 2], ["fail/wider", 3], ["trap/closure", 2]] as const) {
    const target = language === "python" ? "a.py" : "a.go";
    const params = ["a", "b", "c"].slice(0, n).join(", ");
    const closure = name.startsWith("trap/");
    const source = language === "python" ? (closure ? "handler = lambda " + params + ": 1\n" : "def f(" + params + "): pass\n")
      : "package app\n" + (closure ? "var handler = func(" + params + " int) {}\n" : "func f(" + (n ? params + " int" : "") + ") {}\n");
    const folder = name.split("/")[0] + "/" + language + "-" + name.split("/")[1];
    const dir = pack + "checks/quality/params/fixtures/" + folder + "/";
    json(dir + "fixture.json", { language, target, before: null, params: { max: 1 },
      expect: { verdict: n > 1 ? "fail" : "pass", ...(n > 1 ? { violations: [{ line: language === "python" ? 1 : 2, measured: n }] } : {}) },
      ...(closure ? { trap: { family: "closure", origin: "forge", discovered: "2026-10-03", note: "Closures are functions too." } } : {}) });
    put(dir + "files/" + target, source);
  }
  const preset = { name: "mixed", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "languages-demo", kind: "path", path: ".pregate/packs/demo" }],
    methodologies: ["languages-demo/quality"], scope: { include: ["src/**"], exclude: [] } };
  json(".pregate/preset.json", preset);
  const compiled = compile(readFileSync(join(root, ".pregate/preset.json"), "utf8"), sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  put(".pregate/pregate.lock.json", compiled.text);
  put("src/a.py", "def f(a, b): pass\n");
  put("src/a.go", "package app\nfunc f(a, b int) {}\n");
  put("src/a.ts", "function f(a, b, c) {}\n");
  const admission = run(["rules", "test", pack]);
  assert(admission.exitCode === 0, admission.stdout.toString() + admission.stderr.toString());
  const audit = run(["audit", "--json", "--strict"]); // --strict: unverified requirements keep exit 2
  const data = JSON.parse(audit.stdout.toString());
  assert(audit.exitCode === 2 && data.summary.violations === 2 && data.fitness.length === 64, audit.stdout.toString());
  assert(data.fitness.every((r: { status: string }) => r.status === "unverified"), "Missing core verification must remain incomplete");
  assert(data.uncovered.length === 0 && data.errors.length === 0, "Coverage incomplete");
  assert(data.findings.every((v: { path: string }) => !v.path.endsWith(".ts")), "Foreign policy leaked into TS");
  // stdin compares with HEAD. Commit the two-parameter sources first so growth is a real diff.
  git(["init", "-q", "-b", "main"]);
  git(["add", "-A"]);
  git(["commit", "-qm", "smoke baseline"]);
  for (const [path, source] of [["src/a.py", "def f(a, b, c): pass\n"], ["src/a.go", "package app\nfunc f(a, b, c int) {}\n"]]) {
    const growth = run(["check", "--stdin", "--path", path!], source);
    assert(growth.exitCode === 1 && growth.stdout.toString().includes("LANG-PARAM-001"), growth.stdout.toString() + growth.stderr.toString());
  }
  const syntax = run(["check", "--stdin", "--path", "src/a.py"], "def broken(:\n");
  assert(syntax.exitCode === 1 && syntax.stdout.toString().includes("syntax"), syntax.stdout.toString());
  const starter = join(area, "starter");
  mkdirSync(starter);
  writeFileSync(join(starter, "a.py"), "def f(a, b, c, d, e): pass\n");
  writeFileSync(join(starter, "a.go"), "package app\nfunc f(a, b, c, d, e int) {}\n");
  const preview = run(["init", "--preview"], undefined, starter);
  assert(preview.exitCode === 0 && preview.stdout.toString().includes("Recommended: mixed-starter"), preview.stdout.toString());
  const digest = /Digest: ([a-f0-9]{64})/.exec(preview.stdout.toString())?.[1];
  assert(digest !== undefined, "Missing starter review digest");
  const accepted = await acceptStarter(binary, starter, digest!);
  assert(accepted.exitCode === 0, accepted.stdout + accepted.stderr);
  const debt = run(["audit", "--json", "--strict"], undefined, starter);
  const observed = JSON.parse(debt.stdout.toString());
  assert(debt.exitCode === 2 && observed.summary.violations === 2 && observed.summary.shadow === 2 && observed.fitness.length === 64, debt.stdout.toString());
  console.log(JSON.stringify({ bundledLibrary: `${bundled.length} packs; 65 Python/Go fixtures passed; mixed starter approved with 2 shadow findings`,
    fixtureAdmission: "10 mixed-language fixtures passed", audit: "2 static findings, 64 unverified core requirements explicitly reported",
    stdin: "Python/Go growth denied; Python syntax denied", tsPolicyLeak: false, target: "native " + hostTarget() }));
} finally { rmSync(area, { recursive: true, force: true }); }
