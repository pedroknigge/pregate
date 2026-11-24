import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { disable, disableProject, enable } from "../../src/consent.ts";
import { canonical } from "../../src/disk.ts";
import { blockAt, wireOf } from "../../src/harness/wire.ts";
import type { Decision } from "../../src/types.ts";

const NAMES = ["HOME", "USERPROFILE", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CONFIG_HOME"] as const;
const saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

function isolate(): string {
  const area = mkdtempSync(join(tmpdir(), "pregate-scope-"));
  const home = join(area, "home");
  const data = join(area, "data");
  mkdirSync(home, { recursive: true });
  mkdirSync(data, { recursive: true });
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.XDG_DATA_HOME = data;
  process.env.XDG_STATE_HOME = join(area, "state");
  process.env.XDG_CONFIG_HOME = join(area, "config");
  const root = canonical(join(area, "repo"));
  mkdirSync(root, { recursive: true });
  const git = Bun.spawnSync(["git", "init", "-q", root], { env: process.env });
  expect(git.exitCode).toBe(0);
  return root;
}

function blocked(): Decision {
  return {
    verdict: "deny", halt: true, cause: "shell-admin", violations: [], warnings: [], attempt: 1,
    compact: "PREGATE DENY shell-admin", full: "PREGATE DENY shell-admin\nFix: run it in a terminal\n",
    fix: { where: null, use: null, deterministic: false, text: "run it in a terminal" },
    notice: null, lockHash: null, shadowed: false,
  };
}

test("a deny is unreachable until pregate enable, and a disable puts it back out of reach", () => {
  const root = isolate();
  const decision = blocked();
  expect(wireOf(decision, [root]).decision.verdict).toBe("none");
  expect(wireOf(decision, [root]).decision.full).toBe("");
  enable(root);
  expect(wireOf(decision, [root]).decision.verdict).toBe("deny");
  disable(root);
  expect(wireOf(decision, [root]).decision.verdict).toBe("none");
  enable(root);
  expect(wireOf(decision, [root]).decision.verdict).toBe("deny");
  disableProject(root);
  expect(wireOf(decision, [root]).decision.verdict).toBe("none");
});

test("a block that names another enabled root stays reachable from a disabled checkout", () => {
  const own = isolate();
  const area = join(own, "..");
  const other = canonical(join(area, "other"));
  mkdirSync(other, { recursive: true });
  expect(Bun.spawnSync(["git", "init", "-q", other], { env: process.env }).exitCode).toBe(0);
  enable(other);
  disable(own);
  const reached = wireOf(blockAt(blocked(), other), [own]);
  expect(reached.decision.verdict).toBe("deny");
  expect(reached.scope).toHaveProperty("root", other);
});

test("an informational decision keeps its text where nothing is enforced", () => {
  const root = isolate();
  const note: Decision = {
    verdict: "none", halt: false, cause: null, violations: [], warnings: [], attempt: 0,
    compact: "", full: "PREGATE is disabled for this worktree. Pre-command and pre-edit do not block it.",
    fix: null, notice: null, lockHash: null, shadowed: false,
  };
  expect(wireOf(note, [root]).decision.full).toContain("do not block");
});
