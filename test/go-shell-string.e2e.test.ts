import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonical } from "../src/disk.ts";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled CLI is the gate a repository runs. Fixture files under the check are the cases.
const cli = testEngine();
const repo = join(import.meta.dir, "..");
const fixtures = join(repo, "packs/security-audit/checks/execution/go-shell-string/fixtures");
const area = mkdtempSync(join(tmpdir(), "pregate-go-shell-"));
afterAll(() => removeTree(area));

const CHECK = "security-audit/execution/go-shell-string@1.0.1";
const RULE = "security-audit/SA-GO-SHELL-001";

// title, fixture directory, lines in that file that must stay clean
const denied = [
  ["exec.Command(\"sh\", \"-c\", cmd) variable script", "fail/variable", []],
  ["exec.CommandContext(ctx, \"sh\", \"-c\", cmd) variable script", "fail/variable-context", []],
  ["bash -c variable script", "fail/bash", []],
  ["/bin/sh -c variable script", "fail/bin-sh", []],
  ["/bin/bash -c variable script", "fail/bin-bash", []],
  ["/usr/bin/bash -c variable script", "fail/usr-bin", []],
  ["raw /bin/sh -c variable script", "fail/raw-shell", []],
  ["fmt.Sprintf shell script", "fail/sprintf", []],
  ["fmt.Sprintf script passed to CommandContext", "fail/sprintf-context", []],
  ["concatenated shell script", "fail/concat", []],
  ["concatenated /bin/bash script passed to CommandContext", "fail/concat-context", []],
  ["selector script", "fail/selector", []],
  ["index script", "fail/index", []],
  ["slice script", "fail/slice", []],
  ["parenthesized variable script", "fail/parenthesized", []],
  ["variable script after a comment", "fail/comment", []],
  ["zsh, dash, ksh and cmd.exe scripts", "fail/other-shells", []],
  ["positional parameters beside a built script", "trap/script-argument", [9]],
  ["split CommandContext variable script", "trap/split-context", [9]],
] as const;

const clean = [
  ["constant script exec.Command(\"sh\", \"-c\", \"ls -la\")", "pass/literal-ls"],
  ["constant raw script", "pass/raw-script"],
  ["existing constant shell script", "pass/literal-script"],
  ["exec.Command(\"git\", \"status\")", "pass/git-status"],
  ["direct argv with a concatenated argument", "pass/direct-argv"],
  ["CommandContext constant script with a positional value", "pass/context-literal"],
  ["bash and sh running a script file", "pass/script-file"],
  ["shell name held in a variable", "pass/variable-shell"],
  ["renamed os/exec import", "pass/renamed-import"],
  ["strings.Join script", "pass/join"],
] as const;

type FixtureFile = { source: string; target: string; lines: number[] };

function load(name: string): FixtureFile {
  const dir = join(fixtures, name);
  const fixture = JSON.parse(readFileSync(join(dir, "fixture.json"), "utf8")) as {
    target: string;
    expect: { violations?: { line: number }[] };
  };
  return {
    source: readFileSync(join(dir, "files", `${fixture.target}.fixture`), "utf8"),
    target: fixture.target,
    lines: (fixture.expect.violations ?? []).map((v) => v.line),
  };
}

function project(name: string) {
  const root = canonical(join(area, name));
  mkdirSync(root, { recursive: true });
  const env = {
    ...process.env,
    CI: "1",
    PREGATE_UNATTENDED_APPROVAL: "1",
    HOME: join(root, "home"),
    USERPROFILE: join(root, "home"),
    XDG_DATA_HOME: join(root, "data"),
    XDG_STATE_HOME: join(root, "state"),
    XDG_CONFIG_HOME: join(root, "config"),
    CODEX_HOME: join(root, "codex"),
    GROK_HOME: join(root, "grok"),
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const out = Bun.spawnSync([cli, ...args], {
      cwd: root, env, stdin: input === undefined ? "ignore" : Buffer.from(input),
      stdout: "pipe", stderr: "pipe", timeout: 45_000,
    });
    if (out.signalCode) throw new Error(`${args.join(" ")} terminated: ${out.signalCode}\n${out.stderr.toString()}`);
    return { code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString(), text: out.stdout.toString() + out.stderr.toString() };
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  return { root, put, run, git };
}

function mentioned(text: string, target: string, line: number): boolean {
  const path = target.replaceAll(".", "\\.");
  for (const match of text.matchAll(new RegExp(`${path}:(\\d+(?:,\\d+)*)`, "g"))) {
    if (match[1]!.split(",").map(Number).includes(line)) return true;
  }
  return false;
}

test("rules test admits every SA-GO-SHELL-001 fixture", () => {
  const tested = project("library").run(["rules", "test", "--library", "security-audit"]);
  expect(tested.code, tested.text).toBe(0);
  for (const [, name] of [...denied, ...clean]) {
    expect(tested.text).toContain(`ok   security-audit/execution/go-shell-string ${name} ->`);
  }
}, 120_000);

describe.serial("SA-GO-SHELL-001 gate", () => {
  const gate = project("gate");

  beforeAll(() => {
    gate.put("go.mod", "module example.com/tools\n\ngo 1.22\n");
    gate.put("internal/tools/keep.go", "package tools\n\nfunc Keep() {}\n");
    gate.git("init", "-q");
    expect(gate.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
    expect(gate.run(["pack", "add", "--library", "security-audit", "--source-only", "--yes"]).code).toBe(0);
    expect(gate.run(["pack", "enable", "security-audit/obvious-sinks", "--only", "SA-GO-SHELL-001", "--yes"]).code).toBe(0);
    gate.put(".pregate/requests/enforce.json", JSON.stringify({
      why: "Judge SA-GO-SHELL-001 in enforcing mode.",
      patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
    }));
    const enforced = gate.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
    expect(enforced.code, enforced.text).toBe(0);
    gate.git("add", "-A");
    gate.git("commit", "-qm", "baseline");
  }, 180_000);

  test.serial.each(denied)("check denies %s", (title, name, cleanLines) => {
    const fixture = load(name);
    const result = gate.run(["check", "--stdin", "--path", fixture.target], fixture.source);
    expect(result.code, `${title}\n${result.text}`).toBe(1);
    expect(result.text).toContain(RULE);
    expect(result.text).toContain(CHECK);
    for (const line of fixture.lines) expect(mentioned(result.text, fixture.target, line), `${title} line ${line}\n${result.text}`).toBe(true);
    for (const line of cleanLines) expect(mentioned(result.text, fixture.target, line), `${title} clean line ${line}\n${result.text}`).toBe(false);
  }, 60_000);

  test.serial.each(clean)("check allows %s", (title, name) => {
    const fixture = load(name);
    const result = gate.run(["check", "--stdin", "--path", fixture.target], fixture.source);
    expect(result.code, `${title}\n${result.text}`).toBe(0);
    expect(result.text).not.toContain("SA-GO-SHELL-001");
    expect(result.text).toContain("no introduced violations");
  }, 60_000);
});
