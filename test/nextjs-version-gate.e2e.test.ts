import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

setDefaultTimeout(120_000);
const area = mkdtempSync(join(tmpdir(), "pregate-next16-"));
const binary = join(area, "engine", "version", ENGINE_FILE);
beforeAll(() => compileBinary(hostTarget(), binary, true));
afterAll(() => removeTree(area));

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
        stdio: [input === undefined ? "ignore" : opened("stdin", "r"), opened("stdout", "w"), opened("stderr", "w")], timeout: 20000 });
      const text = readFileSync(join(capture, "stdout"), "utf8"), error = readFileSync(join(capture, "stderr"), "utf8");
      if (out.error || out.signal) throw new Error(`Candidate command ${JSON.stringify(args)} failed: ${out.error?.message ?? out.signal}\nstdout:\n${text}\nstderr:\n${error}`);
      return { code: out.status, text, error };
    });
  };
  const approve = (args: string[]) => {
    const preview = run(args);
    expect(preview.code, preview.error + preview.text).toBe(0);
    const digest = preview.text.match(/Digest: ([a-f0-9]{64})/)![1]!;
    const applied = run(["approve", "--yes", "--digest", digest]);
    expect(applied.code, applied.error + applied.text).toBe(0);
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20000 });
    expect(out.exitCode, out.stderr.toString()).toBe(0);
  };
  const hook = (event: string, sid: string, fields: object = {}) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: event,
    permission_mode: "acceptEdits", prompt_id: "turn", ...fields,
  }));
  return { root, put, run, approve, git, hook };
}

const cookies = 'import { cookies } from "next/headers";\nexport default function Page() {\n  return cookies().get("theme");\n}\n';
const tag = 'import { revalidateTag } from "next/cache";\nexport function publish() {\n  revalidateTag("posts");\n}\n';
const params = "export default function Page({ params }: { params: Promise<{ slug: string }> }) {\n  return <h1>{params.slug}</h1>;\n}\n";
const namedProxy = "export function middleware(request: Request) {\n  return request;\n}\n";
const edge = 'export function middleware(request: Request) {\n  return request;\n}\n\nexport const config = { matcher: "/admin" };\n';
const nodeMiddleware = 'export const config = { runtime: "nodejs", matcher: "/admin" };\n';
const guide = "https://nextjs.org/docs/app/guides/upgrading/version-16";

test("the compiled hook denies Next 16 removals and does not deny Next 15", () => {
  const p = project();
  p.put("package.json", JSON.stringify({ dependencies: { next: "16.4.0", react: "19.0.0" } }));
  p.put("app/page.tsx", "export default function Page() { return <main>Home</main>; }\n");
  p.git("init", "-q");
  p.approve(["init", "--preview", "--preset", "legacy-safe"]);
  for (const method of ["clean-code/clean-code", "testing/tdd", "typescript/anti-evasion"]) p.approve(["pack", "disable", method, "--preview"]);
  p.put(".pregate/requests/scope.json", JSON.stringify({ why: "Exercise the Next.js pack on the App Router.", patch: [
    { op: "add", path: "/scope", value: { include: ["**"], exclude: [] } },
    { op: "add", path: "/enforcement", value: "enforce" },
  ] }));
  expect(p.run(["preset", "apply", ".pregate/requests/scope.json", "--yes"]).code).toBe(0);
  p.approve(["pack", "add", "--library", "nextjs", "--preview"]);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");

  const sid = randomUUID();
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);
  const denied = (path: string, content: string, rule: string) => {
    const check = p.run(["check", "--stdin", "--path", path], content);
    expect(check.code, check.text).toBe(1);
    expect(check.text).toContain(rule);
    expect(check.text).toContain(guide);
    const pre = p.hook("PreToolUse", sid, { tool_name: "Write", tool_use_id: randomUUID(), tool_input: { file_path: join(p.root, path), content } });
    expect(pre.code, pre.text).toBe(2);
    expect(JSON.parse(pre.text).hookSpecificOutput.permissionDecision).toBe("deny");
    expect(pre.text).toContain(rule);
    expect(pre.text).toContain("Fix:");
  };
  denied("app/page.tsx", cookies, "nextjs/NEXT-ASYNC-001");
  denied("app/actions.ts", tag, "nextjs/NEXT-REVALTAG-001");
  denied("app/blog/page.tsx", params, "nextjs/NEXT-PARAMS-001");
  denied("proxy.ts", namedProxy, "nextjs/NEXT-PROXY-001");

  const warned = p.run(["check", "--stdin", "--path", "middleware.ts"], nodeMiddleware);
  expect(warned.code, warned.text).toBe(0);
  expect(warned.text).toContain("nextjs/NEXT-PROXY-002");
  expect(warned.text).toContain(guide);
  const edgeCheck = p.run(["check", "--stdin", "--path", "src/middleware.ts"], edge);
  expect(edgeCheck.code, edgeCheck.text).toBe(0);
  expect(edgeCheck.text).not.toContain("nextjs/NEXT-PROXY");

  p.put("package.json", JSON.stringify({ dependencies: { next: "15.5.4", react: "19.0.0" } }));
  for (const [path, content, rule] of [
    ["app/page.tsx", cookies, "nextjs/NEXT-ASYNC-001"],
    ["app/actions.ts", tag, "nextjs/NEXT-REVALTAG-001"],
    ["app/blog/page.tsx", params, "nextjs/NEXT-PARAMS-001"],
    ["proxy.ts", namedProxy, "nextjs/NEXT-PROXY-001"],
    ["middleware.ts", nodeMiddleware, "nextjs/NEXT-PROXY-002"],
  ] as const) {
    const check = p.run(["check", "--stdin", "--path", path], content);
    expect(check.code, `${rule}\n${check.text}`).toBe(0);
    expect(check.text).not.toContain("PREGATE DENY");
    if (rule === "nextjs/NEXT-ASYNC-001") expect(check.text).toContain(rule);
    else expect(check.text).not.toContain(rule);
    const pre = p.hook("PreToolUse", randomUUID(), { tool_name: "Write", tool_use_id: randomUUID(), tool_input: { file_path: join(p.root, path), content } });
    expect(pre.code, pre.text).toBe(0);
    expect(pre.text).not.toContain("\"permissionDecision\":\"deny\"");
  }

  p.put("package.json", JSON.stringify({ dependencies: { next: "16.0.0-canary.8", react: "19.0.0" } }));
  const canary = p.run(["check", "--stdin", "--path", "app/blog/page.tsx"], params);
  expect(canary.code, canary.text).toBe(1);
  expect(canary.text).toContain("nextjs/NEXT-PARAMS-001");
});
