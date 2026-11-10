import { expect, test } from "bun:test";
import { absolute } from "../src/harness/wire.ts";
import { within } from "../src/gate.ts";
import { machineGlobs, matches, pathKey, protects, protectedGlobs, slash } from "../src/paths.ts";
import { exact, merge, ownedCommand, unmerge } from "../src/register.ts";
import { guard } from "../src/shell.ts";
import { launcherFailure } from "../src/supervisor.ts";
import { commandScript, packedPowershellCommand, powershellCommand, psQuote, windowsHook } from "../src/windows-command.ts";
import { HARNESSES } from "../src/harness/profile.ts";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { WINDOWS } from "../src/platform.ts";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { HarnessId } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

function withCleanup<T>(work: () => T, cleanup: () => void): T {
  try { return work(); } finally { cleanup(); }
}

test.each(["C:\\Users\\Pedro\\repo\\src\\a.ts", "c:/repo/src/a.ts", "\\\\server\\share\\repo\\src\\a.ts", "\\\\?\\C:\\repo\\src\\a.ts", "\\\\?\\UNC\\server\\share\\a.ts"])("absolute Windows payload: %s", (path) => expect(absolute(path)).toBe(true));
test.each(["C:src/a.ts", "\\repo\\a.ts", "C:/repo/../a.ts", "C:\\repo\\.\\a.ts", "C:/repo//a.ts", "\\\\server", "\\\\.\\pipe\\a", "C:/repo/a.ts:stream"])("ambiguous Windows payload refuses: %s", (path) => expect(absolute(path)).toBe(false));

test("Windows spellings compare as the same path without matching sibling drives/shares", () => {
  expect(pathKey("\\\\?\\C:\\REPO\\src\\..\\.PREGATE. \\preset.json")).toBe("c:/repo/.pregate/preset.json");
  expect(slash("\\\\?\\UNC\\server\\share\\repo\\a.ts")).toBe("//server/share/repo/a.ts");
  expect(within("C:/repo", "c:\\REPO\\src\\a.ts")).toBe(true);
  expect(within("C:/repo", "D:/repo/src/a.ts")).toBe(false);
  expect(within("//server/share", "//server/share2/a.ts")).toBe(false);
  expect(matches("src/**/*.ts", "src\\domain\\a.ts")).toBe(true);
  const globs = protectedGlobs("C:/repo", ["D:/team/rules"], { home: "C:/Users/Pedro", data: "C:/Users/Pedro/AppData/Local/State/pregate", engine: "C:/Users/Pedro/AppData/Local/pregate" });
  for (const file of ["\\\\?\\C:\\repo\\.PREGATE\\preset.json", "D:\\team\\rules\\check.json", "C:\\Users\\Pedro\\AppData\\Local\\pregate\\bin\\launcher.ps1"]) expect(protects(file, globs)).toBe(true);
});

const ctx = {
  machineOnly: false, harness: "claude-code" as const, launcher: null, touched: () => true,
  isProtected: (p: string) => pathKey(p).includes("/.pregate/"),
  inScope: (p: string) => within("C:/repo/src", p), under: (p: string) => within("C:/repo", p),
};
test.each(['copy /y "C:\\repo\\notes.txt" "C:\\repo\\src\\a.ts"', 'move /Y notes.txt src\\a.ts', 'del /q src\\a.ts', 'type notes.txt > src\\a.ts', 'echo hello > src\\a.ts', 'cmd.exe /d /c "copy /y notes.txt src\\a.ts"', 'powershell.exe -Command "Set-Content src/a.ts hello"'])("cmd/PowerShell write denies: %s", (command) => expect(guard(command, "C:/repo", ctx)).toBe("shell-write"));
test.each(['type src\\a.ts', 'copy notes.txt D:\\outside\\a.txt', 'echo hello > D:\\outside\\a.txt'])("read or out-of-scope Windows destination: %s", (command) => expect(guard(command, "C:/repo", ctx)).toBeNull());
test.each(['set CODEX_HOME=C:\\other & codex.exe exec hi', '$env:USERPROFILE="C:/other"; grok.exe -p hi'])("Windows relocation denies: %s", (command) => expect(guard(command, "C:/repo", ctx)).toBe("hook-switch"));

test("Windows command wrappers keep administrative and launcher protections", () => {
  expect(guard('pregate.cmd enable --yes', "C:/repo", ctx)).toBe("shell-admin");
  expect(guard('C:\\tools\\codex.cmd --no-hooks exec hi', "C:/repo", ctx)).toBe("hook-switch");
  expect(guard('"C:/repo/.pregate/pregate.cmd" check --stdin', "C:/repo", { ...ctx, launcher: "C:\\repo\\.pregate\\pregate.cmd" })).toBeNull();
  const machine = { ...ctx, isProtected: (p: string) => pathKey(p).includes("/.codex/") };
  for (const command of ['type "%CODEX_HOME%\\config.toml"', 'Get-Content "$env:CODEX_HOME/config.toml"']) expect(guard(command, "C:/repo", machine)).toBe("protected-path");
  const home = "C:\\Users\\Pedro";
  const globs = machineGlobs(home, { codexHome: `${home}\\.codex`, grokHome: `${home}\\.grok`, claudeConfig: null, data: `${home}\\AppData\\Local\\pregate`, state: `${home}\\AppData\\Local\\State\\pregate` }, slash);
  for (const command of ['type "%LOCALAPPDATA%\\pregate\\bin\\launcher.ps1"', 'Get-Content "$env:LOCALAPPDATA/State/pregate/consent.json"']) expect(guard(command, "C:/repo", { ...ctx, isProtected: (p) => protects(p, globs) })).toBe("protected-path");
});

test("Windows registrations round-trip and keep foreign groups; the command is shell-independent", () => {
  const data = "C:/Users/Pedro's $home →/AppData/Local/pregate";
  const original = '{"hooks":{"PreToolUse":[{"hooks":[{"command":"echo foreign"}]}]}}';
  const text = merge(original, "codex", data)!;
  const group = JSON.parse(text).hooks.PreToolUse[1];
  expect(exact(group, "codex", data)).toBe(true);
  expect(ownedCommand(group.hooks[0].command, data)).toBe(true);
  expect(JSON.parse(unmerge(text, "codex", data)!.text)).toEqual(JSON.parse(original));
  const command = windowsHook(data, "pre", "agy");
  expect(command).toMatch(/^powershell.exe [A-Za-z0-9 +/=.-]+$/);
  expect(command.length).toBeLessThan(8191);
  expect(commandScript(command)).toContain("Pedro''s $home →");
  expect(commandScript(command)).toContain("workspacePaths");
  // Registrations written before the script was deflated are still recognized as ours.
  const plain = powershellCommand(`$raw | & ${psQuote(`${data}/bin/launcher.ps1`)} hook pre --harness codex`);
  expect(ownedCommand(plain, data)).toBe(true);
});

test("the Windows hook fits cmd.exe's 8191-character line for long installation paths", () => {
  // Before deflating, a data path past 43 characters (a 14-letter user name) exceeded it.
  const data = `C:/Users/${"a-long-windows-user-name-".repeat(8)}/AppData/Local/pregate`;
  for (const kind of ["pre", "stop", "session-start"] as const) for (const h of ["claude-code", "codex", "cursor", "grok", "agy"] as const) {
    const command = windowsHook(data, kind, h);
    expect(command).toMatch(/^powershell.exe [A-Za-z0-9 +/=.-]+$/);
    expect(command.length).toBeLessThan(8191);
    expect(commandScript(command)).toContain(psQuote(`${data}/bin/launcher.ps1`));
  }
});

test("setup refuses an installation path whose compressed hook still exceeds cmd.exe's limit", () => {
  const data = "C:/" + Array.from({ length: 40 }, (_, i) => createHash("sha256").update(String(i)).digest("hex")).join("/");
  expect(() => merge(null, "codex", data)).toThrow("use a shorter PREGATE data directory");
});

test("invalid and oversized foreign compressed hooks survive setup and uninstall", () => {
  const data = "C:/Users/Pedro/AppData/Local/pregate";
  const invalid = powershellCommand("$ProgressPreference='SilentlyContinue'; iex ([IO.StreamReader]::new([IO.Compression.DeflateStream]::new([IO.MemoryStream]::new([Convert]::FromBase64String('AAAA')),[IO.Compression.CompressionMode]0))).ReadToEnd()");
  const oversized = packedPowershellCommand("x".repeat(1024 * 1024 + 1));
  for (const command of [invalid, oversized]) {
    const before = { hooks: { PreToolUse: [{ hooks: [{ command }] }] } };
    expect(ownedCommand(command, data)).toBe(false);
    const installed = merge(JSON.stringify(before), "codex", data)!;
    expect(JSON.parse(installed).hooks.PreToolUse[0]).toEqual(before.hooks.PreToolUse[0]);
    expect(JSON.parse(unmerge(installed, "codex", data)!.text)).toEqual(before);
  }
});

test.skipIf(!WINDOWS)("a hidden consent record cannot bypass either the launcher or its fallback", () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-hidden-consent-"));
  const data = join(area, "data/pregate");
  const root = join(area, "repo");
  const record = join(data, "consent/hidden.json");
  const launcher = join(data, "bin/launcher.ps1");
  withCleanup(() => {
    mkdirSync(root); mkdirSync(join(data, "consent"), { recursive: true }); mkdirSync(join(data, "bin"));
    expect(Bun.spawnSync(["git", "init", root], { stdout: "pipe", stderr: "pipe" }).exitCode).toBe(0);
    writeFileSync(record, JSON.stringify({ root: slash(root), common: slash(join(root, ".git")) }));
    expect(Bun.spawnSync(["attrib.exe", "+H", record], { stdout: "pipe", stderr: "pipe" }).exitCode).toBe(0);
    writeFileSync(launcher, "exit 2\n");
    for (const installed of [true, false]) {
      if (!installed) rmSync(launcher);
      const result = Bun.spawnSync(["cmd.exe", "/d", "/c", windowsHook(data, "pre", "agy")], {
        cwd: root, stdin: Buffer.from(JSON.stringify({ cwd: root, toolCall: { args: {} } })), stdout: "pipe", stderr: "pipe", timeout: 30_000,
      });
      expect(result.exitCode).toBe(2);
      if (!installed) expect(result.stderr.toString()).toContain("PREGATE could not evaluate");
    }
  }, () => { removeTree(area); });
}, 65_000);

test.skipIf(!WINDOWS)("cmd.exe runs the deflated hook: no consent anywhere exits 0 without the launcher", () => {
  const area = mkdtempSync(join(tmpdir(), `pregate-cmd-${"long-path-segment-".repeat(6)}`));
  withCleanup(() => {
    const r = Bun.spawnSync(["cmd.exe", "/d", "/c", windowsHook(join(area, "data/pregate"), "pre", "agy")],
      { stdin: Buffer.from('{"toolCall":{"args":{}}}'), stdout: "pipe", stderr: "pipe", timeout: 30_000 });
    expect({ code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() }).toEqual({ code: 0, stdout: "", stderr: "" });
  }, () => { removeTree(area); });
}, 30_000);

test.skipIf(!WINDOWS)("Windows PowerShell uses its own utility module despite an incompatible inherited module path", () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-ps-modules-"));
  withCleanup(() => {
    const foreign = join(area, "foreign/Microsoft.PowerShell.Utility"); mkdirSync(foreign, { recursive: true });
    writeFileSync(join(foreign, "Microsoft.PowerShell.Utility.psd1"), "@{ ModuleVersion = '99.0'; RootModule = 'unavailable.psm1' }");
    const file = join(area, "content"); writeFileSync(file, "public hash input");
    const env = { ...process.env, PSModulePath: join(area, "foreign") };
    const pathProbe = `[Console]::Out.WriteLine('OwnModules:' + ($env:PSModulePath.Split(';') -contains [System.IO.Path]::Combine($PSHOME,'Modules')))`;
    const script = `$ErrorActionPreference='Stop'; ${pathProbe}; [Console]::Out.WriteLine((Get-FileHash -LiteralPath ${psQuote(file)} -Algorithm SHA256).Hash)`;
    // Some hosts find their own utility module even with a foreign search path.
    // Check the search-path repair itself instead of requiring that host lookup to fail.
    const inherited = `$env:PSModulePath=${psQuote(join(area, "foreign"))}; `;
    const control = Bun.spawnSync(["powershell.exe", "-NoProfile", "-Command", inherited + pathProbe], { env, stdout: "pipe", stderr: "pipe", timeout: 10000 });
    expect(control.exitCode).toBe(0); expect(control.stdout.toString().trim()).toBe("OwnModules:False");
    const fixed = Bun.spawnSync(["powershell.exe", "-NoProfile", "-Command", inherited + commandScript(powershellCommand(script))], { env, stdout: "pipe", stderr: "pipe", timeout: 10000 });
    expect(fixed.exitCode).toBe(0);
    expect(fixed.stdout.toString().trim().split(/\r?\n/)).toEqual(["OwnModules:True", createHash("sha256").update("public hash input").digest("hex").toUpperCase()]);
    const installer = Bun.spawnSync(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(import.meta.dir, "../install.ps1")], {
      env: { ...env, PREGATE_ARCHIVE: file, PREGATE_SHA256: "0".repeat(64) }, stdout: "pipe", stderr: "pipe", timeout: 10000,
    });
    expect(installer.exitCode).toBe(1); expect(installer.stderr.toString()).toContain("SHA-256 mismatch; nothing installed");
  }, () => { removeTree(area); });
}, 35_000);

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("%s decodes native Windows targets from its captured envelope", (h) => {
  const names: Record<HarnessId, string> = { "claude-code": "pre-write.json", codex: "codex/pre-apply-patch-add-update.json", cursor: "cursor/pre-write-strreplace.json", grok: "grok/pre-write.json", agy: "agy/pre-write_to_file.json" };
  const p = JSON.parse(readFileSync(join(import.meta.dir, "payloads", names[h]), "utf8"));
  const path = "C:\\repo\\src\\a.ts";
  if (h === "agy") { p.workspacePaths = ["C:\\repo"]; p.toolCall.args.TargetFile = path; }
  else if (h === "grok") { p.cwd = p.workspaceRoot = "C:\\repo"; p.toolInput.file_path = path; }
  else if (h === "codex") { p.cwd = "C:\\repo"; p.tool_input = { command: `*** Begin Patch\n*** Add File: ${path}\n+export {};\n*** End Patch\n` }; }
  else { p.cwd = "C:\\repo"; p.workspace_roots = [p.cwd]; p.tool_input = { file_path: path, content: "export {};" }; }
  const event = HARNESSES[h].decode("pre", JSON.stringify(p), { projectDir: "C:\\repo", grokEvent: null, remote: false });
  expect(event).toMatchObject({ kind: "pre-edit", changes: [{ path }] });
  if (h === "codex") {
    p.tool_input.command = `*** Begin Patch\n*** Add File: ${path}\n+export {};\n*** Add File: C:/repo/src/a.ts\n+export {};\n*** End Patch\n`;
    expect(HARNESSES[h].decode("pre", JSON.stringify(p), { projectDir: "C:\\repo", grokEvent: null, remote: false })).toHaveProperty("cause", "cannot-reconstruct");
  }
});

test("supervisor failures preserve event dialects and Codex's nonempty stderr requirement", () => {
  expect(launcherFailure("pre", false, "{}", "engine crashed")).toMatchObject({ exit: 2, stdout: "" });
  expect(launcherFailure("pre", false, "{}", "engine crashed").stderr).toContain("engine crashed");
  expect(JSON.parse(launcherFailure("stop", true, "{}", "timeout").stdout).decision).toBe("block");
  expect(launcherFailure("stop", true, '{"stop_hook_active":true}', "timeout").exit).toBe(0);
  expect(launcherFailure("stop", false, "{}", "timeout")).toEqual({ exit: 0, stdout: "", stderr: "" });
  expect(JSON.parse(launcherFailure("session-start", true, "{}", "missing").stdout).systemMessage).toContain("missing");
});
