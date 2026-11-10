import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

setDefaultTimeout(180_000);
const area = mkdtempSync(join(tmpdir(), "pregate-prisma-orm7-"));
const binary = join(area, "engine", "version", ENGINE_FILE);
beforeAll(() => compileBinary(hostTarget(), binary, true));
afterAll(() => removeTree(area));

const middleware = `import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ adapter });
prisma.$use(async (params, next) => next(params));
`;
const validator = `import { Prisma } from "@prisma/client";

export const userSelect = Prisma.validator({ email: true });
`;
const bareClient = `import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
`;
const adapted = `import { PrismaClient } from "@prisma/client";

const adapter = createAdapter();
export const prisma = new PrismaClient({ adapter });
`;

function releasedCapture<T>(capture: string, descriptors: number[], body: () => T): T {
  try { return body(); } finally {
    for (const fd of descriptors) closeSync(fd);
    removeTree(capture);
  }
}

function project() {
  const root = join(area, randomUUID());
  mkdirSync(root);
  const env = { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(root, "home"), XDG_DATA_HOME: join(root, "data"),
    XDG_STATE_HOME: join(root, "state"), CODEX_HOME: join(root, "codex"), GROK_HOME: join(root, "grok"),
    GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com" };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const capture = mkdtempSync(join(area, "capture-")), descriptors: number[] = [];
    const opened = (name: string, flags: string) => {
      const fd = openSync(join(capture, name), flags);
      descriptors.push(fd);
      return fd;
    };
    return releasedCapture(capture, descriptors, () => {
      if (input !== undefined) writeFileSync(join(capture, "stdin"), input);
      const out = spawnSync(binary, args, { cwd: root, env,
        stdio: [input === undefined ? "ignore" : opened("stdin", "r"), opened("stdout", "w"), opened("stderr", "w")], timeout: 30000 });
      const text = readFileSync(join(capture, "stdout"), "utf8"), error = readFileSync(join(capture, "stderr"), "utf8");
      if (out.error || out.signal) throw new Error(`${JSON.stringify(args)} failed: ${out.error?.message ?? out.signal}\n${text}\n${error}`);
      return { code: out.status, text, error };
    });
  };
  const approve = (args: string[]) => {
    const preview = run(args);
    expect(preview.code, preview.text + preview.error).toBe(0);
    const digest = preview.text.match(/Digest: ([a-f0-9]{64})/)![1]!;
    const applied = run(["approve", "--yes", "--digest", digest]);
    expect(applied.code, applied.text + applied.error).toBe(0);
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20000 });
    if (out.exitCode !== 0) throw new Error(out.stderr.toString());
  };
  let calls = 0;
  const hook = (sid: string, path: string, content: string) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: "PreToolUse",
    permission_mode: "acceptEdits", prompt_id: "turn", tool_name: "Write", tool_use_id: `write-${++calls}`,
    tool_input: { file_path: join(root, path), content },
  }));
  return { root, put, run, approve, git, hook };
}

test("the compiled CLI admits the prisma fixtures", () => {
  const p = project();
  const tested = p.run(["rules", "test", "--library", "prisma"]);
  expect(tested.code, tested.text).toBe(0);
  expect(tested.text).toContain("ok   prisma/client/no-client-middleware");
  expect(tested.text).toContain("ok   prisma/client/no-validator");
  expect(tested.text).toContain("ok   prisma/client/no-missing-adapter");
});

test("Prisma 7 client breaks deny or warn through the hook and CLI, and Prisma 6 does not", () => {
  const p = project();
  p.put("package.json", JSON.stringify({ name: "shop" }));
  p.put("src/db.ts", "export const ready = true;\n");
  p.git("init", "-q");
  p.approve(["init", "--preview"]);
  p.approve(["pack", "enable", "prisma/client", "--preview"]);
  p.approve(["pack", "enable", "prisma/writes", "--preview"]);
  p.put(".pregate/requests/enforce.json", JSON.stringify({ why: "Exercise the Prisma 7 rules under enforce.", patch: [{ op: "add", path: "/enforcement", value: "enforce" }] }));
  expect(p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]).code).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");
  p.put("package.json", JSON.stringify({ name: "shop", dependencies: { "@prisma/client": "^7.0.0" }, devDependencies: { prisma: "^7.0.0" } }));

  const sid = randomUUID();
  const started = p.run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: p.root, session_id: sid, transcript_path: join(p.root, "transcript.jsonl"), hook_event_name: "SessionStart",
    permission_mode: "acceptEdits", prompt_id: "turn", source: "startup",
  }));
  expect(started.code, started.text + started.error).toBe(0);

  const denied = p.hook(sid, "src/db.ts", middleware);
  expect(denied.code, denied.text + denied.error).toBe(2);
  expect(denied.text).toContain("PRISMA-MIDDLEWARE-001");
  expect(JSON.parse(denied.text).hookSpecificOutput.permissionDecision).toBe("deny");
  const stdinDenied = p.run(["check", "--stdin", "--path", "src/db.ts"], middleware);
  expect(stdinDenied.code, stdinDenied.text).toBe(1);
  expect(stdinDenied.text).toContain("PRISMA-MIDDLEWARE-001");
  expect(stdinDenied.text).toContain("https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7");

  const warnedValidator = p.hook(sid, "src/select.ts", validator);
  expect(warnedValidator.code, warnedValidator.text + warnedValidator.error).toBe(0);
  expect(warnedValidator.text).toContain("PRISMA-VALIDATOR-001");
  expect(warnedValidator.text).toContain("satisfies");
  const stdinValidator = p.run(["check", "--stdin", "--path", "src/select.ts"], validator);
  expect(stdinValidator.code, stdinValidator.text).toBe(0);
  expect(stdinValidator.text).toContain("PRISMA-VALIDATOR-001");

  const warnedAdapter = p.hook(sid, "src/client.ts", bareClient);
  expect(warnedAdapter.code, warnedAdapter.text + warnedAdapter.error).toBe(0);
  expect(warnedAdapter.text).toContain("PRISMA-ADAPTER-001");
  expect(warnedAdapter.text).toContain("accelerateUrl");
  const stdinAdapter = p.run(["check", "--stdin", "--path", "src/client.ts"], bareClient);
  expect(stdinAdapter.code, stdinAdapter.text).toBe(0);
  expect(stdinAdapter.text).toContain("PRISMA-ADAPTER-001");

  const adaptedHook = p.hook(sid, "src/client.ts", adapted);
  expect(adaptedHook.code, adaptedHook.text + adaptedHook.error).toBe(0);
  expect(adaptedHook.text).not.toContain("PRISMA-ADAPTER-001");
  expect(p.run(["check", "--stdin", "--path", "src/client.ts"], adapted).text).not.toContain("PRISMA-ADAPTER-001");

  p.put("package.json", JSON.stringify({ name: "shop", dependencies: { "@prisma/client": "^6.19.0" }, devDependencies: { prisma: "^6.19.0" } }));
  const legacyHook = p.hook(sid, "src/db.ts", middleware);
  expect(legacyHook.code, legacyHook.text + legacyHook.error).toBe(0);
  expect(legacyHook.text).not.toContain("PRISMA-MIDDLEWARE-001");
  const legacyStdin = p.run(["check", "--stdin", "--path", "src/db.ts"], middleware);
  expect(legacyStdin.code, legacyStdin.text).toBe(0);
  expect(legacyStdin.text).not.toContain("PRISMA-MIDDLEWARE-001");
  expect(p.run(["check", "--stdin", "--path", "src/select.ts"], validator).text).not.toContain("PRISMA-VALIDATOR-001");
  expect(p.run(["check", "--stdin", "--path", "src/client.ts"], bareClient).text).not.toContain("PRISMA-ADAPTER-001");

  const tx = p.run(["explain", "PRISMA-TXCLIENT-001"]);
  expect(tx.code, tx.text).toBe(0);
  expect(tx.text).toContain("https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions#interactive-transactions");
  expect(tx.text).not.toContain("/docs/v6/");
  const connect = p.run(["explain", "PRISMA-CONNECT-001"]);
  expect(connect.code, connect.text).toBe(0);
  expect(connect.text).toContain("new PrismaClient({ adapter })");
  expect(connect.text).toContain("https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7");
});
