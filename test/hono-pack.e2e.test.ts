import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonical } from "../src/disk.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled CLI, against a real directory, is the scan and the gate a repository gets.
const cli = join(import.meta.dir, "../src/main.ts");
const area = mkdtempSync(join(tmpdir(), "pregate-hono-"));
afterAll(() => removeTree(area));

const bad = `import { Hono, type Context } from "hono";

const booksList = (c: Context) => c.json("list books");
const app = new Hono();
app.get("/books", booksList);
app.head("/books", (c) => c.text("ignored"));
app.use(async (c, next) => {
  next();
});
export const logger = async (c: Context, next: () => Promise<void>) => {
  await next();
};
`;

const good = `import { Hono } from "hono";
import { createFactory } from "hono/factory";

const factory = createFactory();
const app = factory.createApp();
const authors = new Hono().get("/", (c) => c.json("list authors"));
app.route("/authors", authors);
app.get("/books/:id", (c) => c.json(c.req.param("id")));
app.use(async (c, next) => {
  await next();
});
export const logger = factory.createMiddleware(async (c, next) => {
  await next();
});
`;

const badJs = `const { Hono } = require("hono");

const booksList = (c) => c.json("list books");
const app = new Hono();
app.get("/books", booksList);
app.use((c, next) => {
  next();
});
`;

function project(name: string) {
  const root = canonical(join(area, name));
  mkdirSync(root, { recursive: true });
  const env = {
    ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    HOME: join(root, "home"), USERPROFILE: join(root, "home"),
    XDG_DATA_HOME: join(root, "data"), XDG_STATE_HOME: join(root, "state"), XDG_CONFIG_HOME: join(root, "config"),
    CODEX_HOME: join(root, "codex"), GROK_HOME: join(root, "grok"),
    GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const put = (path: string, text: string) => {
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  };
  const run = (args: string[], input?: string) => {
    const out = Bun.spawnSync([process.execPath, cli, ...args], {
      cwd: root, env, stdin: input === undefined ? "ignore" : Buffer.from(input),
      stdout: "pipe", stderr: "pipe", timeout: 45_000,
    });
    if (out.signalCode) throw new Error(`${args.join(" ")} terminated: ${out.signalCode}\n${out.stderr.toString()}`);
    return { code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString(), text: out.stdout.toString() + out.stderr.toString() };
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  return { root, put, run, git };
}

function honoOf(stdout: string) {
  const body = JSON.parse(stdout) as { recommendations: { ns: string; reasons: string[]; methodologies: string[]; scope?: { include: string[]; exclude: string[] } }[] };
  return body.recommendations.find((item) => item.ns === "hono");
}

test("the compiled CLI admits the hono fixtures", () => {
  const tested = project("fixtures").run(["rules", "test", "--library", "hono"]);
  expect(tested.code, tested.text).toBe(0);
  expect(tested.text).toContain("ok   hono/routing/no-detached-handler");
  expect(tested.text).toContain("ok   hono/routing/no-dedicated-head");
  expect(tested.text).toContain("ok   hono/middleware/no-unawaited-next");
  expect(tested.text).toContain("ok   hono/middleware/no-untyped-middleware");
}, 60_000);

test("scan --json recommends hono for an app and not for docs, examples, or fixtures", () => {
  const app = project("app");
  app.put("package.json", '{"name":"api","dependencies":{"hono":"^4.6.0"}}\n');
  app.put("src/index.ts", "export const ready = true;\n");
  app.put("docs/package.json", '{"dependencies":{"hono":"^4.6.0"}}\n');
  app.put("examples/demo/package.json", '{"dependencies":{"hono":"^4.6.0"}}\n');
  app.put("fixtures/app/package.json", '{"dependencies":{"hono":"^4.6.0"}}\n');
  app.git("init", "-q");
  app.git("add", "-A");
  const found = app.run(["scan", "--json"]);
  expect(found.code, found.text).toBe(0);
  expect(honoOf(found.stdout)).toMatchObject({
    ns: "hono",
    methodologies: ["hono/routing", "hono/middleware"],
    reasons: ["package.json declares hono"],
    scope: { include: ["**"], exclude: ["docs/**", "examples/demo/**", "fixtures/app/**"] },
  });

  const nested = project("apps-api");
  nested.put("apps/api/package.json", '{"dependencies":{"hono":"^4.6.0"}}\n');
  nested.put("apps/api/src/index.ts", "export const ready = true;\n");
  nested.git("init", "-q");
  nested.git("add", "-A");
  const api = nested.run(["scan", "--json"]);
  expect(api.code, api.text).toBe(0);
  expect(honoOf(api.stdout)).toMatchObject({
    reasons: ["apps/api/package.json declares hono"],
    scope: { include: ["apps/api/**"], exclude: [] },
  });

  for (const [name, files] of [
    ["docs-only", { "docs/package.json": '{"dependencies":{"hono":"^4.6.0"}}\n', "src/index.ts": "export const ready = true;\n" }],
    ["examples-only", { "examples/guide/package.json": '{"dependencies":{"hono":"^4.6.0"}}\n', "src/index.ts": "export const ready = true;\n" }],
    ["fixtures-only", { "fixtures/app/package.json": '{"dependencies":{"hono":"^4.6.0"}}\n', "src/index.ts": "export const ready = true;\n" }],
    ["dev-dependency", { "package.json": '{"devDependencies":{"hono":"^4.6.0"}}\n', "src/index.ts": "export const ready = true;\n" }],
    ["other-package", { "package.json": '{"name":"hono","dependencies":{"@hono/node-server":"^1.0.0"}}\n', "src/index.ts": "export const ready = true;\n" }],
  ] as const) {
    const negative = project(name);
    for (const [path, text] of Object.entries(files)) negative.put(path, text);
    negative.git("init", "-q");
    negative.git("add", "-A");
    const result = negative.run(["scan", "--json"]);
    expect(result.code, result.text).toBe(0);
    expect(honoOf(result.stdout)).toBeUndefined();
  }
}, 90_000);

test("stdin check denies detached handlers, HEAD routes, and untyped middleware, and allows the guide's forms", () => {
  const p = project("gate");
  p.put("package.json", '{ "name": "api", "dependencies": { "hono": "^4.6.0" } }\n');
  p.put("src/index.ts", "export const ready = true;\n");
  p.git("init", "-q");
  expect(p.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  expect(p.run(["pack", "add", "--library", "hono", "--yes"]).code).toBe(0);
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge the Hono rules in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const enforced = p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(enforced.code, enforced.text).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");

  const denied = p.run(["check", "--stdin", "--path", "src/books.ts"], bad);
  expect(denied.code, denied.text).toBe(1);
  expect(denied.text).toContain("hono/HONO-CTRL-001");
  expect(denied.text).toContain("hono/HONO-HEAD-001");
  expect(denied.text).toContain("hono/HONO-NEXT-001");
  expect(denied.text).toContain("hono/HONO-MW-001");

  const allowed = p.run(["check", "--stdin", "--path", "src/books.ts"], good);
  expect(allowed.code, allowed.text).toBe(0);
  expect(allowed.text).not.toContain("HONO-");
  expect(allowed.text).toContain("no introduced violations");

  const deniedJs = p.run(["check", "--stdin", "--path", "src/books.js"], badJs);
  expect(deniedJs.code, deniedJs.text).toBe(1);
  expect(deniedJs.text).toContain("hono/HONO-CTRL-001");
  expect(deniedJs.text).toContain("hono/HONO-NEXT-001");
  expect(deniedJs.text).not.toContain("hono/HONO-MW-001");
}, 120_000);
