import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { AGY_PROJECT_HOOK, agyPlugin, codexProjectTrust, cursorStopOwned, drift, exact, hookCommand, type MachineFiles, merge, registered, type Sub, type Target, unmerge } from "../src/register.ts";
import type { HarnessId } from "../src/types.ts";
import { commandScript } from "../src/windows-command.ts";
import { DATA, HOOK_COMMAND } from "./fixtures/hook-command.ts";
import { posixShell } from "./host-command.ts";

// MULTI-HARNESS §6.1 "register", over the real configs in test/fixtures/configs/ (see its README).

const real = (rel: string): string => readFileSync(`${import.meta.dir}/fixtures/configs/${rel}`, "utf8");
const CLAUDE = real("claude-settings.json");
const CODEX = real("codex-hooks.json");
const CODEX_TOML = real("codex-config.toml");
const GROK_TOML = real("grok-config.toml");
const GEMINI = real("gemini-config.json");
const ARKGATE = { ".claude/settings.json": real("arkgate/.claude/settings.json"), ".codex/hooks.json": real("arkgate/.codex/hooks.json") };
const EVENTS = ["PreToolUse", "Stop", "SessionStart"];

// Git for Windows does not put sh on PATH. Prefer sh.exe beside `git --exec-path`.
function quoteShell(): string | null {
  if (process.platform !== "win32") return "sh";
  const found = Bun.spawnSync(["git", "--exec-path"], { stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  const execPath = found.exitCode === 0 ? found.stdout.toString().trim() : "";
  return posixShell({
    platform: "win32",
    execPath: execPath === "" ? null : execPath,
    exists: existsSync,
    onPath: () => Bun.which("sh"),
  });
}

const QUOTE_SHELL = quoteShell();
if (QUOTE_SHELL === null) console.log("skip: a quote in the data path cannot break out of the command: sh.exe was not found from `git --exec-path` or on PATH");

type Json = Record<string, any>;
const obj = (text: string | null): Json => JSON.parse(text!) as Json;
const ours = (g: unknown): boolean => JSON.stringify(g).includes(`'${DATA}/bin/pregate'`);
const foreign = (text: string): Json => {
  const o = obj(text);
  for (const e of Object.keys(o.hooks ?? {})) o.hooks[e] = o.hooks[e].filter((g: unknown) => !ours(g));
  return o;
};

test("Cursor native Stop preserves foreign hooks and unregisters only ours", () => {
  const before = { version: 1, hooks: { stop: [{ command: "echo foreign", loop_limit: 3 }], preToolUse: [{ command: "echo pre" }] } };
  const text = JSON.stringify(before);
  const merged = merge(text, "cursor", DATA)!;
  expect(obj(merged).hooks.stop[0]).toEqual(before.hooks.stop[0]);
  expect(obj(merged).hooks.preToolUse).toEqual(before.hooks.preToolUse);
  expect(cursorStopOwned(merged, DATA)).toBe(true);
  expect(merge(merged, "cursor", DATA)).toBe(merged);
  expect(obj(unmerge(merged, "cursor", DATA)!.text)).toEqual(before);
  expect(cursorStopOwned(JSON.stringify({ ...obj(merged), version: 0 }), DATA)).toBe(false);
  expect(merge('{"version":0,"hooks":{}}', "cursor", DATA)).toBeNull();
});

describe("hookCommand", () => {
  test("is the frozen MH-22 text, byte for byte", () => {
    for (const [line, text] of Object.entries(HOOK_COMMAND)) {
      const [sub, h] = line.split(" ") as [Sub, HarnessId];
      expect(hookCommand(DATA, sub, h)).toBe(text);
    }
  });

  test.skipIf(QUOTE_SHELL === null)("a quote in the data path cannot break out of the command", () => {
    const shell = QUOTE_SHELL;
    if (shell === null) throw new Error("sh.exe was not found from `git --exec-path` or on PATH");
    const cmd = hookCommand("/Users/o'neil/.local/share/pregate", "stop", "codex");
    expect(cmd.startsWith(`f='/Users/o'\\''neil/.local/share/pregate/bin/pregate'; `)).toBe(true);
    const r = Bun.spawnSync([shell, "-c", `${cmd.replace(/; \[ -x.*/, "")}; printf %s "$f"`]);
    expect(r.stdout.toString()).toBe("/Users/o'neil/.local/share/pregate/bin/pregate");
  });
});

describe("merge", () => {
  for (const [t, text] of [["shared", CLAUDE], ["codex", CODEX]] as const) {
    test(`${t}: foreign groups and keys stay deep-equal and in place; ours go last and are exact`, () => {
      const merged = merge(text, t, DATA)!;
      expect(foreign(merged)).toEqual(obj(text));
      expect(Object.keys(obj(merged))).toEqual(Object.keys(obj(text)));
      for (const e of EVENTS) {
        const groups = obj(merged).hooks[e];
        expect(groups.length).toBe((obj(text).hooks[e] ?? []).length + 1);
        expect(exact(groups.at(-1), t, DATA)).toBe(true);
      }
    });

    test(`${t}: the second run returns the same bytes, so nothing is written`, () => {
      const once = merge(text, t, DATA)!;
      expect(merge(once, t, DATA)).toBe(once);
    });

    test(`${t}: an unchanged content keeps the file's own formatting`, () => {
      const compact = JSON.stringify(obj(merge(text, t, DATA)));
      expect(merge(compact, t, DATA)).toBe(compact);
    });

    test(`${t}: an older group of ours is replaced in place, and is not exact before that`, () => {
      const old = obj(merge(text, t, DATA));
      const stale = { ...old.hooks.PreToolUse.at(-1), hooks: [{ ...old.hooks.PreToolUse.at(-1).hooks[0], timeout: 10 }] };
      expect(exact(stale, t, DATA)).toBe(false);
      const foreignGroup = { hooks: [{ type: "command", command: "/usr/local/bin/after", timeout: 5 }] };
      old.hooks.PreToolUse.splice(-1, 1, stale, foreignGroup);
      const again = obj(merge(JSON.stringify(old), t, DATA));
      expect(again.hooks.PreToolUse.at(-2)).toEqual(obj(merge(text, t, DATA)).hooks.PreToolUse.at(-1));
      expect(again.hooks.PreToolUse.at(-1)).toEqual(foreignGroup);
    });
  }

  test("a group mixing a foreign handler with ours is foreign: left whole, ours added", () => {
    const ourHandler = obj(merge(null, "shared", DATA)).hooks.Stop[0].hooks[0];
    const mixed = { hooks: [{ type: "command", command: "/usr/local/bin/other", timeout: 5 }, ourHandler] };
    const merged = obj(merge(JSON.stringify({ hooks: { Stop: [mixed] } }), "shared", DATA));
    expect(merged.hooks.Stop[0]).toEqual(mixed);
    expect(exact(merged.hooks.Stop[1], "shared", DATA)).toBe(true);
  });

  test("a file that does not exist gets only our groups", () => {
    const fresh = obj(merge(null, "codex", DATA));
    expect(Object.keys(fresh)).toEqual(["hooks"]);
    expect(fresh.hooks.PreToolUse).toEqual([{ matcher: "^(apply_patch|Bash)$", hooks: [{ type: "command", command: HOOK_COMMAND["pre codex"], timeout: 120 }] }]);
    expect(fresh.hooks.Stop).toEqual([{ hooks: [{ type: "command", command: HOOK_COMMAND["stop codex"], timeout: 60 }] }]);
    expect(fresh.hooks.SessionStart).toEqual([{ hooks: [{ type: "command", command: HOOK_COMMAND["session-start codex"], timeout: 15 }] }]);
    expect(obj(merge(null, "shared", DATA)).hooks.PreToolUse[0].matcher)
      .toBe("Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor|Delete|apply_patch|edit|bash|write|search_replace|hashline_edit|run_terminal_command");
    const matcher = new RegExp(obj(merge(null, "shared", DATA)).hooks.PreToolUse[0].matcher);
    for (const tool of ["write", "search_replace", "hashline_edit", "run_terminal_command"]) expect(matcher.test(tool)).toBe(true);
  });

  for (const bad of ["{", "[]", "null", '{"hooks":[]}', '{"hooks":{"Stop":{}}}']) {
    test(`not writable: ${bad}`, () => {
      for (const t of ["shared", "codex"] as Target[]) {
        expect(merge(bad, t, DATA)).toBeNull();
        expect(unmerge(bad, t, DATA)).toBeNull();
      }
    });
  }
});

describe("unmerge", () => {
  for (const [t, text] of [["shared", CLAUDE], ["codex", CODEX]] as const) {
    test(`${t}: leaves the file deep-equal to before setup`, () => {
      expect(obj(unmerge(merge(text, t, DATA)!, t, DATA)!.text)).toEqual(obj(text));
      expect(unmerge(merge(text, t, DATA)!, t, DATA)!.shifted).toEqual([]);
    });

    test(`${t}: without groups of ours, the bytes stay`, () => {
      expect(unmerge(text, t, DATA)).toEqual({ text, shifted: [] });
    });
  }

  test("codex: lists the keys of the foreign groups added after ours, now one index lower", () => {
    const merged = obj(merge(CODEX, "codex", DATA));
    merged.hooks.PreToolUse.push({ matcher: "*", hooks: [{ type: "command", command: "a" }, { type: "command", command: "b" }] });
    merged.hooks.Stop.push({ hooks: [{ type: "command", command: "c" }] });
    expect(unmerge(JSON.stringify(merged), "codex", DATA)!.shifted).toEqual(["pre_tool_use:1:0", "pre_tool_use:1:1", "stop:1:0"]);
  });

  test("a file setup created comes back empty", () => {
    expect(obj(unmerge(merge(null, "shared", DATA)!, "shared", DATA)!.text)).toEqual({});
    expect(obj(unmerge(merge('{"permissions":{}}', "shared", DATA)!, "shared", DATA)!.text)).toEqual({ permissions: {} });
  });
});

describe("agy", () => {
  test("the plugin: one named hook, enabled, Pre grouped and PostInvocation/Stop/SessionStart flat", () => {
    const plugin = agyPlugin(DATA, pkg.version);
    expect(Object.keys(plugin).sort()).toEqual(["hooks.json", "plugin.json"]);
    expect(obj(plugin["plugin.json"]!)).toEqual({
      name: "pregate-global",
      version: pkg.version,
      description: "Pre-execution architectural and integrity gate for AI coding agents.",
    });
    expect(obj(plugin["hooks.json"]!)).toEqual({
      "pregate-global": {
        enabled: true,
        PreToolUse: [{
          matcher: "^(write_to_file|replace_file_content|multi_replace_file_content|write_file|edit_file|create_file|delete_file|rename_file|notebook_edit|run_command|send_command_input|manage_task)$",
          hooks: [{ type: "command", command: HOOK_COMMAND["pre agy"], timeout: 120 }],
        }],
        PostInvocation: [{ type: "command", command: HOOK_COMMAND["post-invocation agy"], timeout: 15 }],
        Stop: [{ type: "command", command: HOOK_COMMAND["stop agy"], timeout: 60 }],
        SessionStart: [{ type: "command", command: HOOK_COMMAND["session-start agy"], timeout: 15 }],
      },
    });
    expect(merge(null, "agy", DATA)).toBe(plugin["hooks.json"]!);
    const agyBin = Bun.which("agy");
    if (agyBin !== null) {
      const scratch = mkdtempSync(join(tmpdir(), "pregate-agy-validate-"));
      const dir = join(scratch, "pregate-global");
      mkdirSync(dir);
      for (const [f, text] of Object.entries(plugin)) writeFileSync(join(dir, f), text);
      try {
        const v = Bun.spawnSync([agyBin, "plugin", "validate", dir, "--json"], { stdout: "pipe", stderr: "pipe", timeout: 15_000 });
        expect(v.exitCode, v.stderr.toString()).toBe(0);
        const report = JSON.parse(v.stdout.toString()) as { name: string; components: { hooks: number }; findings: { severity: string }[] };
        expect(report).toMatchObject({ name: "pregate-global", components: { hooks: 1 } });
        expect(report.findings.filter((f) => f.severity !== "note")).toEqual([]);
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }
  });

  test("merge and unmerge own the pregate key only", () => {
    const orca = { "orca-status": { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "x" }] }] } };
    const merged = merge(JSON.stringify(orca), "agy", DATA)!;
    expect(obj(merged)["orca-status"]).toEqual(orca["orca-status"]);
    expect(obj(unmerge(merged, "agy", DATA)!.text)).toEqual(orca);
    const h = obj(merged)["pregate-global"];
    expect(exact(h.PreToolUse[0], "agy", DATA) && exact(h.PostInvocation[0], "agy", DATA) && exact(h.Stop[0], "agy", DATA) && exact(h.SessionStart[0], "agy", DATA)).toBe(true);
  });

  test("project-agy owns pregate-project only, walks up from PWD or workspacePaths[0], and is accepted by drift", () => {
    const foreign = { "team-hook": { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "sh lint.sh" }] }] } };
    const merged = merge(JSON.stringify(foreign), "project-agy", DATA)!;
    expect(merge(merged, "project-agy", DATA)).toBe(merged);
    expect(obj(merged)["team-hook"]).toEqual(foreign["team-hook"]);
    expect(obj(unmerge(merged, "project-agy", DATA)!.text)).toEqual(foreign);
    const h = obj(merged)[AGY_PROJECT_HOOK];
    expect(h.PreToolUse[0].matcher).toContain("manage_task");
    expect(h.PreToolUse[0].hooks[0].command).toContain("hook pre --harness agy");
    expect(h.PostInvocation[0].command).toContain("hook post-invocation --harness agy");
    expect(h.Stop[0].command).toContain("hook stop --harness agy");
    expect(h.SessionStart[0].command).toContain("hook session-start --harness agy");
    expect(drift({ claude: [], cursorHooks: null, codexHooks: null, codexConfig: null, grokConfig: null, agyHooks: null, agyConfig: null }, { ".agents/hooks.json": merged }, DATA, {})).toEqual([]);
  });
});

test("exact: an extra key, another timeout or another matcher is not ours", () => {
  const g = obj(merge(null, "codex", DATA)).hooks.PreToolUse[0];
  expect(exact(g, "codex", DATA)).toBe(true);
  expect(exact({ ...g, statusMessage: "x" }, "codex", DATA)).toBe(false);
  expect(exact({ ...g, matcher: "*" }, "codex", DATA)).toBe(false);
  expect(exact({ ...g, hooks: [{ ...g.hooks[0], timeout: 600 }] }, "codex", DATA)).toBe(false);
  expect(exact(g, "shared", DATA)).toBe(false);
  expect(exact(g, "codex", "/other/pregate")).toBe(false);
});

describe("drift", () => {
  const CODEX_FILE = "/Users/user/.codex/hooks.json";
  const HASH = { PreToolUse: "sha256:aa", Stop: "sha256:bb", SessionStart: "sha256:cc" };
  const TRUST = { [`${CODEX_FILE}:pre_tool_use:1:0`]: HASH.PreToolUse, [`${CODEX_FILE}:stop:1:0`]: HASH.Stop, [`${CODEX_FILE}:session_start:1:0`]: HASH.SessionStart };
  const trusted = `${CODEX_TOML}${Object.entries(TRUST).map(([k, v]) => `\n[hooks.state."${k}"]\ntrusted_hash = "${v}"\n`).join("")}`;
  const gemini = (enabled: boolean): string => JSON.stringify({ plugins: { ...obj(GEMINI).plugins, "pregate-global": { enabled } } });
  const clean = (): MachineFiles => ({
    claude: [merge(CLAUDE, "shared", DATA)], cursorHooks: null, codexHooks: merge(CODEX, "codex", DATA), codexConfig: trusted,
    grokConfig: GROK_TOML, agyHooks: agyPlugin(DATA, pkg.version)["hooks.json"]!, agyConfig: gemini(true),
  });
  const problems = (change: Partial<MachineFiles>, repo: Record<string, string> | null = null, trust: Record<string, string> = TRUST): string[] =>
    drift({ ...clean(), ...change }, repo, DATA, trust);

  test("a machine as setup leaves it, with ArkGate in the repo: nothing", () => {
    expect(problems({}, ARKGATE)).toEqual([]);
  });

  test("a machine without Codex, Grok or agy: nothing", () => {
    expect(drift({ claude: [merge(CLAUDE, "shared", DATA)], cursorHooks: null, codexHooks: null, codexConfig: null, grokConfig: null, agyHooks: null, agyConfig: null }, null, DATA, {}))
      .toEqual([]);
  });

  test("shared registration missing, changed, or every hook switched off", () => {
    const noStop = obj(merge(CLAUDE, "shared", DATA));
    noStop.hooks.Stop.pop();
    expect(problems({ claude: [JSON.stringify(noStop)] })).toEqual(["~/.claude/settings.json: PREGATE hooks missing or modified (Stop); run pregate setup."]);
    expect(problems({ claude: [merge(CLAUDE, "shared", DATA), null] })).toEqual([
      "$CLAUDE_CONFIG_DIR/settings.json: PREGATE hooks missing or modified (PreToolUse, Stop, SubagentStop, SessionStart, SubagentStart); run pregate setup.",
    ]);
    const off = { ...obj(merge(CLAUDE, "shared", DATA)), disableAllHooks: true };
    expect(problems({ claude: [JSON.stringify(off)] })).toEqual(["~/.claude/settings.json: disableAllHooks disables all hooks, including PREGATE."]);
  });

  test("codex: registration missing, file gone after trust, trust removed or changed, index shifted", () => {
    const pre = (m: string[]) => m.filter((p) => p.includes("PreToolUse"));
    expect(pre(problems({ codexHooks: CODEX }))).toEqual(["Codex hooks.json: PREGATE PreToolUse hook missing or modified; run pregate setup."]);
    expect(problems({ codexHooks: null })).toHaveLength(3);
    expect(problems({ codexHooks: null }, null, {})).toEqual([]);
    const lost = "Codex does not run PREGATE PreToolUse: setup trust was removed or its index changed. Run pregate setup.";
    expect(problems({ codexConfig: trusted.replace(HASH.PreToolUse, "sha256:ff") })).toEqual([lost]);
    expect(problems({ codexConfig: CODEX_TOML })).toHaveLength(3);
    expect(problems({}, null, {})).toHaveLength(3);
    const shifted = obj(merge(CODEX, "codex", DATA));
    shifted.hooks.PreToolUse.unshift({ hooks: [{ type: "command", command: "/usr/local/bin/first" }] });
    expect(problems({ codexHooks: JSON.stringify(shifted) })).toEqual([lost]);
  });

  test("codex and grok switches in their config.toml, in each TOML spelling", () => {
    const codexOff = "Codex config.toml: [features] hooks = false disables all Codex hooks.";
    expect(problems({ codexConfig: trusted.replace("goals = true", "goals = true\nhooks = false") })).toEqual([codexOff]);
    expect(problems({ codexConfig: `features.hooks = false # off\n${trusted}` })).toEqual([codexOff]);
    expect(problems({ codexConfig: `note = """\n[features]\nhooks = false\n"""\n${trusted}` })).toEqual([]);
    const grokOff = "Grok config.toml: [compat.claude] hooks = false ignores ~/.claude/settings.json, including PREGATE.";
    expect(problems({ grokConfig: `${GROK_TOML}\n[compat.claude]\nhooks = false\n` })).toEqual([grokOff]);
    expect(problems({ grokConfig: `${GROK_TOML}\n[compat]\nclaude.hooks = false\n` })).toEqual([grokOff]);
    expect(problems({ grokConfig: `${GROK_TOML}\n[[compat.claude]]\nhooks = false\n` })).toEqual([]);
  });

  test("agy: plugin disabled, changed, or gone while config.json still names it", () => {
    expect(problems({ agyConfig: gemini(false) })).toEqual([
      "agy: pregate-global is disabled (plugins.pregate-global.enabled = false in ~/.gemini/config/config.json); enable it.",
    ]);
    const changed = obj(agyPlugin(DATA, pkg.version)["hooks.json"]!);
    changed["pregate-global"].enabled = false;
    const gone = "agy: pregate-global plugin missing or modified; run pregate setup.";
    expect(problems({ agyHooks: JSON.stringify(changed) })).toEqual([gone]);
    expect(problems({ agyHooks: null })).toEqual([gone]);
    expect(problems({ agyHooks: null, agyConfig: GEMINI })).toEqual([]);
  });

  test("repo files that switch hooks off", () => {
    expect(problems({}, {
      ...ARKGATE,
      ".claude/settings.local.json": '{"disableAllHooks":true}',
      ".codex/config.toml": "[features]\nhooks = false\n",
      ".agents/plugins/pregate/plugin.json": '{"name":"pregate"}',
      "_agent/plugins.json": '{"pregate":{"enabled":false}}',
      ".agents/hooks.json": '{"ark-write-gate":{}}',
      ".agents/skills/x/SKILL.md": "pregate",
    })).toEqual([
      ".claude/settings.local.json: disableAllHooks disables PREGATE hooks in this repo.",
      ".codex/config.toml: [features] hooks = false disables Codex hooks in this repo.",
      ".agents/plugins/pregate/plugin.json: names pregate and may disable its agy plugin in this repo.",
      "_agent/plugins.json: names pregate and may disable its agy plugin in this repo.",
    ]);
  });
});

// The project registration (`pregate project hooks`): the same merge, on the project launcher.
describe("project", () => {
  const WINDOWS_DATA = "C:/Users/user/AppData/Local/pregate";
  const commands = (text: string | null): string[] => Object.values(obj(text).hooks as Record<string, Json[]>).flatMap((groups) => groups.flatMap((g) => g.hooks.map((h: Json) => h.command as string)));

  test("holds the events, matcher and timeouts of the global registration, and no machine path", () => {
    const project = obj(merge(null, "project", DATA)), shared = obj(merge(null, "shared", DATA));
    expect(Object.keys(project.hooks)).toEqual(Object.keys(shared.hooks));
    expect(project.hooks.PreToolUse[0].matcher).toBe(shared.hooks.PreToolUse[0].matcher);
    for (const event of Object.keys(shared.hooks)) expect(project.hooks[event][0].hooks[0].timeout).toBe(shared.hooks[event][0].hooks[0].timeout);
    expect(project.hooks.PreToolUse[0].hooks[0].command).toBe(
      `f="\${CLAUDE_PROJECT_DIR:-.}/.pregate/bin/pregate"; [ -x "$f" ] && [ -s "$f" ] && exec "$f" hook pre --harness claude-code; printf '%s\\n' 'PREGATE could not evaluate: the project launcher is missing; restore .pregate/bin or run pregate project launcher; report it to the user' >&2; exit 2`);
    expect(project.hooks.Stop[0].hooks[0].command).toBe(`f="\${CLAUDE_PROJECT_DIR:-.}/.pregate/bin/pregate"; [ -x "$f" ] && [ -s "$f" ] && exec "$f" hook stop --harness claude-code; exit 0`);
    for (const command of [...commands(merge(null, "project", DATA)), ...commands(merge(null, "project", WINDOWS_DATA))]) {
      expect(commandScript(command)).not.toContain(DATA);
      expect(commandScript(command)).not.toContain("AppData");
    }
  });

  test("the Windows form runs project-launcher.ps1 from PowerShell and fits a cmd.exe line", () => {
    for (const command of commands(merge(null, "project", WINDOWS_DATA))) {
      expect(command).toMatch(/^powershell\.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand [A-Za-z0-9+/=]+$/);
      expect(command.length).toBeLessThan(8191);
      expect(commandScript(command)).toContain("$f=Join-Path $d '.pregate/bin/project-launcher.ps1'; if (Test-Path -LiteralPath $f -PathType Leaf) { $raw | & $f hook ");
    }
    const pre = commandScript(obj(merge(null, "project", WINDOWS_DATA)).hooks.PreToolUse[0].hooks[0].command);
    expect(pre).toEndWith("the project launcher is missing; restore .pregate/bin or run pregate project launcher; report it to the user'); exit 2");
  });

  test("is idempotent, keeps foreign groups in place, and is undone by unmerge", () => {
    const merged = merge(CLAUDE, "project", DATA)!;
    expect(merge(merged, "project", DATA)).toBe(merged);
    expect(obj(merged).hooks.PreToolUse.slice(0, -1)).toEqual(obj(CLAUDE).hooks.PreToolUse);
    expect(obj(unmerge(merged, "project", DATA)!.text)).toEqual(obj(CLAUDE));
    expect(merge("[]", "project", DATA)).toBeNull();
  });

  test("replaces a registration of the other platform and of 0.1.0; the two scopes do not own each other", () => {
    const windows = merge(null, "project", WINDOWS_DATA)!;
    expect(merge(windows, "project", DATA)).toBe(merge(null, "project", DATA)!);
    const old = { hooks: { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: `f="$CLAUDE_PROJECT_DIR/.pregate/bin/pregate"; [ -f "$f" ] && exec "$f" hook pre` }] }] } };
    expect(obj(merge(JSON.stringify(old), "project", DATA)).hooks.PreToolUse).toEqual(obj(merge(null, "project", DATA)).hooks.PreToolUse);
    // A file that holds both scopes keeps both: each merge and unmerge touches its own groups only.
    const both = merge(merge(null, "shared", DATA), "project", DATA)!;
    expect(obj(both).hooks.PreToolUse).toHaveLength(2);
    expect(merge(both, "shared", DATA)).toBe(both);
    expect(obj(unmerge(both, "shared", DATA)!.text)).toEqual(obj(merge(null, "project", DATA)));
    expect(obj(unmerge(both, "project", DATA)!.text)).toEqual(obj(merge(null, "shared", DATA)));
  });

  test("the Codex project registration holds the global Codex events, matcher and timeouts, and finds the launcher from the working directory", () => {
    const project = obj(merge(null, "project-codex", DATA)), global = obj(merge(null, "codex", DATA));
    expect(Object.keys(project.hooks)).toEqual(Object.keys(global.hooks));
    expect(project.hooks.PreToolUse[0].matcher).toBe(global.hooks.PreToolUse[0].matcher);
    for (const event of Object.keys(global.hooks)) expect(project.hooks[event][0].hooks[0].timeout).toBe(global.hooks[event][0].hooks[0].timeout);
    expect(project.hooks.PreToolUse[0].hooks[0].command).toBe(
      `d=$PWD; while [ -n "$d" ]; do f="$d/.pregate/bin/pregate"; [ -x "$f" ] && [ -s "$f" ] && cd "$d" && exec "$f" hook pre --harness codex; [ -e "$d/.git" ] && break; d=\${d%/*}; done; printf '%s\\n' 'PREGATE could not evaluate: the project launcher is missing; restore .pregate/bin or run pregate project launcher; report it to the user' >&2; exit 2`);
    expect(project.hooks.Stop[0].hooks[0].command).toEndWith(`exec "$f" hook stop --harness codex; [ -e "$d/.git" ] && break; d=\${d%/*}; done; exit 0`);
    for (const command of [...commands(merge(null, "project-codex", DATA)), ...commands(merge(null, "project-codex", WINDOWS_DATA))]) {
      expect(commandScript(command)).not.toContain(DATA);
      expect(commandScript(command)).not.toContain("AppData");
    }
    for (const command of commands(merge(null, "project-codex", WINDOWS_DATA))) {
      expect(command).toMatch(/^powershell\.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand [A-Za-z0-9+/=]+$/);
      expect(command.length).toBeLessThan(8191);
      expect(commandScript(command)).toContain("$f=Join-Path $d '.pregate/bin/project-launcher.ps1'; if (Test-Path -LiteralPath $f -PathType Leaf) { Set-Location -LiteralPath $d; $raw | & $f hook ");
    }
  });

  test("the Codex project registration is idempotent, replaces the other platform's, and does not own the other registrations", () => {
    const foreign = JSON.stringify({ hooks: { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "sh audit.sh --harness codex" }] }] } });
    const merged = merge(foreign, "project-codex", DATA)!;
    expect(merge(merged, "project-codex", DATA)).toBe(merged);
    expect(obj(merged).hooks.PreToolUse[0]).toEqual(obj(foreign).hooks.PreToolUse[0]);
    expect(obj(unmerge(merged, "project-codex", DATA)!.text)).toEqual(obj(foreign));
    expect(merge(merge(null, "project-codex", WINDOWS_DATA), "project-codex", DATA)).toBe(merge(null, "project-codex", DATA)!);
    // The global Codex groups and the Claude Code project groups belong to their own targets.
    for (const other of ["codex", "project"] as const) {
      const both = merge(merge(null, other, DATA), "project-codex", DATA)!;
      expect(obj(both).hooks.PreToolUse).toHaveLength(2);
      expect(obj(unmerge(both, "project-codex", DATA)!.text)).toEqual(obj(merge(null, other, DATA)));
      expect(obj(unmerge(both, other, DATA)!.text)).toEqual(obj(merge(null, "project-codex", DATA)));
    }
  });

  test("the Cursor project registration is native: version 1, flat entries, no failClosed, and no machine path", () => {
    const project = obj(merge(null, "project-cursor", DATA));
    expect(project.version).toBe(1);
    expect(Object.keys(project.hooks)).toEqual(["preToolUse", "stop", "sessionStart"]);
    expect(project.hooks.preToolUse).toEqual([{
      type: "command", timeout: 120, matcher: "^(Write|Delete|Shell)$|^MCP:",
      command: `f="\${CURSOR_PROJECT_DIR:-.}/.pregate/bin/pregate"; [ -x "$f" ] && [ -s "$f" ] && exec "$f" hook pre --harness cursor; printf '%s\\n' 'PREGATE could not evaluate: the project launcher is missing; restore .pregate/bin or run pregate project launcher; report it to the user' >&2; exit 2`,
    }]);
    expect(project.hooks.stop[0]).toMatchObject({ timeout: 60, loop_limit: null, command: `f="\${CURSOR_PROJECT_DIR:-.}/.pregate/bin/pregate"; [ -x "$f" ] && [ -s "$f" ] && exec "$f" hook stop --harness cursor; exit 0` });
    const flat = (text: string | null): string[] => Object.values(obj(text).hooks as Record<string, Json[]>).flatMap((list) => list.map((h) => h.command as string));
    for (const command of [...flat(merge(null, "project-cursor", DATA)), ...flat(merge(null, "project-cursor", WINDOWS_DATA))]) {
      expect(commandScript(command)).not.toContain(DATA);
      expect(commandScript(command)).not.toContain("AppData");
      expect(commandScript(command)).not.toContain("CLAUDE_PROJECT_DIR");
    }
    for (const command of flat(merge(null, "project-cursor", WINDOWS_DATA))) {
      expect(command).toMatch(/^powershell\.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand [A-Za-z0-9+/=]+$/);
      expect(commandScript(command)).toContain("$d=if ($env:CURSOR_PROJECT_DIR) { $env:CURSOR_PROJECT_DIR } else { (Get-Location).Path }");
    }
    expect(merge('{"version":0,"hooks":{}}', "project-cursor", DATA)).toBeNull();
  });

  test("the Cursor project registration is idempotent, keeps foreign entries, and does not own the other registrations", () => {
    const foreign = JSON.stringify({ version: 1, hooks: { preToolUse: [{ command: "sh .cursor/hooks/audit.sh --harness cursor" }], stop: [{ command: "afplay done.aiff" }] } });
    const merged = merge(foreign, "project-cursor", DATA)!;
    expect(merge(merged, "project-cursor", DATA)).toBe(merged);
    expect(obj(merged).hooks.preToolUse[0]).toEqual(obj(foreign).hooks.preToolUse[0]);
    expect(obj(unmerge(merged, "project-cursor", DATA)!.text)).toEqual(obj(foreign));
    expect(merge(merge(null, "project-cursor", WINDOWS_DATA), "project-cursor", DATA)).toBe(merge(null, "project-cursor", DATA)!);
    // The machine's native Cursor Stop belongs to `cursor`, the project's to `project-cursor`.
    const both = merge(merge(null, "cursor", DATA), "project-cursor", DATA)!;
    expect(obj(both).hooks.stop).toHaveLength(2);
    expect(obj(unmerge(both, "project-cursor", DATA)!.text)).toEqual(obj(merge(null, "cursor", DATA)));
    expect(obj(unmerge(both, "cursor", DATA)!.text)).toEqual(obj(merge(null, "project-cursor", DATA)));
    expect(registered(merge(null, "project-cursor", DATA), "project-cursor", DATA)).toBe(true);
    expect(registered(merge(null, "project", DATA), "project-cursor", DATA)).toBe(false);
  });

  test("codexProjectTrust reads the trust level of one project directory and nothing about a hook", () => {
    const config = `model = "x"\n[projects."/home/user/repo"]\ntrust_level = "trusted"\n[projects.'C:\\Users\\user\\repo']\ntrust_level = "untrusted"\n[hooks.state."/home/user/other/.codex/hooks.json:pre_tool_use:0:0"]\ntrusted_hash = "sha256:1"\n`;
    expect(codexProjectTrust(config, "/home/user/repo")).toBe("trusted");
    expect(codexProjectTrust(config, "C:/Users/user/repo")).toBe("untrusted");
    expect(codexProjectTrust(config, "/home/user/other")).toBeNull();
    expect(codexProjectTrust(null, "/home/user/repo")).toBeNull();
  });
});
