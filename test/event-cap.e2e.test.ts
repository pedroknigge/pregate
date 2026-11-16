import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { canonical } from "../src/disk.ts";
import { EVENT_READ_CAP, eventFiles, key, record, sessionDir } from "../src/state.ts";
import type { CallEvent } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

// A Grok session has no turn id, so every recorded call reads the session history. Past the cap
// that read stays inside the Pre deadline and the violating edit is still denied.
setDefaultTimeout(120_000);

const area = canonical(mkdtempSync(join(tmpdir(), "pregate-event-cap-")));
const root = join(area, "repo");
const main = join(import.meta.dir, "../src/main.ts");
const PRE_DEADLINE_MS = 5_000;
const sources: Record<string, string> = {
  "package.json": "{\"name\":\"shop\",\"type\":\"module\"}\n",
  "tsconfig.json": "{\"compilerOptions\":{\"strict\":true}}\n",
  "src/domain/order.ts": "export interface Order { id: string }\nexport const empty: Order = { id: \"\" };\n",
  "src/infra/db.ts": "import type { Order } from \"../domain/order.ts\";\nexport function saveOrder(order: Order): string { return order.id; }\n",
};
const breaks = "import { saveOrder } from \"../infra/db.ts\";\nexport const price = saveOrder({ id: \"1\" });\n";

afterAll(() => removeTree(area));

test("a Grok session past the event cap still denies and stays inside the hook deadline", () => {
  const saved = {
    HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE,
    XDG_DATA_HOME: process.env.XDG_DATA_HOME, XDG_STATE_HOME: process.env.XDG_STATE_HOME,
  };
  const home = join(area, "home"), data = join(area, "data"), state = join(area, "state");
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.XDG_DATA_HOME = data;
  process.env.XDG_STATE_HOME = state;
  try {
    for (const [rel, text] of Object.entries(sources)) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), text);
    }
    const env = {
      ...process.env, HOME: home, USERPROFILE: home, XDG_DATA_HOME: data, XDG_STATE_HOME: state, CI: "1",
      PREGATE_UNATTENDED_APPROVAL: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
    };
    const run = (args: string[], input?: string) => {
      const result = Bun.spawnSync([process.execPath, main, ...args], {
        cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 60_000,
        ...(input === undefined ? {} : { stdin: Buffer.from(input) }),
      });
      return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString(), text: result.stdout.toString() + result.stderr.toString() };
    };
    const git = (...args: string[]) => {
      const result = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe" });
      if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    };
    git("init", "-q");
    git("config", "user.name", "t");
    git("config", "user.email", "t@example.com");
    git("config", "commit.gpgsign", "false");
    git("add", "-A");
    git("commit", "-qm", "base");
    const review = run(["guide", "--preview", "--enforcement", "enforce"]);
    expect(review.code, review.text).toBe(0);
    const digest = review.text.match(/Digest: ([0-9a-f]{64})/)?.[1];
    expect(digest, review.text).toBeTruthy();
    const approved = run(["approve", "--yes", "--digest", digest!]);
    expect(approved.code, approved.text).toBe(0);
    const sessionId = "00000000-0000-4000-8000-0000000000c1";
    const sid = key({ harness: "grok", id: sessionId });
    const seededAt = Date.now() - EVENT_READ_CAP - 2;
    for (let i = 0; i < EVENT_READ_CAP + 1; i++) {
      const seeded: CallEvent = {
        at: seededAt + i, callId: `seed-${i}`, turn: "after-stop-0", agentId: null, kind: "pre-edit",
        path: `src/seed-${i}.ts`, verdict: "none", halted: false, form: null, shadowed: false, violations: [], afterSha: null, astHash: null,
      };
      expect(record(sid, seeded, null)).toBeUndefined();
    }
    const file = join(root, "src/domain/price.ts");
    const payload = `${JSON.stringify({
      hookEventName: "pre_tool_use", sessionId, cwd: root, toolName: "write", toolUseId: "call-cap",
      toolInputTruncated: false, toolInput: { file_path: file, content: breaks },
    })}\n`;
    const started = performance.now();
    const out = run(["hook", "pre", "--harness", "grok"], payload);
    const elapsed = performance.now() - started;
    expect(out.code, out.text).toBe(2);
    expect(elapsed, out.text).toBeLessThan(PRE_DEADLINE_MS);
    const reason = (JSON.parse(out.stdout) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } }).hookSpecificOutput;
    expect(reason.permissionDecision).toBe("deny");
    expect(reason.permissionDecisionReason).toMatch(/\b[a-z-]+\/[A-Z]+(?:-[A-Z0-9]+)+\b/);
    const recorded = eventFiles(sessionDir(sid)).map((path) => JSON.parse(readFileSync(path, "utf8")) as CallEvent).find((event) => event.callId === "call-cap");
    expect(recorded?.verdict).toBe("deny");
    expect(recorded?.omittedEvents).toBeGreaterThanOrEqual(1);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
