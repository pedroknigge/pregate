import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import architecture from "../packs/architecture/source.json" with { type: "json" };
import { VERSIONS } from "../src/versions.ts";
import { policyFixture } from "./policy-fixtures.ts";

// Scratch repository: src/utils sits beside the declared layers and used to pass check --stdin.
const cli = join(import.meta.dir, "../src/main.ts");
const area = mkdtempSync(join(tmpdir(), "pregate-unlayered-"));
afterAll(() => rmSync(area, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

const LEGAL = `import { id } from "../domain/id";\n\nexport const placed = id;\n`;
const FORBIDDEN = `import { db } from "../infra/db";\n\nexport const placed = db;\n`;
const UTILS = `import { db } from "../infra/db";\n\nexport const value = db;\n`;
const OUTSIDE = `import { db } from "../src/infra/db";\n\nexport const outside = db;\n`;

function project(name: string) {
  const root = join(area, name);
  const machine = join(area, "machine");
  mkdirSync(root, { recursive: true });
  const env = {
    ...process.env,
    CI: "1",
    PREGATE_UNATTENDED_APPROVAL: "1",
    HOME: join(machine, "home"),
    USERPROFILE: join(machine, "home"),
    XDG_DATA_HOME: join(machine, "data"),
    XDG_STATE_HOME: join(machine, "state"),
    XDG_CONFIG_HOME: join(machine, "config"),
    CODEX_HOME: join(machine, "codex"),
    GROK_HOME: join(machine, "grok"),
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const out = Bun.spawnSync([process.execPath, cli, ...args], {
      cwd: root, env, stdin: input === undefined ? "ignore" : Buffer.from(input),
      stdout: "pipe", stderr: "pipe", timeout: 60_000,
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

const preset = policyFixture(JSON.stringify({
  name: "scratch", version: "1.0.0", engine: VERSIONS.engine,
  sources: [
    { ns: "core", kind: "builtin", version: VERSIONS.core },
    { ns: "architecture", kind: "library", version: architecture.version },
  ],
  methodologies: ["architecture/clean-architecture"],
  scope: { include: ["src/**", "test/**"], exclude: [] },
  enforcement: "enforce",
  ratchet: { mode: "no-new" },
  layers: {
    domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" },
    application: { paths: ["src/application/**"], mayImport: ["domain", "ports"], kind: "core" },
    ports: { paths: ["src/application/ports/**"], mayImport: ["domain"], kind: "port" },
    infra: { paths: ["src/infra/**"], mayImport: ["domain", "application", "ports"], kind: "adapter" },
    main: { paths: ["src/main.ts"], mayImport: ["*"], kind: "main" },
  },
}));

function scratch(name: string) {
  const repo = project(name);
  repo.put("src/domain/id.ts", "export const id = 1;\n");
  repo.put("src/infra/db.ts", "export const db = { id: 1 };\n");
  repo.put("src/application/place-order.ts", LEGAL);
  repo.put(".pregate/preset.json", preset);
  repo.git("init", "-q");
  const compiled = repo.run(["preset", "compile", "--yes"]);
  expect(compiled.code, compiled.text).toBe(0);
  repo.git("add", "src/domain/id.ts", "src/infra/db.ts", "src/application/place-order.ts", ".pregate/preset.json", ".pregate/pregate.lock.json");
  repo.git("commit", "-q", "-m", "layers");
  // New files, absent from HEAD, so every finding on them is introduced.
  repo.put("src/utils/helper.ts", UTILS);
  repo.put("test/helper.ts", OUTSIDE);
  return repo;
}

test("check and audit name src/utils/helper.ts when it matches no declared layer", () => {
  const repo = scratch("named");
  const checked = repo.run(["check", "--stdin", "--path", "src/utils/helper.ts"], UTILS);
  expect(checked.code, checked.text).toBe(1);
  expect(checked.text).toContain("architecture/CA-DEP-001 src/utils/helper.ts:1");
  expect(checked.text).toContain("matches no declared layer");
  const outside = repo.run(["check", "--stdin", "--path", "test/helper.ts"], OUTSIDE);
  expect(outside.text, outside.text).not.toContain("matches no declared layer");
  expect(outside.text).toContain("no introduced violations");
  const audited = repo.run(["audit"]);
  expect(audited.text).toContain("src/utils/helper.ts:1");
  expect(audited.text).toContain("architecture/CA-DEP-001");
  expect(audited.text).toContain("matches no declared layer");
  expect(audited.text).not.toContain("test/helper.ts");
}, 60_000);

test("an import inside a declared layer keeps the same dependency verdict", () => {
  const repo = scratch("layered");
  const legal = repo.run(["check", "--stdin", "--path", "src/application/place-order.ts"], LEGAL);
  expect(legal.code, legal.text).toBe(0);
  expect(legal.text).toContain("no introduced violations");
  const forbidden = repo.run(["check", "--stdin", "--path", "src/application/place-order.ts"], FORBIDDEN);
  expect(forbidden.code, forbidden.text).toBe(1);
  expect(forbidden.text).toContain("architecture/CA-DEP-001 src/application/place-order.ts:1");
  expect(forbidden.text).toContain("may not depend on");
  expect(forbidden.text).not.toContain("matches no declared layer");
}, 60_000);

test("the ratchet keeps an unlayered file that was already in the baseline", () => {
  const repo = scratch("ratchet");
  repo.git("add", "src/utils/helper.ts");
  repo.git("commit", "-q", "-m", "utils");
  const same = repo.run(["check", "--stdin", "--path", "src/utils/helper.ts"], UTILS);
  expect(same.code, same.text).toBe(0);
  expect(same.text).toContain("no introduced violations");
  const edited = UTILS.replace("export const value", "export const renamed");
  repo.put("src/utils/helper.ts", edited);
  const ratcheted = repo.run(["check", "--ratchet", "--base", "HEAD"]);
  expect(ratcheted.code, ratcheted.text).toBe(0);
  expect(ratcheted.text).toContain("no introduced violations");
  const fresh = `import { db } from "../infra/db";\n\nexport const other = db;\n`;
  const introduced = repo.run(["check", "--stdin", "--path", "src/extra/other.ts"], fresh);
  expect(introduced.code, introduced.text).toBe(1);
  expect(introduced.text).toContain("architecture/CA-DEP-001 src/extra/other.ts:1");
  expect(introduced.text).toContain("matches no declared layer");
}, 60_000);
