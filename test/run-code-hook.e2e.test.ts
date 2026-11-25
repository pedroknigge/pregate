import { afterAll, afterEach, beforeEach, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LOCK, PRESET } from "../src/admission.ts";
import { compile } from "../src/compile.ts";
import { disable, enable } from "../src/consent.ts";
import { sourcesOf } from "../src/contract-diagnostic.ts";
import { canonical } from "../src/disk.ts";
import { VERSIONS } from "../src/versions.ts";
import { testEngine } from "./compiled-engine.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// Compiled hook, one payload shape per harness. Running code is allowed in a project
// that was never enabled, in an enabled project, and after disable. A package script
// stays allowed after the file it runs is edited, until that file writes gated source.
setDefaultTimeout(300_000);

const HARNESSES = ["claude-code", "codex", "cursor", "grok", "opencode", "agy"] as const;
type Harness = (typeof HARNESSES)[number];

const RUN = [
  "node script.js",
  'node -e "console.log(1)"',
  "bun run x.ts",
  "bun x.ts",
  "npx tsx x.ts",
  "tsx",
  "ts-node",
  "deno run",
  "python x.py",
  'python -c "print(1)"',
  "python3 -m pytest",
  "uv run",
  "ruby",
  "go run .",
  "cargo run",
  "cargo test",
  "java",
  "dotnet run",
  "./script.sh",
  "bash script.sh",
  "make",
  "pnpm test",
  "npm run dev",
  "node script.js && python x.py",
  "echo hello | node script.js",
  "pnpm lint",
  "pnpm gate",
  "npm run lint",
  "yarn gate",
  "bun run gate",
];

const base = realpathSync(mkdtempSync(join(tmpdir(), "run-code-")));
const names = ["HOME", "USERPROFILE", "XDG_DATA_HOME", "XDG_STATE_HOME", "TMPDIR"] as const;
let saved: Record<string, string | undefined>;
let area: string;
let run = 0;

beforeEach(() => {
  saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  area = join(base, String(++run));
  for (const [name, folder] of Object.entries({ HOME: "home", XDG_DATA_HOME: "data", XDG_STATE_HOME: "state", TMPDIR: "tmp" })) {
    const dir = join(area, folder);
    mkdirSync(dir, { recursive: true });
    process.env[name] = dir;
  }
});
afterEach(() => {
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});
afterAll(() => removeTree(base));

function git(root: string, ...args: string[]): void {
  const r = Bun.spawnSync(["git", "-c", "user.name=Hook", "-c", "user.email=hook@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: root, env: process.env, stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
}

const GATE = "import { readFileSync } from \"node:fs\";\nconsole.log(readFileSync(\"package.json\", \"utf8\").length);\n";

function project(name: string, turnedOn: boolean): string {
  const root = canonical(join(area, name));
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, ".pregate"), { recursive: true });
  writeFileSync(join(root, "src/x.ts"), "export const x = 1;\n");
  writeFileSync(join(root, "script.js"), "console.log(1);\n");
  writeFileSync(join(root, "x.ts"), "console.log(1);\n");
  writeFileSync(join(root, "x.py"), "print(1)\n");
  writeFileSync(join(root, "script.sh"), "#!/bin/sh\necho hello\n");
  writeFileSync(join(root, "Makefile"), "all:\n\techo ok\n");
  writeFileSync(join(root, "scripts/gate.mjs"), GATE);
  writeFileSync(join(root, "package.json"), JSON.stringify({
    scripts: { test: "echo ok", dev: "echo ok", lint: "node scripts/gate.mjs", gate: "node scripts/gate.mjs", bad: "echo x > src/x.ts" },
  }) + "\n");
  git(root, "init", "-q");
  const text = policyFixture(readFileSync(join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json"), "utf8"));
  writeFileSync(join(root, PRESET), text);
  const result = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  writeFileSync(join(root, LOCK), result.text);
  git(root, "add", ".");
  git(root, "commit", "-qm", "base");
  if (turnedOn) enable(root);
  return root;
}

function payload(harness: Harness, root: string, command: string, session: string): string {
  if (harness === "cursor") {
    return JSON.stringify({
      conversation_id: session, generation_id: session, model: "default", session_id: session,
      hook_event_name: "preToolUse", cursor_version: "2026.11.11-043ef28", cwd: "",
      workspace_roots: [root], user_email: "user@example.com",
      tool_name: "Shell", tool_use_id: session, tool_input: { command, cwd: "", timeout: 30000 },
    });
  }
  if (harness === "grok") {
    return JSON.stringify({
      hookEventName: "pre_tool_use", sessionId: session, cwd: root, workspaceRoot: root,
      toolName: "run_terminal_command", toolUseId: session, toolInputTruncated: false,
      toolInput: { command, description: "run" },
    });
  }
  if (harness === "opencode") {
    return JSON.stringify({
      hook_event_name: "PreToolUse", session_id: session, cwd: root,
      tool_name: "shell", tool_use_id: session, tool_input: { command, workdir: root },
    });
  }
  if (harness === "agy") {
    return JSON.stringify({
      conversationId: session, workspacePaths: [root], cwd: root, stepIdx: 1, hookEventName: "PreToolUse",
      toolCall: { name: "run_command", args: { CommandLine: command, Cwd: root } },
    });
  }
  return JSON.stringify({
    hook_event_name: "PreToolUse", session_id: session, permission_mode: "default", cwd: root,
    tool_name: "Bash", tool_use_id: session, tool_input: { command },
  });
}

function hook(cli: string, harness: Harness, root: string, command: string, session: string) {
  return Bun.spawnSync([cli, "hook", "pre", "--harness", harness], {
    cwd: root, env: process.env, stdin: Buffer.from(payload(harness, root, command, session)),
    stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
}

function denied(text: string): boolean {
  return text.includes("PREGATE DENY") || text.includes('"permission":"deny"') || text.includes('"permissionDecision":"deny"') || text.includes('"decision":"deny"');
}

test("running code is allowed before enable, after enable, and after disable", () => {
  const cli = testEngine();
  const fresh = project("fresh", false);
  const gated = project("gated", true);
  const off = project("off", true);
  disable(off);
  const digest = "a".repeat(64);
  const deniedWhenEnabled = [
    "echo x > src/x.ts",
    "sed -i src/x.ts",
    "git commit --no-verify",
    "HUSKY=0 git commit -m x",
    "PREGATE_UNATTENDED_APPROVAL=1 pregate approve --yes",
    "pregate enable --yes",
    "pregate disable --yes",
    "npm run bad",
  ];
  for (const harness of HARNESSES) {
    for (const [label, root] of [["fresh", fresh], ["enabled", gated], ["disabled", off]] as const) {
      for (const command of RUN) {
        const out = hook(cli, harness, root, command, `${label}-${harness}`);
        const text = `${out.stdout.toString()}\n${out.stderr.toString()}`;
        expect(denied(text), `${harness} ${label} ${command}\n${text}`).toBe(false);
      }
      for (const command of [`pregate approve --yes --digest ${digest}`, "pregate check", "pregate audit", "pregate report", "! pregate approve --yes --digest " + digest]) {
        const out = hook(cli, harness, root, command, `${label}-${harness}-pregate`);
        const text = `${out.stdout.toString()}\n${out.stderr.toString()}`;
        expect(denied(text), `${harness} ${label} ${command}\n${text}`).toBe(false);
      }
    }
    for (const command of deniedWhenEnabled) {
      const blocked = hook(cli, harness, gated, command, `deny-${harness}`);
      const text = `${blocked.stdout.toString()}\n${blocked.stderr.toString()}`;
      expect(denied(text), `${harness} enabled ${command}\n${text}`).toBe(true);
      if (command.includes("src/x.ts")) expect(text, command).toContain("src/x.ts");
      if (command.startsWith("pregate enable") || command.startsWith("pregate disable")) expect(text).toContain("separate terminal");
      for (const root of [fresh, off]) {
        const open = hook(cli, harness, root, command, `open-${harness}`);
        const openText = `${open.stdout.toString()}\n${open.stderr.toString()}`;
        expect(denied(openText), `${harness} ${root === fresh ? "fresh" : "disabled"} ${command}\n${openText}`).toBe(false);
      }
    }
  }
});

test("pnpm, npm, yarn and bun run stay allowed after the script file changes, until it writes gated source", () => {
  const cli = testEngine();
  const root = project("session", true);
  const session = "same-session";
  const runners = ["pnpm lint", "pnpm gate", "npm run lint", "npm run gate", "yarn lint", "yarn gate", "bun run lint", "bun run gate", "node scripts/gate.mjs"];
  const see = (command: string) => {
    const out = hook(cli, "claude-code", root, command, session);
    return `${out.stdout.toString()}\n${out.stderr.toString()}`;
  };
  for (const command of runners) expect(denied(see(command)), command).toBe(false);
  writeFileSync(join(root, "scripts/gate.mjs"), `${GATE}// still reads\n`);
  for (const command of runners) expect(denied(see(command)), `after edit ${command}`).toBe(false);
  writeFileSync(join(root, "scripts/gate.mjs"), `${GATE}import { writeFileSync } from "node:fs";\nwriteFileSync("src/x.ts", "x");\n`);
  for (const command of runners) {
    const text = see(command);
    expect(denied(text), `after write ${command}\n${text}`).toBe(true);
    expect(text, command).toContain("src/x.ts");
  }
});
