import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { engineAt } from "./compiled-engine.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeReleased } from "./remove-tree.ts";

// In a monorepo a package imports another by its name, not by a relative path. The layer rule must
// see that import as an edge between two folders of the project, as it does for `../infra/db`.
setDefaultTimeout(60_000);

const area = canonical(mkdtempSync(join(tmpdir(), "pregate-monorepo-")));
const installed = canonical(mkdtempSync(join(tmpdir(), "pregate-monorepo-engine-")));
const binary = join(installed, "bin", ENGINE_FILE);
beforeAll(() => engineAt(binary, true), 120_000);
afterAll(() => { removeReleased(area); removeReleased(installed); }, 40_000);

const SOURCES: Record<string, string> = {
  "package.json": '{"name":"acme","private":true,"type":"module","workspaces":["packages/*"]}\n',
  "tsconfig.json": '{"compilerOptions":{"strict":true}}\n',
  "packages/domain/package.json": '{"name":"@acme/domain","type":"module","exports":{".":"./src/index.ts"}}\n',
  "packages/domain/tsconfig.json": '{"extends":"../../tsconfig.json","compilerOptions":{"paths":{"~/*":["./src/*"]}}}\n',
  "packages/domain/src/index.ts": 'export * from "~/order.ts";\n',
  "packages/domain/src/order.ts": "export interface Order { id: string }\nexport const empty: Order = { id: \"\" };\n",
  "packages/infra/package.json": '{"name":"@acme/infra","type":"module","main":"./dist/index.js","types":"./src/index.ts"}\n',
  "packages/infra/src/index.ts": 'export * from "./db.ts";\n',
  "packages/infra/src/db.ts": 'import type { Order } from "@acme/domain";\nexport function saveOrder(order: Order): string { return order.id; }\n',
};
const LAYERS = {
  domain: { paths: ["packages/domain/**"], mayImport: [], kind: "core" },
  infra: { paths: ["packages/infra/**"], mayImport: ["domain"], kind: "adapter" },
};
const BY_NAME = 'import { saveOrder } from "@acme/infra";\nexport const price = saveOrder({ id: "1" });\n';

function project() {
  const base = join(area, "case");
  const root = join(base, "repo"), machine = join(base, "machine");
  for (const [rel, text] of Object.entries(SOURCES)) { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); }
  const env = { ...process.env, HOME: join(machine, "home"), USERPROFILE: join(machine, "home"), CODEX_HOME: join(machine, "codex"), GROK_HOME: join(machine, "grok"),
    CLAUDE_CONFIG_DIR: join(machine, "claude"), XDG_DATA_HOME: join(machine, "data"), XDG_STATE_HOME: join(machine, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
  const run = (command: string[], input?: string) => {
    const result = Bun.spawnSync(command, { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 30_000, ...(input === undefined ? {} : { stdin: Buffer.from(input) }) });
    return { code: result.exitCode, stdout: result.stdout.toString(), text: result.stdout.toString() + result.stderr.toString() };
  };
  const cli = (...args: string[]) => run([binary, ...args]);
  const git = (...args: string[]) => run(["git", ...args]);
  const approve = (review: { code: number | null; text: string }) => {
    expect(review.code, review.text).toBe(0);
    const applied = cli("approve", "--yes", "--digest", review.text.match(/Digest: ([0-9a-f]{64})/)![1]!);
    expect(applied.code, applied.text).toBe(0);
  };
  git("init", "-q", "-b", "main"); git("config", "user.name", "t"); git("config", "user.email", "t@example.com"); git("config", "commit.gpgsign", "false");
  git("add", "-A"); git("commit", "-qm", "base");
  approve(cli("guide", "--preview"));
  const session = randomUUID();
  const write = (rel: string, content: string) => run([binary, "hook", "pre", "--harness", "claude-code"], JSON.stringify({ session_id: session, cwd: root, permission_mode: "acceptEdits",
    hook_event_name: "PreToolUse", tool_name: "Write", tool_use_id: `toolu_${randomUUID()}`, tool_input: { file_path: join(root, rel), content } }) + "\n");
  return { root, cli, git, approve, write };
}

test("an enforced layer rule denies a package that imports a forbidden workspace package by name, and passes the allowed direction", () => {
  const p = project();
  const presetFile = join(p.root, ".pregate/preset.json");
  // Onboarding does not propose layers for workspace packages; the project declares them.
  type Source = { ns: string; kind: string; version: string };
  const preset = JSON.parse(readFileSync(presetFile, "utf8")) as { sources: Source[]; methodologies: string[]; layers: unknown };
  const catalog = JSON.parse(readFileSync(join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json"), "utf8")) as { sources: Source[] };
  if (!preset.sources.some((source) => source.ns === "architecture")) preset.sources.push(catalog.sources.find((source) => source.ns === "architecture")!);
  if (!preset.methodologies.includes("architecture/clean-architecture")) preset.methodologies.push("architecture/clean-architecture");
  preset.layers = LAYERS;
  writeFileSync(presetFile, `${JSON.stringify(preset, null, 2)}\n`);
  const compiled = p.cli("preset", "compile", "--yes");
  expect(compiled.code, compiled.text).toBe(0);
  p.approve(p.cli("promote", "--rule", "architecture/CA-DEP-001", "--preview"));
  p.git("add", "-A"); p.git("commit", "-qm", "enforce the layer rule");

  const denied = p.write("packages/domain/src/price.ts", BY_NAME);
  expect(denied.code, denied.text).toBe(2);
  const decision = JSON.parse(denied.stdout) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } };
  expect(decision.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(decision.hookSpecificOutput.permissionDecisionReason).toContain("architecture/CA-DEP-001");

  // infra may import domain: the same kind of import in the allowed direction, and a package's own alias.
  const allowed = p.write("packages/infra/src/repo.ts", 'import { empty } from "@acme/domain";\nexport const first = empty.id;\n');
  expect(allowed.code, allowed.text).toBe(0);
  expect(allowed.text).not.toContain("CA-DEP-001");
  const own = p.write("packages/domain/src/price.ts", 'import { empty } from "~/order.ts";\nexport const price = empty.id.length;\n');
  expect(own.code, own.text).toBe(0);
  expect(own.text).not.toContain("CA-DEP-001");
  expect(own.text).not.toContain("unresolvable-import");

  // The commit and CI check reads the same edge from the files on disk.
  writeFileSync(join(p.root, "packages/domain/src/price.ts"), BY_NAME);
  const check = p.cli("check");
  expect(check.code, check.text).not.toBe(0);
  expect(check.text).toContain("architecture/CA-DEP-001");
  expect(check.text).toContain("packages/domain/src/price.ts");
});
