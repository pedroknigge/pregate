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
const area = mkdtempSync(join(tmpdir(), "pregate-nestjs-12-5-"));
const binary = join(area, "engine", "version", ENGINE_FILE);
beforeAll(() => engineAt(binary, true));
afterAll(() => removeTree(area));

const largePayload = `import { WsAdapter } from "@nestjs/platform-ws";
export function bind(app: object) {
  app.useWebSocketAdapter(new WsAdapter(app, { maxPayload: 10 * 1024 * 1024 }));
}
`;
const bounded = `import { WsAdapter } from "@nestjs/platform-ws";
export function bind(app: object) {
  app.useWebSocketAdapter(new WsAdapter(app, { maxPayload: 1024 * 1024 }));
}
`;
const tcpUnlimited = `import { Transport } from "@nestjs/microservices";
export function bind(app: object) {
  app.connectMicroservice({ transport: Transport.TCP, options: { maxConcurrentMessages: 0 } });
}
`;
const wsZero = `import { WsAdapter } from "@nestjs/platform-ws";
export function bind(app: object) {
  app.useWebSocketAdapter(new WsAdapter(app, { maxConcurrentMessages: 0 }));
}
`;
const emptyHost = `import { Transport } from "@nestjs/microservices";
export function bind(app: object) {
  app.connectMicroservice({ transport: Transport.TCP, options: { host: "", port: 3001 } });
}
`;
const explicitHost = `import { Transport } from "@nestjs/microservices";
export function bind(app: object) {
  app.connectMicroservice({ transport: Transport.TCP, options: { host: "0.0.0.0", port: 3001 } });
}
`;
const localOmitted = `import { Transport } from "@nestjs/microservices";
export function bind(app: object) {
  app.connectMicroservice({ transport: Transport.TCP, options: { port: 3001 } });
}
`;
const missingDocker = `import { NestFactory } from "@nestjs/core";
import { Transport } from "@nestjs/microservices";
import { AppModule } from "./app.module";
// Published on the container network from the Dockerfile.
export async function start() {
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.TCP,
    options: { port: 3001 },
  });
  await app.listen();
}
`;
const nest125 = {
  name: "shop",
  dependencies: {
    "@nestjs/core": "12.5.0",
    "@nestjs/microservices": "12.5.0",
    "@nestjs/platform-ws": "12.5.0",
    "@nestjs/websockets": "12.5.0",
  },
};
const nest124 = { name: "shop", dependencies: { "@nestjs/core": "^12.4.2" } };

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

test("a project that never ran pregate enable does not flag NestJS 12.5 limits", () => {
  const p = project();
  p.put("package.json", JSON.stringify(nest125));
  p.put("src/main.ts", "export const ready = true;\n");
  p.git("init", "-q");
  const sid = randomUUID();
  const inert = p.hook(sid, "src/main.ts", largePayload);
  expect(inert.code, inert.text + inert.error).toBe(0);
  expect(inert.text).not.toContain("NEST-LIMIT-001");
  expect(inert.text).not.toContain("NEST-TCP-001");
});

test("NestJS 12.5 limits deny and the TCP host change warns only after pregate enable", () => {
  const p = project();
  const tested = p.run(["rules", "test", "--library", "nestjs"]);
  expect(tested.code, tested.text).toBe(0);
  expect(tested.text).toContain("ok   nestjs/transport/no-raised-limit");
  expect(tested.text).toContain("ok   nestjs/transport/no-implicit-tcp-host");

  p.put("package.json", JSON.stringify({ name: "shop" }));
  p.put("src/main.ts", "export const ready = true;\n");
  p.git("init", "-q");
  const before = p.hook(randomUUID(), "src/main.ts", largePayload);
  expect(before.code, before.text + before.error).toBe(0);
  expect(before.text).not.toContain("NEST-LIMIT-001");

  p.approve(["init", "--preview", "--preset", "integrity-only"]);
  p.approve(["pack", "enable", "nestjs/transport", "--preview"]);
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Exercise the NestJS 12.5 rules under enforce.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  expect(p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]).code).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");
  p.put("package.json", JSON.stringify(nest125));

  const sid = randomUUID();
  const started = p.run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: p.root, session_id: sid, transcript_path: join(p.root, "transcript.jsonl"), hook_event_name: "SessionStart",
    permission_mode: "acceptEdits", prompt_id: "turn", source: "startup",
  }));
  expect(started.code, started.text + started.error).toBe(0);

  const disabled = p.run(["disable", "--yes"]);
  expect(disabled.code, disabled.text + disabled.error).toBe(0);
  const whileDisabled = p.hook(sid, "src/main.ts", largePayload);
  expect(whileDisabled.code, whileDisabled.text + whileDisabled.error).toBe(0);
  expect(whileDisabled.text).not.toContain("NEST-LIMIT-001");
  const enabled = p.run(["enable", "--yes"]);
  expect(enabled.code, enabled.text + enabled.error).toBe(0);

  const denied = p.hook(sid, "src/main.ts", largePayload);
  expect(denied.code, denied.text + denied.error).toBe(2);
  expect(denied.text).toContain("NEST-LIMIT-001");
  expect(denied.text).toContain("1048576");
  expect(denied.text).toContain("WsAdapter");
  expect(denied.text).toContain("Fix:");
  expect(JSON.parse(denied.text).hookSpecificOutput.permissionDecision).toBe("deny");
  const stdinDenied = p.run(["check", "--stdin", "--path", "src/main.ts"], largePayload);
  expect(stdinDenied.code, stdinDenied.text).toBe(1);
  expect(stdinDenied.text).toContain("NEST-LIMIT-001");
  expect(stdinDenied.text).toContain("1048576");
  expect(stdinDenied.text).toContain("Fix:");

  const unlimited = p.hook(sid, "src/tcp.ts", tcpUnlimited);
  expect(unlimited.code, unlimited.text + unlimited.error).toBe(2);
  expect(unlimited.text).toContain("NEST-LIMIT-001");
  expect(unlimited.text).toContain("maxConcurrentMessages");
  const stdinUnlimited = p.run(["check", "--stdin", "--path", "src/tcp.ts"], tcpUnlimited);
  expect(stdinUnlimited.code, stdinUnlimited.text).toBe(1);
  expect(stdinUnlimited.text).toContain("NEST-LIMIT-001");

  const kept = p.hook(sid, "src/main.ts", bounded);
  expect(kept.code, kept.text + kept.error).toBe(0);
  expect(kept.text).not.toContain("NEST-LIMIT-001");
  expect(p.run(["check", "--stdin", "--path", "src/main.ts"], bounded).text).not.toContain("NEST-LIMIT-001");
  const zeroOnWs = p.hook(sid, "src/ws.ts", wsZero);
  expect(zeroOnWs.code, zeroOnWs.text + zeroOnWs.error).toBe(0);
  expect(zeroOnWs.text).not.toContain("NEST-LIMIT-001");

  const warned = p.hook(sid, "src/tcp.ts", emptyHost);
  expect(warned.code, warned.text + warned.error).toBe(0);
  expect(warned.text).toContain("PREGATE WARN");
  expect(warned.text).toContain("NEST-TCP-001");
  expect(warned.text).toContain("0.0.0.0");
  expect(warned.text).not.toContain("\"permissionDecision\":\"deny\"");
  const stdinWarned = p.run(["check", "--stdin", "--path", "src/tcp.ts"], emptyHost);
  expect(stdinWarned.code, stdinWarned.text).toBe(0);
  expect(stdinWarned.text).toContain("NEST-TCP-001");
  expect(stdinWarned.text).toContain("localhost");

  const docker = p.hook(sid, "src/listen.ts", missingDocker);
  expect(docker.code, docker.text + docker.error).toBe(0);
  expect(docker.text).toContain("NEST-TCP-001");
  expect(docker.text).not.toContain("\"permissionDecision\":\"deny\"");
  const named = p.hook(sid, "src/tcp.ts", explicitHost);
  expect(named.code, named.text + named.error).toBe(0);
  expect(named.text).not.toContain("NEST-TCP-001");
  const local = p.hook(sid, "src/local.ts", localOmitted);
  expect(local.code, local.text + local.error).toBe(0);
  expect(local.text).not.toContain("NEST-TCP-001");

  p.put("package.json", JSON.stringify(nest124));
  const legacyPayload = p.hook(sid, "src/main.ts", largePayload);
  expect(legacyPayload.code, legacyPayload.text + legacyPayload.error).toBe(0);
  expect(legacyPayload.text).not.toContain("NEST-LIMIT-001");
  expect(p.run(["check", "--stdin", "--path", "src/main.ts"], largePayload).text).not.toContain("NEST-LIMIT-001");
  const legacyHost = p.hook(sid, "src/tcp.ts", emptyHost);
  expect(legacyHost.code, legacyHost.text + legacyHost.error).toBe(0);
  expect(legacyHost.text).not.toContain("NEST-TCP-001");
  expect(p.run(["check", "--stdin", "--path", "src/listen.ts"], missingDocker).text).not.toContain("NEST-TCP-001");

  const limit = p.run(["explain", "NEST-LIMIT-001"]);
  expect(limit.code, limit.text).toBe(0);
  expect(limit.text).toContain("https://docs.nestjs.com/websockets/adapter");
  expect(limit.text).toContain("1048576");
  const host = p.run(["explain", "NEST-TCP-001"]);
  expect(host.code, host.text).toBe(0);
  expect(host.text).toContain("https://docs.nestjs.com/microservices/basics");
  expect(host.text).toContain("0.0.0.0");
});
