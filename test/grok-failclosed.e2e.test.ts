import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { FAIL_CLOSED_SINCE } from "../src/harness/grok.ts";
import { HARNESSES } from "../src/harness/profile.ts";
import { exact } from "../src/register.ts";
import { grokPreToolUseGate } from "./fixtures/grok-pretooluse-gate.ts";
import type { HarnessId } from "../src/types.ts";

// Grok Build >= 1.0.71 failClosed on the shared PreToolUse handler: setup writes the key, Claude and
// Cursor keep loading the file, and the Grok Pre gate denies hook crash and timeout when failClosed is
// true (exercised through the documented Grok PreToolUse contract).

setDefaultTimeout(120_000);

const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-grok-failclosed-")));
const BIN = join(TMP, "dist/pregate");
const CONFIGS = join(import.meta.dir, "fixtures/configs");
const APP_SERVER = join(import.meta.dir, "fixtures/codex-app-server.ts");
const PAYLOAD = readFileSync(join(import.meta.dir, "payloads/grok/pre-write.json"), "utf8");
const TOOLS = ["cp", "git", "gzip", "mkdir", "rm", "sed", "sh", "tar"];

const version = (h: HarnessId, text: string): string => `#!/bin/sh\n[ "$1" = --version ] && echo '${text.replace("@", HARNESSES[h].VERIFIED)}'\nexit 0\n`;
const FAKES: Record<HarnessId, string> = {
  "claude-code": version("claude-code", "@ (Claude Code)"),
  cursor: version("cursor", "@"),
  grok: version("grok", "grok @"),
  codex: `#!/bin/sh\n[ "$1" = --version ] && { echo 'codex-cli ${HARNESSES.codex.VERIFIED}'; exit 0; }\nexec '${process.execPath}' '${APP_SERVER}' "$@"\n`,
  agy: version("agy", "@"),
};

type Json = Record<string, unknown>;
interface Out { code: number | null; stdout: string; stderr: string }
interface Machine {
  root: string; home: string; data: string; env: Record<string, string>;
  settings: string; hooks: string;
}

let machines = 0;

beforeAll(() => compileBinary(hostTarget(), BIN));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

function put(path: string, text: string, mode = 0o644): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { mode });
  chmodSync(path, mode);
}

function machine(found: HarnessId[]): Machine {
  const root = join(TMP, `m${++machines}`);
  const home = join(root, "home");
  const codex = join(home, ".codex");
  const bin = join(root, "bin");
  for (const d of [bin, join(root, "tmp"), join(home, ".config"), join(home, ".cache")]) mkdirSync(d, { recursive: true });
  for (const name of TOOLS) {
    const tool = Bun.which(name);
    if (tool === null) throw new Error(`${name} is required by the grok failClosed e2e`);
    symlinkSync(tool, join(bin, name));
  }
  const env: Record<string, string> = {
    HOME: home, XDG_DATA_HOME: join(home, ".local/share"), XDG_STATE_HOME: join(home, ".local/state"),
    XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: join(home, ".cache"), TMPDIR: join(root, "tmp"),
    CODEX_HOME: codex, GROK_HOME: join(home, ".grok"), PATH: `${bin}:${home}/.local/bin`, SHELL: "/bin/zsh",
    CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
  };
  const settings = join(home, ".claude/settings.json");
  const hooks = join(codex, "hooks.json");
  const configs: Record<HarnessId, [string, string][]> = {
    "claude-code": [["claude-settings.json", settings]],
    cursor: [],
    grok: [["grok-config.toml", join(home, ".grok/config.toml")]],
    codex: [["codex-hooks.json", hooks], ["codex-config.toml", join(codex, "config.toml")]],
    agy: [["gemini-config.json", join(home, ".gemini/config/config.json")]],
  };
  for (const h of found) {
    for (const [from, to] of configs[h]) put(to, readFileSync(join(CONFIGS, from), "utf8"));
    const name = { "claude-code": "claude", codex: "codex", cursor: "cursor-agent", grok: "grok", agy: "agy" }[h]!;
    put(join(bin, name), FAKES[h], 0o755);
  }
  if (found.includes("codex")) ok(run(["codex", "trust-all"], { root, home, data: join(env.XDG_DATA_HOME!, "pregate"), env, settings, hooks }), "trust-all");
  return { root, home, data: join(env.XDG_DATA_HOME!, "pregate"), env, settings, hooks };
}

function run(cmd: string[], m: Machine, stdin = "", cwd = m.home): Out {
  const r = Bun.spawnSync(cmd, { cwd, env: m.env, stdin: stdin === "" ? "ignore" : Buffer.from(stdin), stdout: "pipe", stderr: "pipe", timeout: 100_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function ok(o: Out, what: string): Out {
  if (o.code !== 0) throw new Error(`${what} exited ${o.code}\n${o.stdout}\n${o.stderr}`);
  return o;
}

const pregate = (m: Machine, ...args: string[]): Out => run([BIN, ...args], m);
const json = (path: string): Json => JSON.parse(readFileSync(path, "utf8")) as Json;
const read = (path: string): string | null => (existsSync(path) ? readFileSync(path, "utf8") : null);

function foreignKeys(settings: Json, data: string): Json {
  const copy = structuredClone(settings);
  const hooks = (copy.hooks ?? {}) as Record<string, unknown[]>;
  for (const e of Object.keys(hooks)) {
    hooks[e] = hooks[e]!.filter((g) => !JSON.stringify(g).includes(`'${data}/bin/pregate'`));
  }
  return copy;
}

type PreGroup = { hooks: { command: string; timeout: number; failClosed?: boolean }[] };

function pregateHandler(m: Machine): { command: string; timeout: number; failClosed: boolean } {
  const groups = (json(m.settings).hooks as { PreToolUse: PreGroup[] }).PreToolUse;
  const ours = groups.find((g) => exact(g, "shared", m.data));
  expect(ours).toBeDefined();
  const h = ours!.hooks[0]!;
  expect(h.failClosed).toBe(true);
  return { command: h.command, timeout: h.timeout, failClosed: h.failClosed === true };
}

describe("Grok failClosed registration", () => {
  test("setup writes failClosed on the shared PreToolUse handler only", () => {
    const m = machine(["grok", "claude-code", "cursor", "codex"]);
    ok(pregate(m, "setup"), "setup");
    const handler = pregateHandler(m);
    expect(handler.failClosed).toBe(true);
    expect(handler.command).toContain(m.data);
    expect(JSON.stringify(foreignKeys(json(m.settings), m.data))).not.toContain("failClosed");
    const codexPre = (json(m.hooks).hooks as { PreToolUse: { hooks: Record<string, unknown>[] }[] }).PreToolUse.at(-1)!.hooks[0]!;
    expect(codexPre.failClosed).toBeUndefined();
  });

  test(`doctor reports failClosed for Grok Build >= ${FAIL_CLOSED_SINCE}`, () => {
    const m = machine(["grok"]);
    ok(pregate(m, "setup"), "setup");
    const out = pregate(m, "doctor");
    expect(out.stdout).toContain(`failClosed is set (Grok Build >= ${FAIL_CLOSED_SINCE}`);
    expect(out.stdout).not.toContain("failClosed is missing");
  });
});

describe("Grok PreToolUse gate", () => {
  test("failClosed denies hook crash and timeout; without it Grok fails open", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    const registered = pregateHandler(m);
    const crash = join(m.root, "crash.sh");
    const hang = join(m.root, "hang.sh");
    put(crash, "#!/bin/sh\nexit 1\n", 0o755);
    put(hang, "#!/bin/sh\nsleep 5\n", 0o755);

    for (const [script, label] of [[crash, "crash"], [hang, "timeout"]] as const) {
      const closed = { type: "command", command: script, timeout: label === "timeout" ? 1 : registered.timeout, failClosed: true };
      expect(grokPreToolUseGate(closed, PAYLOAD, m.env).denied).toBe(true);
      expect(grokPreToolUseGate({ ...closed, failClosed: false }, PAYLOAD, m.env).denied).toBe(false);
    }
  });

  test("Claude Code and Cursor still load shared settings with failClosed present", () => {
    const m = machine(["claude-code", "cursor", "grok"]);
    const before = json(m.settings);
    ok(pregate(m, "setup"), "setup");
    const after = json(m.settings);
    expect(foreignKeys(after, m.data)).toEqual(foreignKeys(before, m.data));
    expect(read(m.settings)).toContain('"failClosed": true');
    const handler = pregateHandler(m);
    const claudePayload = readFileSync(join(import.meta.dir, "payloads/pre-write.json"), "utf8");
    const cursorPayload = readFileSync(join(import.meta.dir, "payloads/cursor/claude-import-pre-write.json"), "utf8");
    for (const payload of [claudePayload, cursorPayload]) {
      const out = run([join(m.root, "bin/sh"), "-c", handler.command], m, payload);
      expect(out.code).toBe(0);
      expect(out.stdout).toBe("");
    }
    ok(pregate(m, "setup"), "setup again");
    expect(json(m.settings)).toEqual(after);
  });
});
