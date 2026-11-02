import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { ENGINE_FILE } from "../src/platform.ts";

// `rules draft` turns a correction into a check whose fixtures are the corrected files.
setDefaultTimeout(60_000);

const area = mkdtempSync(join(tmpdir(), "pregate-draft-"));
const binary = join(area, ENGINE_FILE);
beforeAll(() => compileBinary(hostTarget(), binary, true), 120_000);
afterAll(() => rmSync(area, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

const PATTERN = { rule: { kind: "call_expression", has: { field: "function", regex: "^(window\\.|globalThis\\.)?fetch$" } } };
const SOURCES: Record<string, string> = {
  "src/bad.ts": "export async function load(id: string) {\n  const r = await fetch(`/api/${id}`);\n  return r.json();\n}\n",
  "src/good.ts": "import { api } from \"./api\";\nexport async function load(id: string) {\n  return api.get(`/api/${id}`);\n}\n",
  "src/bad2.ts": "export const ping = () => fetch(\"/health\");\n",
  "src/good2.ts": "export const ping = () => api.get(\"/health\");\n",
  "src/trap.ts": "export const x = () => window.fetch(\"/x\");\n",
  "pattern.json": JSON.stringify(PATTERN),
};
const START = ["--pattern", "pattern.json", "--message", "{symbol} calls fetch directly; use the api client.",
  "--why", "The api client owns auth, retries and timeouts.", "--fix", "Call api.get or api.post from src/api."];

function project(name: string) {
  const root = join(area, name);
  for (const [rel, text] of Object.entries(SOURCES)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  const machine = join(area, `${name}-machine`);
  const env = { ...process.env, HOME: join(machine, "home"), CODEX_HOME: join(machine, "codex"), GROK_HOME: join(machine, "grok"),
    XDG_DATA_HOME: join(machine, "data"), XDG_STATE_HOME: join(machine, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" };
  const cli = (...args: string[]) => {
    const result = Bun.spawnSync([binary, ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    return { code: result.exitCode, text: result.stdout.toString() + result.stderr.toString() };
  };
  return { root, cli };
}

test("a correction grows into a complete check, then activates only through the reviewed pack path", () => {
  const p = project("loop");
  const first = p.cli("rules", "draft", "rules/team", "net/no-raw-fetch", ...START, "--fail", "src/bad.ts", "--pass", "src/good.ts");
  expect(first).toMatchObject({ code: 0 });
  expect(first.text).toContain("Draft incomplete");
  expect(first.text).toContain("needs at least 2 fail fixtures, has 1");
  const fixture = JSON.parse(readFileSync(join(p.root, "rules/team/checks/net/no-raw-fetch/fixtures/fail/bad/fixture.json"), "utf8"));
  expect(fixture).toEqual({ language: "typescript", params: {}, target: "src/bad.ts", before: null, expect: { verdict: "fail", violations: [{ line: 2 }] } });
  expect(readFileSync(join(p.root, "rules/team/checks/net/no-raw-fetch/fixtures/pass/good/files/src/good.ts.fixture"), "utf8")).toBe(SOURCES["src/good.ts"]!);
  const methodology = JSON.parse(readFileSync(join(p.root, "rules/team/methodologies/corrections.json"), "utf8"));
  expect(methodology.id).toBe("team/corrections");
  expect(methodology.invariants.map((a: { id: string; check: string }) => [a.id, a.check])).toEqual([["TEAM-NO-RAW-FETCH", "team/net/no-raw-fetch"]]);

  expect(p.cli("rules", "draft", "rules/team", "net/no-raw-fetch", "--fail", "src/bad2.ts", "--pass", "src/good2.ts").text).toContain("needs at least 1 trap fixtures, has 0");
  const done = p.cli("rules", "draft", "rules/team", "net/no-raw-fetch", "--trap", "src/trap.ts", "--trap-note", "window.fetch is the same raw call.");
  expect(done.code).toBe(0);
  expect(done.text).toContain("Draft complete. Activate it for human review with: pregate pack add --path");
  expect(p.cli("rules", "test", "rules/team")).toMatchObject({ code: 0 });

  expect(p.cli("init", "--yes", "--preset", "integrity-only").code).toBe(0);
  expect(p.cli("pack", "add", "--path", "rules/team", "--yes").code).toBe(0);
  const lock = readFileSync(join(p.root, ".pregate/pregate.lock.json"), "utf8");
  const partial = p.cli("rules", "draft", "rules/team", "net/window-fetch", ...START, "--fail", "src/bad.ts");
  expect(partial.code).toBe(1);
  expect(partial.text).toContain("is an active rule source, so it changes in one reviewed update");
  expect(existsSync(join(p.root, "rules/team/checks/net/window-fetch"))).toBe(false);
  const staged = p.cli("rules", "draft", "rules/team", "net/window-fetch", ...START, "--fail", "src/bad.ts", "--fail", "src/bad2.ts",
    "--pass", "src/good.ts", "--pass", "src/good2.ts", "--trap", "src/trap.ts", "--trap-note", "window.fetch is the same raw call.");
  expect(staged.code).toBe(0);
  expect(staged.text).toContain("Draft team/net/window-fetch is complete and staged as one update to the active pack.");
  expect(staged.text).toContain("Local consent is preserved");
  expect(staged.text).toMatch(/Digest: [0-9a-f]{64}/);
  expect(existsSync(join(p.root, "rules/team/checks/net/window-fetch"))).toBe(false);
  expect(readFileSync(join(p.root, ".pregate/pregate.lock.json"), "utf8")).toBe(lock);
  expect(p.cli("approve", "--preview").text).toContain(staged.text.match(/Digest: [0-9a-f]{64}/)![0]);
});

test("the corrected code must pass and the rejected code must fail before anything is written", () => {
  const p = project("proof");
  const flagsGood = p.cli("rules", "draft", "rules/team", "net/no-raw-fetch", ...START, "--fail", "src/bad.ts", "--pass", "src/bad2.ts");
  expect(flagsGood).toEqual({ code: 1, text: "The pattern reports line 1 in the corrected code src/bad2.ts; narrow it.\n" });
  expect(existsSync(join(p.root, "rules/team"))).toBe(false);
  const missesBad = p.cli("rules", "draft", "rules/team", "net/no-raw-fetch", ...START, "--fail", "src/good.ts");
  expect(missesBad).toEqual({ code: 1, text: "The pattern does not catch src/good.ts; widen it until it reports the bad code.\n" });
  expect(existsSync(join(p.root, "rules/team"))).toBe(false);
});

test("a draft never edits enforced policy and never restarts an existing check", () => {
  const p = project("refusals");
  const protectedDir = p.cli("rules", "draft", ".pregate/packs/team", "net/no-raw-fetch", ...START, "--fail", "src/bad.ts");
  expect(protectedDir.code).toBe(1);
  expect(protectedDir.text).toContain("is protected policy, not a whole rule source");
  expect(p.cli("rules", "draft", "rules/team", "net/no-raw-fetch", ...START, "--fail", "src/bad.ts").code).toBe(0);
  expect(p.cli("rules", "draft", "rules/team", "net/no-raw-fetch", ...START, "--fail", "src/bad2.ts"))
    .toEqual({ code: 1, text: "team/net/no-raw-fetch already exists; omit --pattern to add cases to it.\n" });
  expect(p.cli("rules", "draft", "rules/team", "net/no-raw-fetch").code).toBe(1);
  expect(p.cli("rules", "draft", "rules/team", "missing/check", "--fail", "src/bad.ts").text).toContain("No check team/missing/check");
  expect(p.cli("rules", "draft", "rules/team", "net/no-raw-fetch", "--trap", "src/trap.ts").code).toBe(1);
});

test("rules draft automatically synthesizes a distinguishing AST pattern across languages when --pattern is auto or omitted", () => {
  const p = project("synth");
  writeFileSync(join(p.root, "src/bad1.py"), "def run(raw):\n    return eval(raw)\n");
  writeFileSync(join(p.root, "src/bad2.py"), "def parse(text):\n    return eval(text)\n");
  writeFileSync(join(p.root, "src/good1.py"), "import json\ndef run(raw):\n    return json.loads(raw)\n");
  writeFileSync(join(p.root, "src/good2.py"), "import json\ndef parse(text):\n    return json.loads(text)\n");
  writeFileSync(join(p.root, "src/trap.py"), "def sneaky(x):\n    return (eval(x))\n");
  const drafted = p.cli("rules", "draft", "rules/pysec", "security/no-eval",
    "--pattern", "auto", "--message", "{symbol} calls eval directly.",
    "--why", "eval executes arbitrary code.", "--fix", "Use json.loads or ast.literal_eval.",
    "--fail", "src/bad1.py", "--fail", "src/bad2.py",
    "--pass", "src/good1.py", "--pass", "src/good2.py",
    "--trap", "src/trap.py", "--trap-note", "Parenthesized eval is still dynamic execution.");
  expect(drafted.code, drafted.text).toBe(0);
  expect(drafted.text).toContain("Draft complete.");
  expect(p.cli("rules", "test", "rules/pysec")).toMatchObject({ code: 0 });
});

test("auto synthesis names the call across fails and traps instead of the literal line, and --files places fixtures in scope", () => {
  const p = project("general");
  writeFileSync(join(p.root, "src/orders.ts"), "fetch(\"/orders\");\n");
  writeFileSync(join(p.root, "src/load.ts"), "loadOrders();\n");
  writeFileSync(join(p.root, "src/prefetch.ts"), "prefetch();\n");
  writeFileSync(join(p.root, "src/window.ts"), "window.fetch(\"/x\");\n");
  const drafted = p.cli("rules", "draft", "rules/ui", "ui/no-fetch", "--message", "{symbol} calls fetch directly.", "--why", "The api client owns retries.",
    "--fix", "Call api.get.", "--files", "src/components/**", "--fail", "src/orders.ts", "--fail", "src/bad2.ts", "--pass", "src/load.ts", "--pass", "src/prefetch.ts",
    "--trap", "src/window.ts", "--trap-note", "window.fetch is the same call.");
  expect(drafted.code, drafted.text).toBe(0);
  expect(drafted.text).toContain('Pattern: {"kind":"call_expression","has":{"field":"function","regex":"(^|\\\\.)fetch$"}}');
  expect(drafted.text).toContain("Draft complete.");
  const check = JSON.parse(readFileSync(join(p.root, "rules/ui/checks/ui/no-fetch/check.json"), "utf8"));
  expect(check.impl.patterns.typescript[0].files).toEqual(["src/components/**"]);
  const fixture = JSON.parse(readFileSync(join(p.root, "rules/ui/checks/ui/no-fetch/fixtures/fail/orders/fixture.json"), "utf8"));
  expect(fixture.target).toBe("src/components/orders.ts");
  expect(p.cli("rules", "test", "rules/ui")).toMatchObject({ code: 0 });
});

function repo(name: string) {
  const p = project(name);
  const identity = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
  const git = (...args: string[]) => Bun.spawnSync(["git", ...args], { cwd: p.root, stdout: "pipe", stderr: "pipe", env: { ...process.env, ...identity } }).stdout.toString().trim();
  for (const [rel, text] of Object.entries({ "src/domain/order.ts": "export const order = 1;\n", "src/infra/db.ts": "export const db = 1;\n", "src/components/button.ts": "export const Button = () => 1;\n" })) {
    mkdirSync(dirname(join(p.root, rel)), { recursive: true });
    writeFileSync(join(p.root, rel), text);
  }
  git("init", "-q");
  // The product commits with the repo's identity. The helper's env does not reach that process,
  // and this fixture's HOME is an empty directory.
  git("config", "user.name", "t");
  git("config", "user.email", "t@example.com");
  git("config", "commit.gpgsign", "false");
  expect(p.cli("init", "--yes", "--preset", "integrity-only").code).toBe(0);
  git("add", "-A"); git("commit", "-qm", "base");
  const approve = (review: string) => p.cli("approve", "--yes", "--digest", review.match(/Digest: ([0-9a-f]{64})/)![1]!);
  const contract = () => [".pregate/preset.json", ".pregate/pregate.lock.json"].map((rel) => readFileSync(join(p.root, rel), "utf8"));
  return { ...p, git, approve, contract };
}

test("rules add selects a bundled catalog rule that says the sentence, in one review with a stable code", () => {
  const p = repo("add-catalog");
  const before = p.contract();
  const first = p.cli("rules", "add", "domain must not import infra");
  expect(first.code, first.text).toBe(0);
  expect(first.text).toContain("Matched catalog rule architecture/HEX-EDGE-001 (architecture/hexagonal)");
  expect(p.contract()).toEqual(before);
  const again = p.cli("rules", "add", "domain must not import infra");
  expect(again.text.match(/Digest: [0-9a-f]{64}/)![0]).toBe(first.text.match(/Digest: [0-9a-f]{64}/)![0]);
  expect(again.text).not.toContain("replaces the earlier pending proposal");
  expect(p.approve(first.text).code).toBe(0);
  const lock = JSON.parse(p.contract()[1]!);
  expect(lock.rules.filter((r: { id: string }) => r.id.startsWith("architecture/")).map((r: { id: string }) => r.id)).toEqual(["architecture/HEX-EDGE-001"]);
  expect(p.cli("rules", "add", "domain must not import infra")).toMatchObject({ code: 0, text: expect.stringContaining("Already enforced by architecture/HEX-EDGE-001") });
  expect(p.cli("rules", "add", "domain must not import infra", "--yes").code).toBe(1);
});

test("rules add drafts a project rule with generated fixtures; approval writes and commits the pack", () => {
  const p = repo("add-draft");
  const drafted = p.cli("rules", "add", "UI components must not call fetch");
  expect(drafted.code, drafted.text).toBe(0);
  expect(drafted.text).toContain("drafted project rule project/calls/ui-component-call-fetch in .pregate/packs/project");
  expect(existsSync(join(p.root, ".pregate/packs/project"))).toBe(false);
  const applied = p.approve(drafted.text);
  expect(applied.code, applied.text).toBe(0);
  expect(applied.text).toMatch(/Committed \d+ files \(\.pregate\/packs\/project\/, \.pregate\/\) as [0-9a-f]+\./);
  expect(p.cli("rules", "test", ".pregate/packs/project")).toMatchObject({ code: 0 });
  expect(JSON.parse(p.contract()[1]!).rules.some((r: { id: string }) => r.id === "project/PROJECT-UI-COMPONENT-CALL-FETCH")).toBe(true);
  expect(p.git("show", "--name-only", "--format=", "HEAD")).toContain(".pregate/packs/project/checks/calls/ui-component-call-fetch/check.json");
  expect(p.git("status", "--porcelain")).toBe("");
  const vague = p.cli("rules", "add", "keep things tidy");
  expect(vague.code).toBe(1);
  expect(vague.text).toContain('add --fail "<bad code>" and --pass "<good code>"');
  const snippet = p.cli("rules", "add", "no moment", "--fail", 'import moment from "moment"; moment();', "--pass", "export const t = Date.now();");
  expect(snippet.code, snippet.text).toBe(0);
  expect(snippet.text).toContain("drafted project rule project/rules/moment");
  expect(snippet.text).toContain('Pattern: {"kind":"string_fragment","regex":"^moment(/|$)"');
  expect(snippet.text).toContain("fixtures/trap/nested/fixture.json");
  expect(snippet.text).toContain("fixtures/pass/pass-2/fixture.json");
  const edge = p.cli("rules", "add", "domain must not import infra", "--draft");
  expect(edge.code, edge.text).toBe(0);
  expect(edge.text).toContain("drafted project rule project/imports/domain-import-infra");
  expect(edge.text).toContain('"**/domain/**"');
});

