import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The OpenCode plugin shim, as OpenCode loads it (MULTI-HARNESS MH-25b): a folder with index.ts,
// imported by the CLI, with `setup(ctx)` registering the hooks. This runs the real file from
// assets/opencode/pregate against a fake engine, so the channel of each event is tested without a
// model call. What a real OpenCode session does with the thrown text, the appended advice, the
// instruction entry and the synthetic message stays [E2E].

const AREA = mkdtempSync(join(tmpdir(), "pregate-opencode-"));
afterAll(() => rmSync(AREA, { recursive: true, force: true }));

// The engine's answers, chosen by the tool name in the payload. `$LOG` records every call.
const ENGINE = `#!/bin/sh
event=$2
payload=$(cat)
printf '%s %s\\n' "$event" "$payload" >> "$LOG"
case $event in
pre) case $payload in *'"tool_name":"write"'*) printf '%s\\n' 'PREGATE DENY protected-path: test' >&2; exit 2 ;; esac
     printf '%s\\n' 'PREGATE ADVISOR: prefer the smaller edit'; exit 0 ;;
stop) printf '%s\\n' '{"decision":"block","reason":"finish the rule"}'; exit 0 ;;
session-start) printf '%s\\n' 'PREGATE is active: test'; exit 0 ;;
esac
exit 0
`;

// The same contract as a Windows project launcher: `pregate.cmd` is what the plugin runs, and
// PowerShell records the payload as UTF-8 so the assertions can parse it.
const ENGINE_CMD = [
  "@echo off",
  '"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0engine.ps1" %*',
  "exit /b %errorlevel%",
  "",
].join("\r\n");
const ENGINE_PS1 = [
  "$event = $args[1]",
  "$payload = [IO.StreamReader]::new([Console]::OpenStandardInput(), [Text.UTF8Encoding]::new($false)).ReadToEnd()",
  "[IO.File]::AppendAllText($env:LOG, ($event + ' ' + $payload + \"`n\"))",
  "switch ($event) {",
  '  "pre" {',
  "    if ($payload.Contains('\"tool_name\":\"write\"')) {",
  '      [Console]::Error.WriteLine("PREGATE DENY protected-path: test")',
  "      exit 2",
  "    }",
  '    [Console]::Out.WriteLine("PREGATE ADVISOR: prefer the smaller edit")',
  "    exit 0",
  "  }",
  "  \"stop\" { [Console]::Out.WriteLine('{\"decision\":\"block\",\"reason\":\"finish the rule\"}'); exit 0 }",
  '  "session-start" { [Console]::Out.WriteLine("PREGATE is active: test"); exit 0 }',
  "}",
  "exit 0",
  "",
].join("\n");

function launcherFile(root: string): string {
  return join(root, ".pregate/bin", process.platform === "win32" ? "pregate.cmd" : "pregate");
}

function installLauncher(root: string, kind: "engine" | "boom"): void {
  const dir = join(root, ".pregate/bin");
  mkdirSync(dir, { recursive: true });
  const file = launcherFile(root);
  if (process.platform === "win32") {
    if (kind === "boom") {
      writeFileSync(file, "@echo off\r\necho boom 1>&2\r\nexit /b 1\r\n");
      return;
    }
    writeFileSync(file, ENGINE_CMD);
    writeFileSync(join(dir, "engine.ps1"), ENGINE_PS1);
    return;
  }
  writeFileSync(file, kind === "boom" ? "#!/bin/sh\necho 'boom' >&2\nexit 1\n" : ENGINE);
  chmodSync(file, 0o755);
}

type Hook = (input: Record<string, unknown>) => Promise<void>;
interface Registrations { before: Hook; after: Hook; prompt: Hook; idle: Hook }
interface Side { instructions: { key: string; value: unknown }[]; synthetic: { sessionID: string; text: string; description?: string }[] }

let projects = 0;
// A project with a preset and this engine as its project launcher. `root` is the session directory.
function project(o: { preset?: boolean; projectLauncher?: boolean } = {}): { root: string; log: string } {
  const root = join(AREA, `p${++projects}`);
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  const log = join(root, "log");
  writeFileSync(log, "");
  if (o.preset !== false) {
    mkdirSync(join(root, ".pregate"), { recursive: true });
    writeFileSync(join(root, ".pregate/preset.json"), "{}\n");
  }
  if (o.projectLauncher !== false) installLauncher(root, "engine");
  process.env.LOG = log;
  return { root, log };
}

// The plugin as setup writes it: one placeholder replaced. The launcher path does not exist, so only
// the project launcher can answer.
let loads = 0;
async function plugin(directory: string): Promise<{ hooks: Registrations; side: Side }> {
  const dir = join(AREA, `plugin${++loads}`);
  mkdirSync(dir, { recursive: true });
  const source = readFileSync(join(import.meta.dir, "../assets/opencode/pregate/index.ts"), "utf8")
    .replace("@PREGATE_LAUNCHER@", join(AREA, "absent/bin/pregate"));
  const file = join(dir, "index.ts");
  writeFileSync(file, source);
  const module = await import(`${file}?v=${loads}`) as { default: { setup(ctx: unknown): Promise<void> } };
  const hooks = {} as Registrations;
  const side: Side = { instructions: [], synthetic: [] };
  const ctx = {
    location: { directory },
    tool: {
      hook: async (name: string, cb: Hook) => {
        if (name === "execute.before") hooks.before = cb; else hooks.after = cb;
        return { dispose: async () => {} };
      },
    },
    session: {
      hook: async (name: string, cb: Hook) => {
        if (name === "prompt") hooks.prompt = cb; else hooks.idle = cb;
        return { dispose: async () => {} };
      },
      instructions: { entry: { put: async (entry: { key: string; value: unknown }) => { side.instructions.push(entry); } } },
      synthetic: async (message: { sessionID: string; text: string; description?: string }) => { side.synthetic.push(message); },
    },
  };
  await module.default.setup(ctx);
  return { hooks, side };
}

const call = (name: string, input: unknown, id = "call_1", extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  tool: name, id, sessionID: "ses_1", agent: "build", messageID: "msg_1", input, status: "completed", ...extra,
});
const calls = (log: string): Record<string, any>[] => readFileSync(log, "utf8").trim().split("\n").filter((l) => l !== "")
  .map((line) => JSON.parse(line.slice(line.indexOf(" ") + 1)) as Record<string, any>);

describe("execute.before", () => {
  test("a project without a preset is inert: the engine is never spawned", async () => {
    const p = project({ preset: false });
    const { hooks } = await plugin(p.root);
    await hooks.before(call("write", { filePath: "src/a.ts", content: "x" }));
    expect(readFileSync(p.log, "utf8")).toBe("");
  });

  test("exit 2 throws the stderr text, which fails that call alone", async () => {
    const p = project();
    const { hooks } = await plugin(p.root);
    await expect(hooks.before(call("write", { filePath: "src/a.ts", content: "export const one = 1;\n" })))
      .rejects.toThrow("PREGATE DENY protected-path: test");
    expect(calls(p.log)).toEqual([{
      hook_event_name: "PreToolUse", session_id: "ses_1", cwd: p.root, tool_name: "write", tool_use_id: "call_1",
      tool_input: { filePath: join(p.root, "src/a.ts"), content: "export const one = 1;\n" }, agent_id: "build",
    }]);
  });

  test("a relative path and a missing workdir are resolved against the session directory", async () => {
    const p = project();
    const { hooks } = await plugin(p.root);
    await hooks.before(call("edit", { filePath: "src/a.ts", oldString: "a", newString: "b" }, "call_2"));
    await hooks.before(call("shell", { command: "ls" }, "call_3"));
    const pre = calls(p.log).filter((entry) => entry.hook_event_name === "PreToolUse");
    expect(pre.map((entry) => entry.tool_input)).toEqual([
      { filePath: join(p.root, "src/a.ts"), oldString: "a", newString: "b" },
      { command: "ls", workdir: p.root },
    ]);
    // The session-start attempt is bounded to one per session from a tool call.
    expect(calls(p.log).filter((entry) => entry.hook_event_name === "SessionStart")).toHaveLength(1);
  });

  test("a project with a preset and no launcher denies instead of passing", async () => {
    const p = project({ projectLauncher: false });
    const { hooks } = await plugin(p.root);
    await expect(hooks.before(call("write", { filePath: "src/a.ts", content: "x" }))).rejects.toThrow("PREGATE could not evaluate");
    expect(readFileSync(p.log, "utf8")).toBe("");
  });

  test("an engine failure that is not a deny also denies", async () => {
    const p = project();
    installLauncher(p.root, "boom");
    const { hooks } = await plugin(p.root);
    await expect(hooks.before(call("write", { filePath: "src/a.ts", content: "x" }))).rejects.toThrow("boom");
  });
});

describe("execute.after", () => {
  test("the advice of a clean pre call is appended to the tool result", async () => {
    const p = project();
    const { hooks } = await plugin(p.root);
    await hooks.before(call("edit", { filePath: "src/a.ts", oldString: "a", newString: "b" }, "call_4"));
    const result = { content: "edited" };
    await hooks.after(call("edit", {}, "call_4", { result }));
    expect(result.content).toBe("edited\n\nPREGATE ADVISOR: prefer the smaller edit");
  });

  test("a content array gains one text part, and an error result gains nothing", async () => {
    const p = project();
    const { hooks } = await plugin(p.root);
    await hooks.before(call("edit", { filePath: "src/a.ts", oldString: "a", newString: "b" }, "call_5"));
    const result: { content: { type: string; text: string }[] } = { content: [{ type: "text", text: "edited" }] };
    await hooks.after(call("edit", {}, "call_5", { result }));
    expect(result.content).toEqual([{ type: "text", text: "edited" }, { type: "text", text: "PREGATE ADVISOR: prefer the smaller edit" }]);

    await hooks.before(call("edit", { filePath: "src/a.ts", oldString: "a", newString: "b" }, "call_6"));
    const failed = { content: "unchanged" };
    await hooks.after(call("edit", {}, "call_6", { status: "error", result: failed }));
    expect(failed.content).toBe("unchanged");
  });

  test("advice is per call: a second after with the same id changes nothing", async () => {
    const p = project();
    const { hooks } = await plugin(p.root);
    await hooks.before(call("edit", { filePath: "src/a.ts", oldString: "a", newString: "b" }, "call_7"));
    const first = { content: "one" };
    await hooks.after(call("edit", {}, "call_7", { result: first }));
    const second = { content: "two" };
    await hooks.after(call("edit", {}, "call_7", { result: second }));
    expect(second.content).toBe("two");
  });
});

describe("session and Stop", () => {
  test("the first prompt stores the briefing as an instruction entry, once per session", async () => {
    const p = project();
    const { hooks, side } = await plugin(p.root);
    await hooks.prompt({ sessionID: "ses_1" });
    await hooks.prompt({ sessionID: "ses_1" });
    expect(side.instructions).toEqual([{ key: "pregate", value: "PREGATE is active: test" }]);
    expect(readFileSync(p.log, "utf8")).toContain("session-start ");
  });

  test("a Stop block is admitted with a synthetic message and a reentry flag on the next Stop", async () => {
    const p = project();
    const { hooks, side } = await plugin(p.root);
    await hooks.idle({ sessionID: "ses_1", background: [] });
    expect(side.synthetic).toEqual([{ sessionID: "ses_1", text: "finish the rule", description: "PREGATE Stop" }]);
    await hooks.idle({ sessionID: "ses_1", background: [] });
    const stops = calls(p.log).filter((payload) => payload.stop_hook_active !== undefined);
    expect(stops.map((payload) => payload.stop_hook_active)).toEqual([false, true]);
  });

  test("an empty Stop reply admits nothing", async () => {
    const p = project();
    writeFileSync(join(p.root, ".pregate/bin/pregate"), `#!/bin/sh\nprintf '%s' "$2" >> "$LOG"\nexit 0\n`);
    chmodSync(join(p.root, ".pregate/bin/pregate"), 0o755);
    const { hooks, side } = await plugin(p.root);
    await hooks.idle({ sessionID: "ses_1", background: [] });
    expect(side.synthetic).toEqual([]);
    expect(readFileSync(p.log, "utf8")).toBe("stop");
  });

  test("a project without a preset is inert for both events", async () => {
    const p = project({ preset: false });
    const { hooks, side } = await plugin(p.root);
    await hooks.prompt({ sessionID: "ses_1" });
    await hooks.idle({ sessionID: "ses_1", background: [] });
    expect(side.instructions).toEqual([]);
    expect(side.synthetic).toEqual([]);
    expect(readFileSync(p.log, "utf8")).toBe("");
  });
});
