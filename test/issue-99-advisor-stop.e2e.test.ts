import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { enforcementOf } from "../src/enforcement.ts";
import type { Lock } from "../src/types.ts";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Compiled CLI: advisor Stop must not deny an unresolved import when nothing is enforced,
// and a real @/* alias through Next.js dynamic segments and a schema index must audit clean.
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-issue-99-"));
afterAll(() => removeTree(area));

const ROUTE = "src/app/api/projects/[projectCode]/drawings/[...path]/route.ts";
const ROUTE_TEXT = `import { catalog } from "@/app/api/projects/[projectCode]/drawings/catalog/handler";
import { load } from "@/app/api/projects/[projectCode]/drawings/[...path]/load";
import { users } from "@/lib/db/schema";

export function GET() {
  return { catalog, load, users };
}
`;

function enforcedCount(lock: Lock): number {
  return lock.rules.filter((rule) => enforcementOf(lock, rule) === "enforce").length;
}

test("advisor Stop does not deny, and @/* Next.js segments plus a schema index audit clean", () => {
  const root = join(area, "next");
  const machine = join(area, "machine");
  mkdirSync(root);
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
    const out = Bun.spawnSync([cli, ...args], {
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

  put("package.json", '{ "name": "next-app", "private": true }\n');
  put("tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }, null, 2) + "\n");
  put("src/domain/project.ts", "export const project = { id: \"project\" };\n");
  put("src/lib/db/schema/index.ts", "export const users = { id: \"users\" };\n");
  put("src/app/api/projects/[projectCode]/drawings/catalog/handler.ts", "export const catalog = { id: \"catalog\" };\n");
  put("src/app/api/projects/[projectCode]/drawings/[...path]/load.ts", "export const load = { id: \"load\" };\n");
  put(ROUTE, ROUTE_TEXT);
  git("init", "-q");
  expect(run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  put("layers.json", JSON.stringify({
    why: "App routes may import the domain, including the database schema.",
    layers: {
      domain: { paths: ["src/domain/**", "src/lib/**"], mayImport: [], kind: "core" },
      app: { paths: ["src/app/**"], mayImport: ["domain"], kind: "adapter" },
    },
  }));
  const review = run(["layers", "apply", "layers.json", "--preview"]);
  expect(review.code, review.text).toBe(0);
  const digest = review.text.match(/Digest: ([0-9a-f]{64})/)?.[1];
  expect(digest, review.text).toBeTruthy();
  expect(run(["approve", "--yes", "--digest", digest!]).code, review.text).toBe(0);
  put(".pregate/requests/advisor.json", JSON.stringify({
    why: "Report findings without blocking at Stop.",
    patch: [{ op: "replace", path: "/enforcement", value: "advisor" }],
  }));
  const applied = run(["preset", "apply", ".pregate/requests/advisor.json", "--yes"]);
  expect(applied.code, applied.text).toBe(0);
  const lock = JSON.parse(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8")) as Lock;
  expect(lock.enforcement).toBe("advisor");
  expect(enforcedCount(lock)).toBe(0);
  git("add", "-A");
  git("commit", "-qm", "advisor next routes");

  const audited = run(["audit"]);
  expect(audited.code, audited.text).toBe(0);
  expect(audited.text).toContain("Exit 0: complete; nothing blocks under the live policy.");
  expect(audited.text).not.toContain("unresolvable-import");
  expect(audited.text).not.toContain("could not be analyzed");
  expect(audited.text).not.toContain("incomplete");

  const session = randomUUID();
  const start = run(["hook", "session-start", "--harness", "claude-code"], JSON.stringify({
    hook_event_name: "SessionStart", session_id: session, cwd: root, source: "startup", permission_mode: "default",
  }));
  expect(start.code, start.text).toBe(0);
  put(ROUTE, `${ROUTE_TEXT}\n`);
  const stop = run(["hook", "stop", "--harness", "claude-code"], JSON.stringify({
    hook_event_name: "Stop", session_id: session, cwd: root, stop_hook_active: false, permission_mode: "default",
  }));
  expect(stop.code, stop.text).toBe(0);
  expect(stop.text).not.toContain("PREGATE DENY");
  expect(stop.text).not.toContain("unresolvable-import");
  expect(stop.stdout).not.toContain('"decision":"block"');

  put("src/domain/gap.ts", "import { missing } from \"~/not-a-module\";\nexport const value = missing;\n");
  const gapStop = run(["hook", "stop", "--harness", "claude-code"], JSON.stringify({
    hook_event_name: "Stop", session_id: session, cwd: root, stop_hook_active: false, permission_mode: "default",
  }));
  expect(gapStop.code, gapStop.text).toBe(0);
  expect(gapStop.text).not.toContain("PREGATE DENY");
  expect(gapStop.stdout).not.toContain('"decision":"block"');
  const warned = run(["check", "--stdin", "--path", "src/domain/gap.ts"], readFileSync(join(root, "src/domain/gap.ts"), "utf8"));
  expect(warned.code, warned.text).toBe(0);
  expect(warned.text).toContain("PREGATE WARN unresolvable-import");
  expect(warned.text).toContain("src/domain/gap.ts");
  expect(warned.text).toContain("did not block, because no enforced rule applies to this file");
  expect(warned.text).not.toContain("PREGATE DENY");

  put(".pregate/requests/enforce.json", JSON.stringify({
    why: "An enforced contract still denies an import that cannot be resolved.",
    patch: [{ op: "replace", path: "/enforcement", value: "enforce" }],
  }));
  const enforced = run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(enforced.code, enforced.text).toBe(0);
  const denied = run(["check", "--stdin", "--path", "src/domain/gap.ts"], readFileSync(join(root, "src/domain/gap.ts"), "utf8"));
  expect(denied.code, denied.text).toBe(1);
  expect(denied.text).toContain("PREGATE DENY unresolvable-import");
  expect(denied.text).toContain("src/domain/gap.ts");
}, 180_000);
