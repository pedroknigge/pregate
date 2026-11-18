import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { engineAt } from "./compiled-engine.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

setDefaultTimeout(180_000);
const area = mkdtempSync(join(tmpdir(), "pregate-mongodb-oidc-"));
const binary = join(area, "engine", "version", ENGINE_FILE);
beforeAll(() => engineAt(binary, true), 120_000);
afterAll(() => removeTree(area));

const BLOCKED = `import { MongoClient } from "mongodb";
const callback = async () => ({ accessToken: "token" });
export function connect(uri: string): MongoClient {
  return new MongoClient(uri, {
    authMechanismProperties: {
      ENVIRONMENT: "azure",
      OIDC_CALLBACK: callback,
    },
  });
}
`;
const ALLOWED = `import { MongoClient } from "mongodb";
const callback = async () => ({ accessToken: "token" });
export function connect(uri: string): MongoClient {
  return new MongoClient(uri, {
    authMechanismProperties: { OIDC_CALLBACK: callback },
  });
}
`;
const ADVISORY = `{
  "dependencies": {
    "mongodb": "7.8.1"
  }
}
`;

function releasedCapture<T>(capture: string, descriptors: number[], body: () => T): T {
  try { return body(); } finally {
    for (const fd of descriptors) closeSync(fd);
    removeTree(capture);
  }
}

function project(name: string) {
  const root = join(area, name);
  mkdirSync(root);
  const env = {
    ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(root, "home"),
    XDG_DATA_HOME: join(root, "data"), XDG_STATE_HOME: join(root, "state"),
    CODEX_HOME: join(root, "codex"), GROK_HOME: join(root, "grok"),
    GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const capture = mkdtempSync(join(area, "capture-")), descriptors: number[] = [];
    const opened = (file: string, flags: string) => {
      const fd = openSync(join(capture, file), flags);
      descriptors.push(fd);
      return fd;
    };
    return releasedCapture(capture, descriptors, () => {
      if (input !== undefined) writeFileSync(join(capture, "stdin"), input);
      const out = spawnSync(binary, args, {
        cwd: root, env,
        stdio: [input === undefined ? "ignore" : opened("stdin", "r"), opened("stdout", "w"), opened("stderr", "w")],
        timeout: 30000,
      });
      const text = readFileSync(join(capture, "stdout"), "utf8");
      const error = readFileSync(join(capture, "stderr"), "utf8");
      if (out.error || out.signal) throw new Error(`${args.join(" ")} failed: ${out.error?.message ?? out.signal}\n${text}\n${error}`);
      return { code: out.status, text, error };
    });
  };
  const approve = (args: string[]) => {
    const preview = run(args);
    expect(preview.code, preview.text + preview.error).toBe(0);
    const digest = preview.text.match(/Digest: ([a-f0-9]{64})/)?.[1];
    expect(digest, preview.text).toBeTruthy();
    const applied = run(["approve", "--yes", "--digest", digest!]);
    expect(applied.code, applied.text + applied.error).toBe(0);
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${out.stderr.toString()}`);
  };
  const hook = (sid: string, path: string, content: string) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: "PreToolUse",
    permission_mode: "acceptEdits", prompt_id: "turn", tool_name: "Write", tool_use_id: path,
    tool_input: { file_path: join(root, path), content },
  }));
  const hookStart = (sid: string) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: "SessionStart",
    source: "startup",
  }));
  return { root, put, run, approve, git, hook, hookStart };
}

function denied(result: { code: number | null; text: string; error: string }, rule: string) {
  expect(result.code, result.text + result.error).toBe(2);
  expect(result.text).toContain(rule);
  expect(result.text).toContain("one mechanism only");
  expect(result.text).toContain(">=7.9.0");
  expect(JSON.parse(result.text).hookSpecificOutput.permissionDecision).toBe("deny");
}

function allowed(result: { code: number | null; text: string; error: string }, rule: string) {
  expect(result.code, result.text + result.error).toBe(0);
  expect(result.text).not.toContain(rule);
  expect(result.text).not.toContain("\"permissionDecision\":\"deny\"");
}

function warned(result: { code: number | null; text: string; error: string }, rule: string) {
  expect(result.code, result.text + result.error).toBe(0);
  expect(result.text).toContain("PREGATE WARN");
  expect(result.text).toContain(rule);
  expect(result.text).toContain(">=7.9.0");
  expect(result.text).not.toContain("\"permissionDecision\":\"deny\"");
}

test("a project that never ran pregate enable does not deny MongoDB writes", () => {
  const p = project("inert-" + randomUUID());
  p.git("init", "-q");
  const sid = randomUUID();
  allowed(p.hook(sid, "src/db.ts", BLOCKED), "mongodb/MONGO-OIDC-001");
  allowed(p.hook(sid, "package.json", ADVISORY), "mongodb/MONGO-OIDC-002");
});

test("the hook blocks, allows, and warns the MongoDB OIDC rules only after pregate enable", () => {
  const p = project("enabled-" + randomUUID());
  const tested = p.run(["rules", "test", "--library", "mongodb"]);
  expect(tested.code, tested.text + tested.error).toBe(0);
  expect(tested.text).toContain("ok   mongodb/models/no-mixed-oidc-mechanism trap/uri-and-callback ->");
  expect(tested.text).toContain("ok   mongodb/models/no-vulnerable-driver-pin trap/nested-lock ->");

  p.git("init", "-q");
  p.approve(["init", "--preview", "--preset", "integrity-only"]);
  p.approve(["pack", "enable", "mongodb/models", "--only", "MONGO-OIDC-001,MONGO-OIDC-002", "--preview"]);
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Exercise the MongoDB OIDC rules under enforcement.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const applied = p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(applied.code, applied.text + applied.error).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "contract");

  const off = randomUUID();
  const disabled = p.run(["disable", "--yes"]);
  expect(disabled.code, disabled.text + disabled.error).toBe(0);
  allowed(p.hook(off, "src/db.ts", BLOCKED), "mongodb/MONGO-OIDC-001");
  allowed(p.hook(off, "package.json", ADVISORY), "mongodb/MONGO-OIDC-002");

  const enabled = p.run(["enable", "--yes"]);
  expect(enabled.code, enabled.text + enabled.error).toBe(0);
  const sid = randomUUID();
  expect(p.hookStart(sid).code, "session").toBe(0);

  const blocked = p.hook(sid, "src/db.ts", BLOCKED);
  denied(blocked, "mongodb/MONGO-OIDC-001");
  const ok = p.hook(sid, "src/safe.ts", ALLOWED);
  allowed(ok, "mongodb/MONGO-OIDC-001");
  const advisory = p.hook(sid, "package.json", ADVISORY);
  warned(advisory, "mongodb/MONGO-OIDC-002");
  const advisorCheck = p.run(["check", "--stdin", "--path", "package.json"], ADVISORY);
  expect(advisorCheck.code, advisorCheck.text).toBe(0);
  expect(advisorCheck.text).toContain("PREGATE WARN");
  expect(advisorCheck.text).toContain("mongodb/MONGO-OIDC-002");
  expect(advisorCheck.text).toContain(">=7.9.0");

  console.log("E2E ENABLE\n" + enabled.text);
  console.log("E2E BLOCKED\n" + blocked.text);
  console.log("E2E ALLOWED\n" + ok.text);
  console.log("E2E ADVISORY\n" + advisory.text);
  console.log("E2E ADVISORY CHECK\n" + advisorCheck.text);
});
