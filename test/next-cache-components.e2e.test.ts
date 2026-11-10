import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { engineAt } from "./compiled-engine.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

setDefaultTimeout(120_000);
const area = mkdtempSync(join(tmpdir(), "pregate-next-cache-"));
const binary = join(area, "engine", "version", ENGINE_FILE);
beforeAll(() => engineAt(binary, true), 120_000);
afterAll(() => removeTree(area));

function releasedCapture<T>(capture: string, descriptors: number[], body: () => T): T {
  try { return body(); } finally {
    for (const fd of descriptors) closeSync(fd);
    removeTree(capture);
  }
}

function project(files: Record<string, string>) {
  const root = join(area, randomUUID());
  mkdirSync(root);
  const env = { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(root, "home"), XDG_DATA_HOME: join(root, "data"),
    XDG_STATE_HOME: join(root, "state"), CODEX_HOME: join(root, "codex"), GROK_HOME: join(root, "grok"),
    GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com" };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  for (const [path, text] of Object.entries(files)) put(path, text);
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
      if (out.error || out.signal) throw new Error(`Candidate command ${JSON.stringify(args)} failed: ${out.error?.message ?? out.signal}\nstdout:\n${text}\nstderr:\n${error}`);
      return { code: out.status, text, error };
    });
  };
  const approve = (args: string[]) => {
    const preview = run(args);
    expect(preview.code).toBe(0);
    const digest = preview.text.match(/Digest: ([a-f0-9]{64})/)![1]!;
    const applied = run(["approve", "--yes", "--digest", digest]);
    expect(applied.code).toBe(0);
    return preview.text;
  };
  const request = (patch: unknown[]) => {
    put(".pregate/requests/test.json", JSON.stringify({ why: "Test Cache Components rules through the hook.", patch }));
    const out = run(["preset", "apply", ".pregate/requests/test.json", "--yes"]);
    expect(out.code).toBe(0);
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20000 });
    if (out.signalCode) throw new Error(`Fixture git ${JSON.stringify(args)} terminated: ${out.signalCode}; ${out.stderr.toString()}`);
    expect(out.exitCode).toBe(0);
    return out.stdout.toString().trim();
  };
  const hook = (event: string, sid: string, fields: object = {}) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: event,
    permission_mode: "acceptEdits", prompt_id: "turn", ...fields,
  }));
  return { root, put, run, approve, request, git, hook };
}

const CONFIG = `import type { NextConfig } from "next";
const nextConfig: NextConfig = { cacheComponents: true, partialPrefetching: true };
export default nextConfig;
`;
const BARE_FETCH = "const url = \"https://api.example.com/data\";\nexport async function getData() { return fetch(url); }\n";
const USE_CACHE = "const url = \"https://api.example.com/data\";\nexport async function getData() {\n  \"use cache\";\n  return fetch(url);\n}\n";

test("Cache Components rules run through rules test, check, and the Pre hook", () => {
  const p = project({ "README.md": "app\n" });
  const tested = p.run(["rules", "test", "--library", "nextjs"]);
  expect(tested.code, tested.text + tested.error).toBe(0);

  p.git("init", "-q");
  p.approve(["init", "--preview", "--preset", "integrity-only"]);
  p.approve(["pack", "add", "--library", "nextjs", "--preview"]);
  p.request([
    { op: "add", path: "/enforcement", value: "enforce" },
    { op: "add", path: "/overrides", value: { "nextjs/NEXT-CACHE-001": "deny" } },
  ]);
  p.git("add", "-A");
  p.git("commit", "-qm", "contract");
  const sid = randomUUID();
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);

  const write = (id: string, path: string, content: string) => p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: id, tool_input: { file_path: join(p.root, path), content },
  });
  const denied = (result: { code: number | null; text: string; error: string }, rule: string) => {
    expect(result.code, result.text + result.error).toBe(2);
    expect(result.text).toContain(rule);
    expect(JSON.parse(result.text).hookSpecificOutput.permissionDecision).toBe("deny");
  };
  const allowed = (result: { code: number | null; text: string; error: string }, rule: string) => {
    expect(result.code, result.text + result.error).toBe(0);
    expect(result.text).not.toContain(rule);
  };

  denied(write("bare-fetch", "src/lib/data.ts", BARE_FETCH), "nextjs/NEXT-CACHE-001");
  const stdinBare = p.run(["check", "--stdin", "--path", "src/lib/data.ts"], BARE_FETCH);
  expect(stdinBare.code, stdinBare.text).toBe(1);
  expect(stdinBare.text).toContain("nextjs/NEXT-CACHE-001");
  expect(stdinBare.text).toContain("auto no cache");

  const legacyRevalidate = "export const revalidate = false;\nexport default function Page() { return null; }\n";
  allowed(write("legacy-revalidate", "src/app/legacy/page.ts", legacyRevalidate), "nextjs/NEXT-REVAL-001");
  expect(p.run(["check", "--stdin", "--path", "src/app/legacy/page.ts"], legacyRevalidate).code).toBe(0);

  const serverDynamic = "export const dynamic = \"force-static\";\nexport default function Page() { return null; }\n";
  allowed(write("legacy-dynamic", "src/app/orders/page.tsx", serverDynamic), "nextjs/NEXT-SERVER-EXPORT-001");

  const clientDynamic = "\"use client\";\nexport const dynamic = \"force-dynamic\";\nexport default function Page() { return null; }\n";
  denied(write("client-dynamic", "src/app/client/page.tsx", clientDynamic), "nextjs/NEXT-SERVER-EXPORT-001");

  p.put("next.config.ts", CONFIG);
  allowed(write("config", "next.config.ts", CONFIG), "nextjs/NEXT-CACHE-001");
  allowed(write("cached-fetch", "src/lib/data.ts", BARE_FETCH), "nextjs/NEXT-CACHE-001");
  const stdinCached = p.run(["check", "--stdin", "--path", "src/lib/cached.ts"], USE_CACHE);
  expect(stdinCached.code, stdinCached.text).toBe(0);
  expect(stdinCached.text).not.toContain("NEXT-CACHE-001");

  const revalidate = "export const revalidate = 3600;\nexport default function Page() { return null; }\n";
  const deniedRevalidate = write("revalidate", "src/app/posts/page.ts", revalidate);
  denied(deniedRevalidate, "nextjs/NEXT-REVAL-001");
  expect(deniedRevalidate.text).toContain("cacheLife");
  const stdinRevalidate = p.run(["check", "--stdin", "--path", "src/app/posts/page.ts"], revalidate);
  expect(stdinRevalidate.code).toBe(1);
  expect(stdinRevalidate.text).toContain("nextjs/NEXT-REVAL-001");

  const tight = "export const revalidate=false;\nexport default function Page() { return null; }\n";
  denied(write("tight", "src/app/tight/page.ts", tight), "nextjs/NEXT-REVAL-001");

  const runtime = "export const runtime = \"nodejs\";\nexport function GET() { return Response.json({}); }\n";
  denied(write("runtime", "src/app/api/route.ts", runtime), "nextjs/NEXT-SERVER-EXPORT-001");
  const dynamicParams = "export const dynamicParams = false;\nexport default function Page() { return null; }\n";
  denied(write("dynamic-params", "src/app/items/page.tsx", dynamicParams), "nextjs/NEXT-SERVER-EXPORT-001");

  const stillValid = "export const maxDuration = 10;\nexport async function generateStaticParams() { return [{ slug: \"a\" }]; }\nexport default function Page() { return null; }\n";
  allowed(write("still-valid", "src/app/catalog/page.tsx", stillValid), "nextjs/NEXT-SERVER-EXPORT-001");
  expect(p.run(["check", "--stdin", "--path", "src/app/catalog/page.tsx"], stillValid).code).toBe(0);

  p.put("next.config.js", "module.exports = { cacheComponents: false };\n");
  denied(write("js-wins", "src/lib/later.ts", BARE_FETCH), "nextjs/NEXT-CACHE-001");
});
