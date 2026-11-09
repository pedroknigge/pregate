import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { controlInFile, readScriptFile } from "../src/control-file.ts";
import { guard } from "../src/shell.ts";

// Windows PowerShell 5.1 saves scripts as UTF-16LE with a BOM by default, and every ASCII character
// then carries a NUL byte. Read as UTF-8, such a script looks binary and its control commands are
// invisible to the scan.

const ctx = {
  machineOnly: false, harness: "claude-code" as const, touched: () => true, launcher: "C:/pregate/bin/pregate",
  isProtected: () => false, inScope: () => false, under: () => false, readControlFile: controlInFile, readScriptFile,
};

test.skipIf(process.platform !== "win32")("Windows PowerShell runs a UTF-16LE script that disables PREGATE, and the guard denies running it", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-utf16-"));
  const stub = join(dir, "stub");
  const marker = join(dir, "ran.txt");
  mkdirSync(stub);
  writeFileSync(join(stub, "pregate.cmd"), `@echo off\r\necho %* > "${marker}"\r\n`);
  writeFileSync(join(dir, "off.ps1"), Buffer.from("\ufeffpregate disable --yes\r\n", "utf16le"));
  writeFileSync(join(dir, "ok.ps1"), Buffer.from("\ufeffWrite-Output hello\r\n", "utf16le"));

  const env: Record<string, string | undefined> = { ...process.env };
  const path = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
  env[path] = [stub, env[path]].filter(Boolean).join(delimiter);
  const ps = Bun.spawnSync(["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", join(dir, "off.ps1")],
    { cwd: dir, env, stdout: "pipe", stderr: "pipe" });
  expect(ps.exitCode, ps.stderr.toString()).toBe(0);
  expect(readFileSync(marker, "utf8")).toContain("disable --yes");

  const cwd = dir.replaceAll("\\", "/");
  for (const command of ["powershell -NoProfile -File off.ps1", `powershell.exe -NoProfile -File ${cwd}/off.ps1`, "pwsh -File off.ps1"]) {
    expect(guard(command, cwd, ctx), command).toBe("shell-admin");
  }
  expect(guard("powershell -NoProfile -File ok.ps1", cwd, ctx)).toBeNull();
});
