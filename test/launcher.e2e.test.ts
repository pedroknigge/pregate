import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENGINE_VERSION, REDIRECT } from "../src/gate.ts";
import { enable } from "../src/consent.ts";
import type { HarnessId } from "../src/types.ts";
import { DATA as FIXTURE_DATA, HOOK_COMMAND } from "./fixtures/hook-command.ts";
import { removeTree } from "./remove-tree.ts";

// The launcher and the registered command (MULTI-HARNESS §6.2, MH-15, MH-19, MH-22), run by the
// shells that run them for real: the launcher under sh (bash 3.2 on macOS), dash and bash; the
// registered command, literal, under those and `zsh -c` (Cursor runs hooks with $SHELL). The engines
// are scripts that act out the protocol; the payloads and hook environments are the captured ones.
// Every spawn gets its whole environment from here, under one temporary folder.

setDefaultTimeout(30_000);

const LAUNCHER = readFileSync(join(import.meta.dir, "../assets/launcher.sh"), "utf8");
const PAYLOADS = join(import.meta.dir, "payloads");
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-launcher-")));
const SCRATCH = join(TMP, "tmp");
const VERSION = "0.2.0";
const PINNED = "0.3.0-rc.1";
const BASE = {
  HOME: join(TMP, "home"), TMPDIR: SCRATCH, PATH: "/usr/bin:/bin",
  XDG_DATA_HOME: join(TMP, "data"), XDG_STATE_HOME: join(TMP, "state"),
  CODEX_HOME: join(TMP, "codex"), GROK_HOME: join(TMP, "grok"),
};
mkdirSync(BASE.HOME);
mkdirSync(SCRATCH);
if (Bun.spawnSync(["git", "init", "-q", TMP]).exitCode !== 0) throw new Error("fixture git init failed");

const shell = (name: string): string => {
  const p = Bun.which(name);
  if (p === null) throw new Error(`${name} is required by the launcher e2e`);
  return p;
};
const SHELLS = ["sh", "dash", "bash"].map(shell);
const COMMAND_SHELLS = [...SHELLS, shell("zsh")];

afterAll(() => removeTree(TMP));

type Env = Record<string, string>;
interface Out { code: number | null; stdout: string; stderr: string; ms: number }

function run(cmd: string[], stdin: string, env: Env = {}, cwd = TMP): Out {
  const t = performance.now();
  // A launcher or command that never ends would otherwise block the test runner itself.
  const p = Bun.spawnSync(cmd, { cwd, env: { ...BASE, ...env }, stdin: Buffer.from(stdin), stdout: "pipe", stderr: "pipe", timeout: 20_000 });
  return { code: p.exitCode, stdout: p.stdout.toString(), stderr: p.stderr.toString(), ms: performance.now() - t };
}

async function runAsync(cmd: string[], stdin: string, env: Env, during: (pid: number) => Promise<void> = async () => {}): Promise<Out> {
  const t = performance.now();
  const p = Bun.spawn(cmd, { cwd: TMP, env: { ...BASE, ...env }, stdin: Buffer.from(stdin), stdout: "pipe", stderr: "pipe" });
  await during(p.pid);
  const [stdout, stderr, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { code, stdout, stderr, ms: performance.now() - t };
}

// ── Installations ──────────────────────────────────────────────────────────────────────

// An engine records what it got next to itself: stdin, argv and PATH. It runs with the caller's
// PATH, which some tests empty, so it names its commands absolutely.
const RECORD = `/bin/cat >"$0.stdin"; printf '%s\\n' "$*" >"$0.args"; printf '%s' "$PATH" >"$0.path"`;
const HANG = `echo $$ >"$0.pid"; exec /bin/sleep 60`;
const redirect = (v: string): string => `printf '%s\\n' '${v}'; /bin/cat; exit ${REDIRECT}`;

interface Install { data: string; launcher: string; engine: (v: string) => string }

let installs = 0;
// <data>/bin/pregate as setup writes it, and an engine per version: a script body, or null for an
// empty file with the exec bit (a truncated copy).
function install(engines: Record<string, string | null>): Install {
  const data = join(TMP, `install-${installs++}`, "data");
  mkdirSync(join(data, "bin"), { recursive: true });
  enable(TMP, data);
  enable(REPO, data);
  const launcher = join(data, "bin/pregate");
  writeFileSync(launcher, LAUNCHER.replace("@ENGINE_VERSION@", VERSION), { mode: 0o755 });
  const engine = (v: string): string => join(data, v, "pregate");
  for (const [v, body] of Object.entries(engines)) {
    mkdirSync(join(data, v));
    writeFileSync(engine(v), body === null ? "" : `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  }
  return { data, launcher, engine };
}

const recorded = (i: Install, v: string, what: "stdin" | "args" | "path"): string => readFileSync(`${i.engine(v)}.${what}`, "utf8");

// ── Captured payloads and environments ─────────────────────────────────────────────────

const payload = (rel: string): string => readFileSync(join(PAYLOADS, rel), "utf8");
// KEY=VALUE lines of a captured hook environment.
const capturedEnv = (h: string): Env => Object.fromEntries(readFileSync(join(PAYLOADS, h, "hook-env-pre-tool-use.txt"), "utf8")
  .split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));

interface Harness { flag: HarnessId; env: Env; pre: string; stop: string; start: string | null }
// Cursor and Grok run Claude Code's registration (MH-04): only their environment tells them apart.
const HARNESSES: Record<HarnessId, Harness> = {
  "claude-code": { flag: "claude-code", env: {}, pre: "pre-write.json", stop: "stop.json", start: "session-start.json" },
  cursor: { flag: "claude-code", env: capturedEnv("cursor"), pre: "cursor/pre-write-create.json", stop: "cursor/stop.json", start: "cursor/session-start.json" },
  grok: { flag: "claude-code", env: capturedEnv("grok"), pre: "grok/pre-write.json", stop: "grok/stop.json", start: "grok/session-start.json" },
  codex: { flag: "codex", env: {}, pre: "codex/pre-apply-patch-add-update.json", stop: "codex/stop.json", start: "codex/session-start.json" },
  agy: { flag: "agy", env: {}, pre: "agy/pre-write_to_file.json", stop: "agy/stop.json", start: null },
};

const hook = (sh: string, i: Install, event: string, h: Harness): string[] => [sh, i.launcher, "hook", event, "--harness", h.flag];

// ── What the harness reads ─────────────────────────────────────────────────────────────

// MH-15: Pre fails closed alike in the five harnesses: exit 2, stdout empty, one stderr line of at
// most 256 characters. Returns the line.
function deniedPre(o: Out): string {
  expect(o.code).toBe(2);
  expect(o.stdout).toBe("");
  expect(o.stderr).toMatch(/^PREGATE could not evaluate: [^\n]+\n$/);
  expect(o.stderr.length).toBeLessThanOrEqual(257);
  return o.stderr.slice(0, -1);
}
const evaluate = (why: string): string => `PREGATE could not evaluate: ${why}; report it to the user`;

// The engine was SIGKILLed: once the orphan is reaped, its pid is gone.
async function killed(i: Install): Promise<boolean> {
  const pid = Number(readFileSync(`${i.engine(VERSION)}.pid`, "utf8"));
  for (let t = 0; t < 100; t++) {
    if (reaped(pid)) return true;
    await Bun.sleep(10);
  }
  return false;
}

function reaped(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

function neutral(o: Out): void {
  expect(o).toMatchObject({ code: 0, stdout: "", stderr: "" });
}

// ── The launcher ───────────────────────────────────────────────────────────────────────

test("the redirect protocol in the launcher is the one gate.ts states", () => {
  expect(LAUNCHER).toContain(`grep -Eqx '${ENGINE_VERSION.source.slice(1, -1)}'`);
  expect(LAUNCHER).toContain(`if [ $rc = ${REDIRECT} ]`);
});

// Each test installs once and runs every shell: macOS scans a new executable on its first run.
const pre = (sh: string, i: Install, env: Env = {}, h = HARNESSES.codex): Out => run(hook(sh, i, "pre", h), payload(h.pre), { ...h.env, ...env });
const NOT_INSTALLED = `engine ${VERSION} is not installed; reinstall PREGATE`;

test("the engine's exit 0 and 2 pass through byte for byte", () => {
  const allow = install({ [VERSION]: `/bin/cat >/dev/null; printf '{"additionalContext":"w"}'; printf 'note' >&2; exit 0` });
  const deny = install({ [VERSION]: `/bin/cat >/dev/null; printf '{"decision":"deny"}\\n'; printf 'PREGATE DENY x\\nmore\\n' >&2; exit 2` });
  for (const sh of SHELLS) {
    expect(pre(sh, allow)).toMatchObject({ code: 0, stdout: '{"additionalContext":"w"}', stderr: "note" });
    expect(pre(sh, deny)).toMatchObject({ code: 2, stdout: '{"decision":"deny"}\n', stderr: "PREGATE DENY x\nmore\n" });
  }
});

test("shared import rule diagnostics are internal and identify a failed engine's active rule set", () => {
  const markers = "printf 'PREGATE-CHECKPOINT dependency-review\\nPREGATE-IMPORT-REVIEW rules=architecture/dependencies/layers\\nPREGATE-IMPORT-REVIEW completed=12.3ms\\n' >&2; ";
  const allow = install({ [VERSION]: markers + "exit 0" });
  const denied = install({ [VERSION]: markers + "exit 2" });
  const failed = install({ [VERSION]: markers + "exit 1" });
  for (const sh of SHELLS) {
    neutral(pre(sh, allow));
    expect(deniedPre(pre(sh, denied))).toBe(evaluate("the engine denied without a reason"));
    expect(deniedPre(pre(sh, failed))).toBe(evaluate("the engine failed (exit 1); last engine checkpoint: dependency-review; shared import review: architecture/dependencies/layers (12.3 ms)"));
  }
});

test("progress on fd 5 leaves an allowed call's stderr empty and still names a failed engine's checkpoint", () => {
  const markers = "[ \"$PREGATE_PROGRESS_FD\" = 5 ] || exit 7; printf 'PREGATE-CHECKPOINT dependency-review\\nPREGATE-IMPORT-REVIEW rules=architecture/dependencies/layers\\nPREGATE-IMPORT-REVIEW completed=12.3ms\\n' >&5; ";
  const allow = install({ [VERSION]: markers + "exit 0" });
  const denied = install({ [VERSION]: markers + "printf 'PREGATE DENY x\\n' >&2; exit 2" });
  const failed = install({ [VERSION]: markers + "exit 1" });
  for (const sh of SHELLS) {
    neutral(pre(sh, allow));
    expect(pre(sh, denied)).toMatchObject({ code: 2, stderr: "PREGATE DENY x\n" });
    expect(deniedPre(pre(sh, failed))).toBe(evaluate("the engine failed (exit 1); last engine checkpoint: dependency-review; shared import review: architecture/dependencies/layers (12.3 ms)"));
  }
});

test("the engine gets the payload intact, the arguments and the caller's PATH", () => {
  const i = install({ [VERSION]: RECORD });
  const big = JSON.parse(payload(HARNESSES.cursor.pre)) as { tool_input: { content: string } };
  big.tool_input.content = "export const a = 1;\n".repeat(25_000);
  const raw = JSON.stringify(big);
  for (const sh of SHELLS) {
    neutral(run(hook(sh, i, "pre", HARNESSES.cursor), raw, { ...HARNESSES.cursor.env, PATH: "/opt/homebrew/bin:/usr/bin:/bin" }));
    expect(recorded(i, VERSION, "stdin")).toBe(raw);
    expect(recorded(i, VERSION, "args")).toBe("hook pre --harness claude-code\n");
    expect(recorded(i, VERSION, "path")).toBe("/opt/homebrew/bin:/usr/bin:/bin");
  }
});

test("a missing, empty, failing or killed engine denies Pre, also with PATH empty", () => {
  const [absent, empty, fails, killed9] = [install({}), install({ [VERSION]: null }), install({ [VERSION]: "exit 1" }), install({ [VERSION]: "kill -s KILL $$" })];
  for (const sh of SHELLS) {
    expect(deniedPre(pre(sh, absent))).toBe(evaluate(NOT_INSTALLED));
    expect(deniedPre(pre(sh, empty, { PATH: "" }))).toBe(evaluate(NOT_INSTALLED));
    expect(deniedPre(pre(sh, fails, { PATH: "" }))).toBe(evaluate("the engine failed (exit 1)"));
    expect(deniedPre(pre(sh, killed9))).toBe(evaluate("the engine failed (exit 137)"));
  }
});

test("an exit 2 without a reason on stderr denies (Codex would run the tool)", () => {
  const silent = install({ [VERSION]: `printf '{"decision":"deny","reason":"x"}'; exit 2` });
  const blank = install({ [VERSION]: "printf ' \\n\\t' >&2; exit 2" });
  const marker = install({ [VERSION]: "printf 'PREGATE-CHECKPOINT rules\\n' >&2; exit 2" });
  for (const sh of SHELLS) {
    for (const i of [silent, blank, marker]) expect(deniedPre(pre(sh, i))).toBe(evaluate("the engine denied without a reason"));
  }
});

test("exit 3 runs the pinned engine once, on the same stdin and arguments", () => {
  const i = install({ [VERSION]: `printf 'ignored' >&2; ${redirect(PINNED)}`, [PINNED]: `${RECORD}; printf 'pinned'; exit 0` });
  for (const sh of SHELLS) {
    expect(run(hook(sh, i, "pre", HARNESSES.agy), payload(HARNESSES.agy.pre), { PATH: "/usr/local/bin:/usr/bin" }))
      .toMatchObject({ code: 0, stdout: "pinned", stderr: "" });
    expect(recorded(i, PINNED, "stdin")).toBe(payload(HARNESSES.agy.pre));
    expect(recorded(i, PINNED, "args")).toBe("hook pre --harness agy\n");
    expect(recorded(i, PINNED, "path")).toBe("/usr/local/bin:/usr/bin");
  }
});

test("exit 3 to a missing engine, to an invalid version or twice denies", () => {
  const absent = install({ [VERSION]: redirect(PINNED) });
  const empty = install({ [VERSION]: redirect(PINNED), [PINNED]: null });
  const twice = install({ [VERSION]: redirect(PINNED), [PINNED]: redirect(VERSION) });
  // The engine answers what <engine>.v holds. Each invalid answer would name a directory; the last
  // one, an installed engine that allows.
  const answers = install({ [VERSION]: `/bin/cat "$0.v"; /bin/cat; exit ${REDIRECT}`, [PINNED]: "exit 0" });
  const answer = (v: string): Install => {
    writeFileSync(`${answers.engine(VERSION)}.v`, `${v}\n`);
    return answers;
  };
  for (const sh of SHELLS) {
    const why = evaluate(`engine ${PINNED} is not installed: run \`pregate update --engine ${PINNED}\``);
    expect(deniedPre(pre(sh, absent))).toBe(why);
    expect(deniedPre(pre(sh, empty))).toBe(why);
    expect(deniedPre(pre(sh, twice))).toBe(evaluate(`engine ${PINNED} redirected again (exit 3)`));
    neutral(pre(sh, answer(PINNED)));
    for (const v of ["", "0.3", "v0.3.0", "0.3.0-", "0.3.0 ", `${VERSION}/../${PINNED}`]) {
      expect(deniedPre(pre(sh, answer(v)))).toBe(evaluate("the engine named no valid version to run (exit 3)"));
    }
    // A valid version of any length still fits Grok's 256 characters.
    expect(deniedPre(pre(sh, answer(`1.2.3-${"a".repeat(300)}`)))).toStartWith("PREGATE could not evaluate: engine 1.2.3-aaa");
  }
});

test("Pre redirect replays large multiline Unicode input exactly and refuses missing replay", () => {
  const i = install({ [VERSION]: redirect(PINNED), [PINNED]: `${RECORD}; exit 0` });
  const missing = install({ [VERSION]: `printf '%s\\n' '${PINNED}'; exit ${REDIRECT}`, [PINNED]: "exit 0" });
  const raw = JSON.stringify({ text: "á\n😀".repeat(300_000) }, null, 2) + "\n";
  for (const sh of SHELLS) {
    neutral(run(hook(sh, i, "pre", HARNESSES.agy), raw));
    expect(recorded(i, PINNED, "stdin")).toBe(raw);
    expect(deniedPre(pre(sh, missing))).toBe(evaluate("the engine returned no valid input to replay"));
  }
});

test("Pre's deadline holds when a hung engine never reads a large stdin", () => {
  const i = install({ [VERSION]: HANG });
  const raw = JSON.stringify({ content: "x".repeat(2_000_000) });
  const out = run(hook(SHELLS[0]!, i, "pre", HARNESSES.codex), raw, { PATH: "" });
  expect(deniedPre(out)).toContain("timed out after 5 s");
  expect(out.ms).toBeLessThan(6_000);
});

test("Stop and SessionStart fail closed only in Claude Code; Cursor and Grok are told by their environment", () => {
  const i = install({});
  const reason = `PREGATE could not verify this turn: ${NOT_INSTALLED}; report it to the user`;
  for (const sh of SHELLS) {
    for (const [id, h] of Object.entries(HARNESSES)) {
      expect(deniedPre(pre(sh, i, {}, h))).toBe(evaluate(NOT_INSTALLED));
      const stop = run(hook(sh, i, "stop", h), payload(h.stop), h.env);
      const start = h.start === null ? null : run(hook(sh, i, "session-start", h), payload(h.start), h.env);
      if (id !== "claude-code") {
        neutral(stop);
        if (start !== null) neutral(start);
        continue;
      }
      expect(stop).toMatchObject({ code: 2, stdout: `${JSON.stringify({ decision: "block", reason })}\n`, stderr: `${reason}\n` });
      expect(start).toMatchObject({ code: 0, stderr: "" });
      expect(JSON.parse(start!.stdout)).toEqual({ systemMessage: `PREGATE could not prepare this session: engine ${VERSION} is not installed. Reinstall PREGATE.` });
    }
    // On re-entry the turn is let end, and the human is told.
    const again = run(hook(sh, i, "stop", HARNESSES["claude-code"]), payload("stop-reentry.json"));
    expect(again).toMatchObject({ code: 0, stderr: "" });
    expect(JSON.parse(again.stdout)).toEqual({ systemMessage: `PREGATE could not verify this turn: engine ${VERSION} is not installed. Reinstall PREGATE.` });
  }
});

test("hook auto, and no arguments, read the event from a Claude Code payload", () => {
  const i = install({});
  const recording = install({ [VERSION]: RECORD });
  for (const sh of SHELLS) {
    for (const args of [[], ["hook", "auto"]]) {
      expect(deniedPre(run([sh, i.launcher, ...args], payload("pre-write.json")))).toBe(evaluate(NOT_INSTALLED));
      expect(JSON.parse(run([sh, i.launcher, ...args], payload("stop.json")).stdout)).toHaveProperty("decision", "block");
      expect(JSON.parse(run([sh, i.launcher, ...args], payload("session-start.json")).stdout)).toHaveProperty("systemMessage");
    }
    neutral(run([sh, recording.launcher], payload("stop.json")));
    expect(recorded(recording, VERSION, "args")).toBe("hook auto\n");
  }
});

test("no arguments and no input print a hint instead of a hook decision, with or without consent", () => {
  const i = install({ [VERSION]: RECORD });
  const hint = "pregate: no command. Run pregate in a terminal for the guide, or pregate --help.\n";
  for (const consent of [true, false]) {
    if (!consent) rmSync(join(i.data, "consent"), { recursive: true });
    for (const sh of SHELLS) for (const input of ["", " \n"]) {
      expect(run([sh, i.launcher], input)).toMatchObject({ code: 0, stdout: "", stderr: hint });
      expect(existsSync(`${i.engine(VERSION)}.args`)).toBe(false);
    }
  }
  // A UTF-8 locale counts U+00A0 (and undecodable bytes) as blank; the launcher must not.
  mkdirSync(join(i.data, "consent"), { recursive: true });
  writeFileSync(join(i.data, "consent", "r.json"), "{}");
  for (const sh of SHELLS) {
    expect(run([sh, i.launcher], "\u00a0", { LC_ALL: "en_US.UTF-8" }).stderr).toBe("");
    expect(recorded(i, VERSION, "args")).toBe("hook auto\n");
    rmSync(`${i.engine(VERSION)}.args`);
  }
});

test("without consent only SessionStart reaches the engine, for its dormant notice", () => {
  const i = install({ [VERSION]: `${RECORD}; printf '{"note":"dormant"}'` });
  rmSync(join(i.data, "consent"), { recursive: true });
  for (const sh of SHELLS) {
    neutral(run(hook(sh, i, "pre", HARNESSES["claude-code"]), payload("pre-write.json")));
    neutral(run(hook(sh, i, "stop", HARNESSES["claude-code"]), payload("stop.json")));
    expect(existsSync(`${i.engine(VERSION)}.args`)).toBe(false);
    const start = run(hook(sh, i, "session-start", HARNESSES["claude-code"]), payload("session-start.json"));
    expect(start).toMatchObject({ code: 0, stdout: '{"note":"dormant"}', stderr: "" });
    expect(recorded(i, VERSION, "args")).toBe("hook session-start --harness claude-code\n");
    rmSync(`${i.engine(VERSION)}.args`);
  }
  const broken = install({ [VERSION]: "exit 1" });
  rmSync(join(broken.data, "consent"), { recursive: true });
  for (const sh of SHELLS) neutral(run(hook(sh, broken, "session-start", HARNESSES["claude-code"]), payload("session-start.json")));
});

test("no arguments on a human terminal opens the guide without reading a hook payload", () => {
  const python = Bun.which("python3");
  if (python === null) throw new Error("python3 is required for the terminal entry canary");
  const i = install({ [VERSION]: `printf '%s\\n' "$*" >"$0.args"; printf 'guide-started\\n'` });
  const script = `import os, pty, subprocess, sys
master, slave = pty.openpty()
try:
    child = subprocess.Popen(sys.argv[1:], stdin=slave, stdout=slave, stderr=slave)
    child.wait(timeout=5)
    sys.exit(child.returncode)
finally:
    os.close(master)
    os.close(slave)
`;
  for (const sh of SHELLS) {
    neutral(run([python, "-c", script, sh, i.launcher], ""));
    expect(recorded(i, VERSION, "args")).toBe("guide\n");
  }
  rmSync(join(i.data, "consent"), { recursive: true });
  rmSync(`${i.engine(VERSION)}.args`);
  neutral(run([python, "-c", script, SHELLS[0]!, i.launcher], "", { CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" }));
  expect(existsSync(`${i.engine(VERSION)}.args`)).toBe(false);
});

test("SIGTERM from the harness kills the engine and still denies with a reason", async () => {
  const i = install({ [VERSION]: HANG });
  for (const sh of SHELLS) {
    rmSync(`${i.engine(VERSION)}.pid`, { force: true });
    let at = 0;
    const o = await runAsync(hook(sh, i, "pre", HARNESSES.codex), payload(HARNESSES.codex.pre), {}, async (pid) => {
      while (!existsSync(`${i.engine(VERSION)}.pid`)) await Bun.sleep(5);
      at = performance.now();
      process.kill(pid, "SIGTERM");
    });
    expect(deniedPre(o)).toBe(evaluate("the harness cancelled it"));
    expect(performance.now() - at).toBeLessThan(500);
    expect(await killed(i)).toBe(true);
  }
});

// §4.0 measured +0.8–6.7 ms (O12); the bound only catches a launcher that waits on something.
test("supervision costs a few ms over running the engine directly", () => {
  const i = install({ [VERSION]: "/bin/cat >/dev/null" });
  const ms = (cmd: string[]): number => {
    const o = run(cmd, payload(HARNESSES.codex.pre));
    neutral(o);
    return o.ms;
  };
  for (const sh of SHELLS) {
    // Match adjacent runs and alternate their order, as in the compiled-engine control.
    const direct = [i.engine(VERSION), "hook", "pre", "--harness", "codex"];
    const supervised = hook(sh, i, "pre", HARNESSES.codex);
    const overhead = Array.from({ length: 15 }, (_, n) => {
      if (n % 2 === 0) {
        const base = ms(direct);
        return ms(supervised) - base;
      }
      const wrapped = ms(supervised);
      return wrapped - ms(direct);
    }).sort((x, y) => x - y);
    expect(overhead[overhead.length >> 1]!).toBeLessThan(20);
  }
});

// One deadline for the three shells at once; PATH empty proves the launcher finds its own sleep.
test("a hung engine is cut at 5 s and killed, under every shell and with PATH empty", async () => {
  const outs = await Promise.all(SHELLS.map(async (sh) => {
    const i = install({ [VERSION]: "printf 'PREGATE-CHECKPOINT dependency-review\\n' >&2; " + HANG });
    return { i, o: await runAsync(hook(sh, i, "pre", HARNESSES.grok), payload(HARNESSES.grok.pre), { ...HARNESSES.grok.env, PATH: "" }) };
  }));
  for (const { i, o } of outs) {
    expect(deniedPre(o)).toBe(evaluate("the engine timed out after 5 s; last engine checkpoint: dependency-review"));
    expect(o.ms).toBeGreaterThan(4_900);
    expect(o.ms).toBeLessThan(7_000);
    expect(await killed(i)).toBe(true);
  }
});

test("the CLI through the PATH symlink runs the engine unsupervised, and never as an empty script", () => {
  const link = join(TMP, "bin-on-path", "pregate");
  mkdirSync(join(TMP, "bin-on-path"));
  const via = (i: Install): string => {
    rmSync(link, { force: true });
    symlinkSync(i.launcher, link);
    return link;
  };
  const i = install({ [VERSION]: `${RECORD}; printf 'usage'; exit 1` });
  expect(run([via(i), "check", "--staged"], "")).toMatchObject({ code: 1, stdout: "usage", stderr: "" });
  expect(recorded(i, VERSION, "args")).toBe("check --staged\n");
  for (const engines of [{}, { [VERSION]: null }] as Record<string, null>[]) {
    expect(run([via(install(engines)), "check", "--staged"], "")).toMatchObject({
      code: 1, stdout: "", stderr: `PREGATE: engine ${VERSION} is not installed; reinstall PREGATE\n`,
    });
  }
});

// ── The registered command (MH-22) ─────────────────────────────────────────────────────

const MISSING = `${evaluate("its launcher is missing")}\n`;
// A repo with a preset, a directory below it, and one outside every repo.
const REPO = join(TMP, "repo");
const BELOW = join(REPO, "src/deep");
const OUTSIDE = join(TMP, "outside");
mkdirSync(join(REPO, ".pregate"), { recursive: true });
writeFileSync(join(REPO, ".pregate/preset.json"), "{}");
mkdirSync(BELOW, { recursive: true });
mkdirSync(OUTSIDE);
for (const root of [REPO, OUTSIDE]) if (Bun.spawnSync(["git", "init", "-q", root]).exitCode !== 0) throw new Error("fixture git init failed");

// The command setup registers for this installation: the frozen text with its <DATA>.
const command = (i: Install, sub: string, h: string): string => HOOK_COMMAND[`${sub} ${h}`]!.replaceAll(FIXTURE_DATA, i.data);
// agy's payload, with workspacePaths as `paths` writes it (undefined: no such key).
const agy = (paths: string | undefined): string => {
  const p = payload(HARNESSES.agy.pre);
  const key = /"workspacePaths":\[[^\]]*\]/;
  expect(p).toMatch(key);
  return paths === undefined ? p.replace(key, '"noWorkspacePaths":[]') : p.replace(key, `"workspacePaths":${paths}`);
};

test("the fixture holds the registered commands", () => {
  expect(Object.keys(HOOK_COMMAND).sort()).toEqual([
    "pre agy", "pre claude-code", "pre codex", "session-start agy", "session-start claude-code", "session-start codex", "stop agy", "stop claude-code", "stop codex",
  ]);
});

test("with the launcher present, every command execs it with its event and harness, stdin intact", () => {
  const i = install({ [VERSION]: RECORD });
  for (const sh of COMMAND_SHELLS) {
    for (const key of Object.keys(HOOK_COMMAND)) {
      const [sub, h] = key.split(" ") as [string, string];
      const raw = h === "agy" ? payload(HARNESSES.agy.pre) : payload(HARNESSES.codex.pre);
      neutral(run([sh, "-c", command(i, sub, h)], raw, {}, BELOW));
      expect(recorded(i, VERSION, "args")).toBe(`hook ${sub} --harness ${h}\n`);
      expect(recorded(i, VERSION, "stdin")).toBe(raw);
    }
  }
});

test.each(COMMAND_SHELLS)("with the launcher missing, empty or not executable, Pre denies only where a preset is under %s", (sh) => {
  const absent = install({});
  rmSync(absent.launcher);
  const empty = install({});
  writeFileSync(empty.launcher, "");
  const plain = install({ [VERSION]: "exit 0" });
  chmodSync(plain.launcher, 0o644);
  for (const i of [absent, empty, plain]) {
    for (const h of ["claude-code", "codex"]) {
      const call = (cwd: string, env: Env = {}): Out => run([sh, "-c", command(i, "pre", h)], payload(HARNESSES.codex.pre), env, cwd);
      expect(call(BELOW)).toMatchObject({ code: 2, stdout: "", stderr: MISSING });
      expect(call(REPO)).toMatchObject({ code: 2, stdout: "", stderr: MISSING });
      neutral(call(OUTSIDE));
      expect(call(OUTSIDE, { CLAUDE_PROJECT_DIR: `${REPO}/` }).stderr).toBe(MISSING);
      expect(call(OUTSIDE, { CURSOR_PROJECT_DIR: BELOW }).stderr).toBe(MISSING);
      expect(call(OUTSIDE, { GROK_WORKSPACE_ROOT: `${REPO}/` }).stderr).toBe(MISSING);
      // A relative directory is not a candidate, and the walk up ends.
      const relative = call(OUTSIDE, { CLAUDE_PROJECT_DIR: "repo", CURSOR_PROJECT_DIR: "." });
      neutral(relative);
      expect(relative.ms).toBeLessThan(1_000);
      for (const sub of ["stop", "session-start"]) neutral(run([sh, "-c", command(i, sub, h)], payload(HARNESSES.codex.stop), {}, BELOW));
    }
    // agy: the plugin folder is the cwd and there is no project variable; only workspacePaths[0] counts.
    const call = (raw: string): Out => run([sh, "-c", command(i, "pre", "agy")], raw, {}, OUTSIDE);
    expect(call(agy(JSON.stringify([BELOW, OUTSIDE])))).toMatchObject({ code: 2, stdout: "", stderr: MISSING });
    neutral(call(agy(JSON.stringify([OUTSIDE, REPO]))));
    neutral(call(agy(undefined)));
    // Named but unreadable by sed: an escaped path, or none.
    neutral(call(agy(JSON.stringify([`${OUTSIDE}/a"b`]))));
    neutral(call(agy("[]")));
    neutral(run([sh, "-c", command(i, "stop", "agy")], payload(HARNESSES.agy.stop), {}, BELOW));
  }
});

// Last: whatever ran before, a deadline and a cancellation included, cleaned up after itself.
test("standalone consent blocks a broken engine and a missing registered launcher", () => {
  const standalone = realpathSync(mkdtempSync(join(tmpdir(), "pregate-standalone-launcher-")));
  inScratch(standalone, () => {
    const broken = install({ [VERSION]: "exit 1" });
    enable(standalone, broken.data);
    const raw = JSON.stringify({ ...JSON.parse(payload("pre-write.json")), cwd: standalone });
    for (const sh of SHELLS) deniedPre(run([sh, broken.launcher, "hook", "pre", "--harness", "claude-code"], raw, { CLAUDE_PROJECT_DIR: standalone }, standalone));
    rmSync(broken.launcher);
    for (const sh of COMMAND_SHELLS) deniedPre(run([sh, "-c", command(broken, "pre", "codex")], raw, { CLAUDE_PROJECT_DIR: standalone }, standalone));
  });
});

function inScratch(dir: string, use: () => void): void {
  try {
    use();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("an unavailable Git identity cannot bypass failure protection for a consenting root", () => {
  const broken = install({ [VERSION]: "exit 1" });
  const unavailable = { GIT_CONFIG_COUNT: "invalid" };
  for (const sh of SHELLS) deniedPre(pre(sh, broken, unavailable));
  rmSync(broken.launcher);
  for (const sh of COMMAND_SHELLS) deniedPre(run([sh, "-c", command(broken, "pre", "codex")], "{}", unavailable));
});

test("the launcher leaves no temporary directory behind", async () => {
  const [passes, fails] = [install({ [VERSION]: "exit 0" }), install({ [VERSION]: "exit 1" })];
  for (const sh of SHELLS) {
    neutral(pre(sh, passes));
    deniedPre(pre(sh, fails));
  }
  const leftovers = () => readdirSync(SCRATCH).filter((name) => name !== "xcrun_db"); // /usr/bin/git creates this macOS cache.
  for (let t = 0; t < 100 && leftovers().length > 0; t++) await Bun.sleep(10);
  expect(leftovers()).toEqual([]);
});

test("D28: a cloned committed preset remains inert with a broken or missing launcher", () => {
  const parent = join(TMP, "clone-source");
  const clone = join(TMP, "inert-clone");
  mkdirSync(join(parent, ".pregate"), { recursive: true });
  writeFileSync(join(parent, ".pregate/preset.json"), "{}\n");
  const git = (...args: string[]) => Bun.spawnSync(["git", "-c", "user.name=Consent", "-c", "user.email=consent@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: parent });
  expect(git("init", "-q").exitCode).toBe(0);
  expect(git("add", ".").exitCode).toBe(0);
  expect(git("commit", "-qm", "preset").exitCode).toBe(0);
  expect(git("clone", "-q", parent, clone).exitCode).toBe(0);
  const broken = install({});
  for (const sh of COMMAND_SHELLS) neutral(run(hook(sh, broken, "pre", HARNESSES.codex), payload(HARNESSES.codex.pre), {}, clone));
  rmSync(broken.launcher);
  for (const sh of COMMAND_SHELLS) for (const h of ["claude-code", "codex"]) neutral(run([sh, "-c", command(broken, "pre", h)], "{}", {}, clone));
  const empty = install({ [VERSION]: "exit 1" });
  rmSync(join(empty.data, "consent"), { recursive: true });
  neutral(pre(SHELLS[0]!, empty));
});

test("approval deadline extends the launcher without treating SIGUSR2 as engine failure", () => {
  const i = install({ [VERSION]: 'kill -s USR2 "$PREGATE_LAUNCHER_PID"; /bin/sleep 6; exit 0' });
  const out = pre(SHELLS[0]!, i);
  neutral(out);
  expect(out.ms).toBeGreaterThan(5_000);
  expect(out.ms).toBeLessThan(10_000);
});
