import { readFileSync } from "node:fs";

// MULTI-HARNESS MH-22, literal in hook-command.txt: register.hookCommand(DATA, sub, h) must return
// these bytes, and the launcher e2e runs them as they are under sh, dash, bash and `zsh -c`.
//
// With the launcher present, every variant execs it. Without it, `pre` denies when the checkout is
// enforced and its preset does not set "uncertainty" to "open"; `stop` and
// `session-start` exit 0. A worktree or project disable record is not enforced. agy runs hooks from
// its plugin folder and sets no project variable, so its only candidate is workspacePaths[0] from
// the payload, and a payload that names workspacePaths but yields no path denies. `${d%/*}` walks up
// without forking `dirname`, and only an absolute path enters the loop: a relative one never ends.

export const DATA = "/home/user/.local/share/pregate";

// "<sub> <harness>" → command.
export const HOOK_COMMAND: Record<string, string> = Object.fromEntries(
  readFileSync(`${import.meta.dir}/hook-command.txt`, "utf8").split("\n").filter((l) => l !== "" && !l.startsWith("#"))
    .map((l) => {
      const [sub, harness] = l.split(" ", 2) as [string, string];
      return [`${sub} ${harness}`, l.slice(sub.length + harness.length + 2)];
    }),
);
