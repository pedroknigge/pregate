import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAIL_CLOSED_SINCE } from "../src/harness/grok.ts";
import { compareVersions } from "../src/product.ts";

// Issue #45. The JSON file is the 2026-11-16 measurement of real Grok Build 1.0.77 and 1.0.70.
// It is not a model of Grok. The live describe re-runs the same questions when a real binary is
// available (PREGATE_GROK_BIN, or grok on PATH) and skips in CI, where that binary is absent.
// The live run does not download Grok.

const ROOT = join(import.meta.dir, "..");
const OBSERVED = JSON.parse(readFileSync(join(import.meta.dir, "fixtures/grok-failclosed-observed.json"), "utf8")) as {
  label: string;
  rows: { name: string; wrote: boolean; hook: string; version: string; mode: string; failClosed: boolean; where: string }[];
};

test("the recorded Grok failClosed measurement is the real 1.0.77 and 1.0.70 run (#45)", () => {
  expect(OBSERVED.label).toContain("Measured against real Grok Build");
  expect(OBSERVED.label).toContain("not a model of Grok");
  const row = (name: string) => {
    const found = OBSERVED.rows.find((item) => item.name === name);
    if (found === undefined) throw new Error(`missing observed row ${name}`);
    return found;
  };
  // (a) a deny blocks. (b) a crash or a timeout fails closed on 1.0.77 and stays open on 1.0.70.
  // (c) empty stdout still allows on 1.0.77, unlike Cursor.
  expect(row("77-deny-closed-claude")).toMatchObject({ wrote: false, hook: "RAN-deny", where: "claude" });
  expect(row("77-crash-closed-claude")).toMatchObject({ wrote: false, failClosed: true, where: "claude" });
  expect(row("77-crash-closed-grok")).toMatchObject({ wrote: false, where: "grok" });
  expect(row("77-timeout-closed-grok")).toMatchObject({ wrote: false, failClosed: true });
  expect(row("77-crash-open-grok")).toMatchObject({ wrote: true, failClosed: false });
  expect(row("77-timeout-open-grok")).toMatchObject({ wrote: true, failClosed: false });
  expect(row("77-allow-closed-claude")).toMatchObject({ wrote: true, mode: "allow", where: "claude" });
  expect(row("77-allow-closed-grok")).toMatchObject({ wrote: true, mode: "allow", where: "grok" });
  expect(row("77-badjson-closed-grok")).toMatchObject({ wrote: false, mode: "badjson" });
  expect(row("70-deny-closed-claude")).toMatchObject({ wrote: false, version: "1.0.70" });
  expect(row("70-crash-closed-claude")).toMatchObject({ wrote: true, failClosed: true, version: "1.0.70" });
  expect(row("70-allow-closed-claude")).toMatchObject({ wrote: true, version: "1.0.70" });
  for (const item of OBSERVED.rows) expect(item.hook.startsWith("RAN-")).toBe(true);
});

const bin = process.env.PREGATE_GROK_BIN || Bun.which("grok") || null;

function grokVersion(path: string): string | null {
  const result = spawnSync(path, ["--version"], { encoding: "utf8", timeout: 15_000 });
  return /(\d+\.\d+\.\d+)/.exec(result.stdout)?.[1] ?? null;
}

const version = bin === null ? null : grokVersion(bin);

function sse(events: object[]): string {
  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
}

function chunk(delta: object, finish?: string): object {
  return {
    id: "x", object: "chat.completion.chunk", created: 1_700_000_000, model: "mock-grok",
    choices: [{ index: 0, delta, ...(finish === undefined ? {} : { finish_reason: finish }) }],
  };
}

// Real Grok Build. Skipped when the binary is not on this machine. CI does not have it.
describe.skipIf(bin === null || version === null)(
  `real Grok Build ${version ?? "absent"} failClosed (skipped without PREGATE_GROK_BIN or grok on PATH; not a substitute model)`,
  () => {
    test("deny blocks, a crash or timeout follows the version, and an empty allow still passes (#45)", async () => {
      if (bin === null || version === null) throw new Error("grok binary missing");
      const closed = compareVersions(version, FAIL_CLOSED_SINCE) >= 0;
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(req) {
          if (req.method === "GET") {
            const url = new URL(req.url);
            // Grok asks GET /models, and also /v1/models. Anything that is not the key probe
            // answers with the one model this test serves.
            const probe = url.pathname === "/" || url.pathname === "/api-key" || url.pathname.endsWith("/api-key");
            const body = probe
              ? { ok: true }
              : { object: "list", data: [{ id: "mock-grok", object: "model", owned_by: "local" }] };
            return Response.json(body);
          }
          const text = await req.text();
          let messages: { role?: string; tool_calls?: unknown }[] = [];
          try {
            messages = (JSON.parse(text) as { messages?: typeof messages }).messages ?? [];
          } catch {
            messages = [];
          }
          const hasTool = messages.some((message) => message.role === "tool" || message.role === "function" || message.tool_calls !== undefined);
          if (hasTool) {
            return new Response(sse([chunk({ role: "assistant", content: "done" }), chunk({}, "stop")]), {
              headers: { "content-type": "text/event-stream" },
            });
          }
          // A relative path matches the 2026-11-16 measurement. An absolute path made this
          // build's write tool fail after the hook had already allowed it.
          const args = JSON.stringify({ file_path: "out.txt", content: "hi\n" });
          return new Response(sse([
            chunk({ role: "assistant", tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "write", arguments: "" } }] }),
            chunk({ tool_calls: [{ index: 0, function: { arguments: args } }] }),
            chunk({}, "tool_calls"),
          ]), { headers: { "content-type": "text/event-stream" } });
        },
      });
      const dirs: string[] = [];
      try {
        // spawnSync would block the mock server, so Grok's model fetch would time out.
        const run = async (mode: string, failClosed: boolean) => {
          const dir = mkdtempSync(join(tmpdir(), "pregate-grok-fc-"));
          dirs.push(dir);
          const home = join(dir, "home");
          const repo = join(dir, "repo");
          const log = join(dir, "hook.log");
          mkdirSync(join(home, ".claude"), { recursive: true });
          mkdirSync(repo, { recursive: true });
          const init = spawnSync("git", ["init"], { cwd: repo, encoding: "utf8" });
          if (init.status !== 0) throw new Error(`git init failed: ${init.stderr}`);
          const script = join(dir, "hook.sh");
          writeFileSync(script, hookScript(mode, log));
          chmodSync(script, 0o755);
          writeFileSync(join(home, ".claude/settings.json"), JSON.stringify({
            hooks: {
              PreToolUse: [{
                matcher: "write|search_replace|hashline_edit|run_terminal_command",
                hooks: [{ type: "command", command: script, timeout: mode === "timeout" ? 1 : 30, failClosed }],
              }],
            },
          }));
          const env: NodeJS.ProcessEnv = {
            ...process.env,
            HOME: home,
            GROK_HOME: join(home, ".grok"),
            XDG_DATA_HOME: join(home, ".local/share"),
            XDG_STATE_HOME: join(home, ".local/state"),
            TMPDIR: dir,
            GROK_MODELS_BASE_URL: `http://127.0.0.1:${server.port}`,
            GROK_XAI_API_BASE_URL: `http://127.0.0.1:${server.port}`,
            XAI_API_KEY: "test-key",
          };
          delete env.CLAUDE_PROJECT_DIR;
          delete env.CURSOR_PROJECT_DIR;
          delete env.GROK_WORKSPACE_ROOT;
          delete env.GROK_HOOK_EVENT;
          delete env.PREGATE_PROJECT_HOOK;
          for (const key of ["HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy"]) delete env[key];
          const target = join(repo, "out.txt");
          const proc = Bun.spawn([
            bin, "-p", "Create out.txt now.",
            "--no-auto-update", "-m", "mock-grok", "--always-approve", "--trust",
            "--max-turns", "2", "--disable-web-search", "--tools", "write",
          ], { cwd: repo, env, stdout: "pipe", stderr: "pipe" });
          const timer = setTimeout(() => proc.kill(), 25_000);
          const [stdout, stderr, grokExit] = await Promise.all([
            new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
          ]);
          clearTimeout(timer);
          return {
            wrote: existsSync(target),
            hook: existsSync(log) ? readFileSync(log, "utf8") : "",
            out: existsSync(`${log}.out`) ? readFileSync(`${log}.out`, "utf8") : "",
            grokExit, stderr: stderr.slice(-500), stdout: stdout.slice(-200),
          };
        };
        const check = async (mode: string, failClosed: boolean, wrote: boolean) => {
          const result = await run(mode, failClosed);
          const detail = JSON.stringify({ mode, failClosed, expectedWrote: wrote, result });
          expect(result.hook, detail).toContain(`RAN-${mode}`);
          expect(result.wrote, detail).toBe(wrote);
          return result;
        };
        // The product registration is the shared Claude settings file. The hook timeout of 1s is
        // only how this test provokes a harness timeout. Pregate's own Pre timeout stays 120.
        await check("deny", true, false);
        await check("allow", true, true);
        await check("crash", true, !closed);
        if (closed) {
          await check("crash", false, true);
          await check("timeout", true, false);
        }
        const engine = await check("engine", true, true);
        expect(engine.hook).toContain("exit=0");
        expect(engine.out).toBe("");
      } finally {
        server.stop(true);
        for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
      }
    }, 180_000);
  },
);

function hookScript(mode: string, log: string): string {
  const mark = `printf '%s\\n' 'RAN-${mode}' >> '${log}'`;
  if (mode === "allow") return `#!/bin/sh\n${mark}\nexit 0\n`;
  if (mode === "crash") return `#!/bin/sh\n${mark}\nexit 1\n`;
  if (mode === "timeout") return `#!/bin/sh\n${mark}\nsleep 6\nexit 0\n`;
  if (mode === "deny") {
    return `#!/bin/sh\n${mark}\nprintf '%s\\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"blocked-by-test"}}'\nprintf '%s\\n' 'blocked-by-test' >&2\nexit 2\n`;
  }
  if (mode === "engine") {
    const entry = join(ROOT, "src/main.ts");
    return `#!/bin/sh\n${mark}\n'${process.execPath}' '${entry}' hook pre > '${log}.out' 2> '${log}.err'\ncode=$?\nprintf ' exit=%s\\n' "$code" >> '${log}'\ncat '${log}.out'\ncat '${log}.err' >&2\nexit "$code"\n`;
  }
  throw new Error(`unknown hook mode ${mode}`);
}
