import { expect, test } from "bun:test";
import { hookCommand } from "../src/register.ts";
import { commandScript } from "../src/windows-command.ts";
import {
  mergeProjectClaude, projectClaudeMissing, projectHookCommand, projectOwnedCommand, projectScope, workspaceTrustAccepted,
} from "../src/project-claude.ts";

const FOREIGN = {
  permissions: { allow: ["Bash(ls)"] },
  hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo foreign-pre" }] }],
    Stop: [{ hooks: [{ type: "command", command: "echo foreign-stop" }] }],
    UserPromptSubmit: [{ hooks: [{ type: "command", command: "echo foreign-prompt" }] }],
  },
};
const LEGACY = `f="$PWD/.pregate/bin/pregate"; [ -f "$f" ] && "$f" hook pre`;

test("project hook commands name the project launcher and do not fall back to PATH or the global data launcher", () => {
  for (const windows of [false, true]) {
    for (const sub of ["pre", "stop", "session-start"] as const) {
      const command = projectHookCommand(sub, windows);
      const script = commandScript(command);
      expect(script).not.toContain("consented()");
      expect(script).not.toContain("[ -f \"$f\" ]");
      expect(script).not.toContain("/bin/launcher.ps1");
      expect(script.includes(".pregate/bin/pregate") || script.includes("project-launcher.ps1")).toBe(true);
      expect(projectOwnedCommand(command)).toBe(true);
      expect(command.length).toBeLessThan(8000);
    }
  }
  expect(projectOwnedCommand(hookCommand("/home/u/.local/share/pregate", "pre", "claude-code"))).toBe(false);
  expect(projectOwnedCommand(LEGACY)).toBe(false);
  expect(projectOwnedCommand("echo .pregate/bin/pregate")).toBe(false);
});

test("merge keeps foreign hooks in place and is byte-identical on the second run", () => {
  const before = `${JSON.stringify(FOREIGN, null, 2)}\n`;
  const once = mergeProjectClaude(before)!;
  expect(once).not.toBe(before);
  expect(mergeProjectClaude(once)).toBe(once);
  const doc = JSON.parse(once) as { permissions: unknown; hooks: Record<string, { hooks: { command: string }[] }[]> };
  expect(doc.permissions).toEqual(FOREIGN.permissions);
  expect(doc.hooks.PreToolUse![0]).toEqual(FOREIGN.hooks.PreToolUse[0]);
  expect(doc.hooks.Stop![0]).toEqual(FOREIGN.hooks.Stop[0]);
  expect(doc.hooks.UserPromptSubmit).toEqual(FOREIGN.hooks.UserPromptSubmit);
  expect(projectOwnedCommand(doc.hooks.PreToolUse!.at(-1)!.hooks[0]!.command)).toBe(true);
  expect(projectClaudeMissing(once)).toEqual([]);
  expect(projectClaudeMissing(before)).toEqual(["PreToolUse", "Stop", "SubagentStop", "SessionStart"]);
  const windows = mergeProjectClaude(before, true)!;
  expect(mergeProjectClaude(windows, true)).toBe(windows);
  const windowsDoc = JSON.parse(windows) as { hooks: { PreToolUse: { hooks: { command: string }[] }[] } };
  expect(projectOwnedCommand(windowsDoc.hooks.PreToolUse!.at(-1)!.hooks[0]!.command)).toBe(true);
  expect(windowsDoc.hooks.PreToolUse![0]!.hooks[0]!.command).toBe("echo foreign-pre");
});

test("a stale owned group is replaced in place and a mixed group stays foreign", () => {
  const once = JSON.parse(mergeProjectClaude(null)!) as { hooks: Record<string, { hooks: { command: string; timeout?: number }[] }[]> };
  const stale = structuredClone(once);
  stale.hooks.Stop![0]!.hooks[0]!.timeout = 1;
  const foreign = { hooks: [{ type: "command", command: "echo after" }] };
  stale.hooks.Stop!.push(foreign);
  const again = JSON.parse(mergeProjectClaude(JSON.stringify(stale))!) as typeof once;
  expect(again.hooks.Stop![0]).toEqual(once.hooks.Stop![0]);
  expect(again.hooks.Stop![1]).toEqual(foreign);
  const mixed = { hooks: [{ type: "command", command: "echo other" }, once.hooks.Stop![0]!.hooks[0]!] };
  const kept = JSON.parse(mergeProjectClaude(JSON.stringify({ hooks: { Stop: [mixed] } }))!) as typeof once;
  expect(kept.hooks.Stop![0]).toEqual(mixed);
  expect(projectOwnedCommand(kept.hooks.Stop![1]!.hooks[0]!.command)).toBe(true);
});

test("merge refuses a document that is not an object with event arrays", () => {
  expect(mergeProjectClaude("[]")).toBeNull();
  expect(mergeProjectClaude('{"hooks":[]}')).toBeNull();
  expect(mergeProjectClaude('{"hooks":{"PreToolUse":{}}}')).toBeNull();
  expect(projectClaudeMissing("[]")).toBeNull();
});

test("workspace trust is the dialog flag, not policy consent", () => {
  const root = "/work/repo";
  expect(workspaceTrustAccepted(JSON.stringify({ projects: { [root]: { hasTrustDialogAccepted: true } } }), root)).toBe(true);
  expect(workspaceTrustAccepted(JSON.stringify({ projects: { [`${root}/`]: { hasTrustDialogAccepted: true, extra: 1 } } }), root)).toBe(true);
  expect(workspaceTrustAccepted(JSON.stringify({ projects: { [root]: { hasTrustDialogAccepted: false } } }), root)).toBe(false);
  expect(workspaceTrustAccepted(JSON.stringify({ projects: { [root]: { hasCompletedProjectOnboarding: true } } }), root)).toBe(false);
  expect(workspaceTrustAccepted("{}", root)).toBe(false);
  const trusted = projectScope({
    root, settings: mergeProjectClaude(null), localSettings: null, claudeConfig: JSON.stringify({ projects: { [root]: { hasTrustDialogAccepted: true } } }),
    launcherPresent: true, launcherReady: true, pin: "0.0.7", engineReady: true, consentActive: false,
  });
  expect(trusted.exact).toBe(true);
  expect(trusted.lines.map((line) => line.text).join("\n")).toContain("Workspace trust and policy consent are separate.");
  expect(trusted.lines.map((line) => line.text).join("\n")).toContain("Policy consent is inactive");
  const untrusted = projectScope({ ...{
    root, settings: mergeProjectClaude(null), localSettings: null, claudeConfig: null,
    launcherPresent: true, launcherReady: true, pin: "0.0.7", engineReady: true, consentActive: true,
  } });
  expect(untrusted.lines.some((line) => line.level === "warn" && line.text.includes("does not grant policy consent"))).toBe(true);
  expect(projectScope({
    root, settings: null, localSettings: null, claudeConfig: null,
    launcherPresent: false, launcherReady: false, pin: null, engineReady: false, consentActive: false,
  }).active).toBe(false);
});
