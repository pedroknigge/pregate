import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Issue 157: the compiled CLI is the gate an enabled repository runs. A plus inside a sql
// template parameter is a bound value. String-concatenated SQL and sql.raw stay denied.
setDefaultTimeout(120_000);
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-driz-raw-"));
afterAll(() => removeTree(area));

function project(name: string) {
  const root = join(area, name);
  const machine = join(area, "machine");
  mkdirSync(root, { recursive: true });
  const env = {
    ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    HOME: join(machine, "home"), USERPROFILE: join(machine, "home"),
    XDG_DATA_HOME: join(machine, "data"), XDG_STATE_HOME: join(machine, "state"), XDG_CONFIG_HOME: join(machine, "config"),
    CODEX_HOME: join(machine, "codex"), GROK_HOME: join(machine, "grok"),
    GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const out = Bun.spawnSync([cli, ...args], {
      cwd: root, env, stdin: input === undefined ? "ignore" : Buffer.from(input),
      stdout: "pipe", stderr: "pipe", timeout: 60_000,
    });
    if (out.signalCode) throw new Error(`${args.join(" ")} terminated: ${out.signalCode}\n${out.stderr.toString()}`);
    return { code: out.exitCode, text: out.stdout.toString() + out.stderr.toString() };
  };
  return { root, env, put, run };
}

const gate = project("gate");

beforeAll(() => {
  gate.put("package.json", '{ "name": "sample" }\n');
  gate.put("src/ok.ts", "export const ready = true;\n");
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], {
      cwd: gate.root, env: gate.env, stdout: "pipe", stderr: "pipe", timeout: 20_000,
    });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  git("init", "-q");
  expect(gate.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  expect(gate.run(["pack", "add", "--library", "drizzle", "--source-only", "--yes"]).code).toBe(0);
  expect(gate.run(["pack", "enable", "drizzle/queries", "--only", "DRIZ-RAW-001", "--yes"]).code).toBe(0);
  gate.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge DRIZ-RAW-001 in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const enforced = gate.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(enforced.code, enforced.text).toBe(0);
  git("add", "-A");
  git("commit", "-qm", "baseline");
}, 180_000);

const reported = `export async function getAccountAvailableForCanonical(db: { execute(query: unknown): Promise<unknown> }, canonicalId: string) {
  return db.execute(sql\`
    select available
    from accounts
    where key = \${"d2d-canonical:" + canonicalId}
  \`);
}
`;

function clean(path: string, text: string) {
  const out = gate.run(["check", "--stdin", "--path", path], text);
  expect(out.code, out.text).toBe(0);
  expect(out.text).not.toContain("DRIZ-RAW-001");
  expect(out.text).toContain("no introduced violations");
}

function denied(path: string, text: string) {
  const out = gate.run(["check", "--stdin", "--path", path], text);
  expect(out.code, out.text).toBe(1);
  expect(out.text).toContain("drizzle/DRIZ-RAW-001");
  expect(out.text).toContain("drizzle/queries/no-sql-concat@1.0.1");
}

test("issue 157: compiled CLI allows a sql template parameter built with plus", () => {
  clean("src/budget/contingency.ts", reported);
});

test("issue 157: compiled CLI still denies string-concatenated SQL passed to execute", () => {
  denied("src/queries/select-concat.ts", "const rows = await db.execute(\"SELECT * FROM u WHERE id = \" + id);\n");
  denied("src/queries/select-template-concat.ts", "const rows = await db.execute(`select key = ${\"d2d-canonical:\" + canonicalId}`);\n");
});

test("issue 157: compiled CLI still denies sql.raw with dynamic input", () => {
  denied("src/queries/select-raw-input.ts", "const rows = await db.execute(sql.raw(userInput));\n");
  denied("src/queries/select-raw-concat.ts", "const rows = await db.execute(sql.raw(\"SELECT \" + id));\n");
});

test("issue 157: drizzle concat fixtures pass through the compiled CLI", () => {
  const root = project("fixtures");
  const tested = root.run(["rules", "test", "--library", "drizzle"]);
  expect(tested.code, tested.text).toBe(0);
  for (const line of [
    "drizzle/queries/no-sql-concat pass/bound-parameter-concat",
    "drizzle/queries/no-sql-concat pass/parameterized-sql",
    "drizzle/queries/no-sql-concat fail/execute-concat",
    "drizzle/queries/no-sql-concat fail/execute-template-concat",
    "drizzle/queries/no-sql-concat fail/sql-raw-input",
    "drizzle/queries/no-sql-concat trap/sanitized-raw",
  ]) expect(tested.text, line).toContain(`ok   ${line}`);
});
