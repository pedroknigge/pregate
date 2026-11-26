import { beforeAll, expect, test } from "bun:test";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import type { Check } from "../src/types.ts";

beforeAll(grammars);

function findings(source: string): number {
  const check = JSON.parse(librarySource("drizzle")!["checks/queries/no-sql-concat/check.json"]!) as Check;
  const out = analyze(fixtureLock(check, {}, undefined), "pre", "src/budget/contingency.ts", source, { now: clock, read: () => null });
  if ("cause" in out) throw new Error(out.cause);
  return out.violations.length;
}

const reported = `export async function getAccountAvailableForCanonical(db: { execute(query: unknown): Promise<unknown> }, canonicalId: string) {
  return db.execute(sql\`
    select available
    from accounts
    where key = \${"d2d-canonical:" + canonicalId}
  \`);
}`;

test("issue 157: a plus inside a sql template parameter is a bound value", () => {
  expect(findings(reported)).toBe(0);
});

test.each([
  ["single quotes", "return db.execute(sql`select ${'d2d-canonical:' + id}`);"],
  ["template prefix", "return db.execute(sql`select ${`d2d-canonical:` + id}`);"],
  ["parentheses", "return db.execute(sql`select ${(\"d2d-canonical:\" + id)}`);"],
  ["wrapped tag", "return db.execute((sql`select ${\"d2d-canonical:\" + id}`));"],
  ["member tag", "return db.execute(orm.sql`select ${\"d2d-canonical:\" + id}`);"],
  ["nested value", "return db.execute(sql`select ${`prefix:${\"d2d-canonical:\" + id}`}`);"],
  ["identifier only", "return db.execute(sql`select * from users where id = ${id}`);"],
])("issue 157: bound sql parameter passes: %s", (_name, source) => {
  expect(findings(source)).toBe(0);
});

test.each([
  ["string concat", "const rows = await db.execute(\"SELECT * FROM u WHERE id = \" + id);"],
  ["single-quote concat", "const rows = await db.execute('SELECT * FROM u WHERE id = ' + id);"],
  ["backtick concat", "const rows = await db.execute(`SELECT * FROM u WHERE id = '` + id + `'`);"],
  ["plain template", "const rows = await db.execute(`select available from accounts where key = ${\"d2d-canonical:\" + canonicalId}`);"],
  ["concat beside a sql tag", "const rows = await db.execute(prefix + sql`select ${\"d2d-canonical:\" + id}`);"],
  ["sql.raw input", "const rows = await db.execute(sql.raw(userInput));"],
  ["sql.raw concat", "const rows = await db.execute(sql.raw(\"SELECT \" + id));"],
  ["sql.raw outside execute", "const query = sql.raw(requestText);"],
  ["sanitized sql.raw", "const clean = sanitize(userInput); const rows = await db.execute(sql.raw(clean));"],
])("issue 157: sql concatenation still flags: %s", (_name, source) => {
  expect(findings(source)).toBeGreaterThan(0);
});
