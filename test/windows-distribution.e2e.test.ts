import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { compileBinary } from "../scripts/build.ts";
import { WINDOWS } from "../src/platform.ts";
import { VERSIONS } from "../src/versions.ts";

if (WINDOWS) describe("native Windows bootstrap with the real release engine", () => {
  setDefaultTimeout(120_000);
  const area = mkdtempSync(join(tmpdir(), "pregate-win-dist-"));
  const source = join(area, "archive");
  const zip = join(area, "release.zip");
  let count = 0;
  beforeAll(() => {
    mkdirSync(source);
    compileBinary("windows-x64", join(source, "pregate.exe"));
    copyFileSync("LICENSE", join(source, "LICENSE"));
    const r = Bun.spawnSync(["powershell.exe", "-NoProfile", "-Command", `Compress-Archive -Path '${source}/*' -DestinationPath '${zip}'`], {
      env: { ...process.env, PSModuleAnalysisCachePath: join(area, "powershell-module-analysis-cache") },
    });
    expect(r.exitCode).toBe(0);
  });
  // Each machine gets its own throwaway HKCU subkey instead of the tester's Environment key.
  const keys: string[] = [];
  const reg = (...args: string[]) => Bun.spawnSync(["reg.exe", ...args], { stdout: "pipe", stderr: "pipe" });
  const hkcu = (key: string) => "HKCU\\" + key;
  const testKey = () => "Software\\pregate-test-" + process.pid + "-" + count;
  const userPath = (key: string) => {
    const r = reg("query", hkcu(key), "/v", "Path");
    const line = r.stdout.toString().split(/\r?\n/).find((l) => /^\s+Path\s/.test(l));
    return line === undefined ? null : { type: line.trim().split(/\s{2,}/)[1], value: line.trim().split(/\s{2,}/)[2] ?? "" };
  };
  afterAll(() => {
    for (const key of keys) reg("delete", hkcu(key), "/f");
    rmSync(area, { recursive: true, force: true });
  });

  function install(hash: string, version?: string, extra: Record<string, string> = {}, entry = join(import.meta.dir, "../install.ps1")) {
    const key = testKey();
    keys.push(key);
    const dir = join(area, `machine-${count++}`);
    const home = join(dir, "home");
    const temp = join(dir, "tmp");
    for (const path of [home, temp, join(home, ".claude")]) mkdirSync(path, { recursive: true });
    const env = { ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: join(dir, "data"), APPDATA: join(dir, "config"),
      XDG_DATA_HOME: join(dir, "data"), XDG_STATE_HOME: join(dir, "state"), XDG_CONFIG_HOME: join(dir, "config"),
      TMPDIR: temp, TMP: temp, TEMP: temp, CODEX_HOME: join(dir, "codex"), GROK_HOME: join(dir, "grok"), CLAUDE_CONFIG_DIR: "",
      PSModulePath: join(process.env.SystemRoot!, "System32/WindowsPowerShell/v1.0/Modules"),
      // Without AppData\Local under this USERPROFILE, a long-lived PowerShell (the purge helper) writes
      // its module analysis cache relative to its working directory: the checkout.
      PSModuleAnalysisCachePath: join(dir, "powershell-module-analysis-cache"),
      PREGATE_ARCHIVE: zip, PREGATE_SHA256: hash, PREGATE_PATH_KEY: key, ...extra };
    const args = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", entry, ...(version === undefined ? [] : ["-Version", version])];
    const r = Bun.spawnSync(args, { env, stdout: "pipe", stderr: "pipe", timeout: 90_000 });
    return { code: r.exitCode, text: r.stdout.toString() + r.stderr.toString(), dir, temp, env, key, args };
  }
  test("verified ZIP bootstraps, updates and purges the real engine", async () => {
    const hash = createHash("sha256").update(readFileSync(zip)).digest("hex");
    const r = install(hash.toUpperCase());
    if (r.code !== 0) throw new Error(r.text);
    expect(r.code).toBe(0);
    expect(existsSync(join(r.dir, "data/pregate/bin/pregate.cmd"))).toBe(true);
    expect(readdirSync(r.temp)).toEqual([]);
    const bin = join(r.dir, "data", "pregate", "bin");
    expect(userPath(r.key)).toEqual({ type: "REG_EXPAND_SZ", value: bin });
    expect(r.text).toContain(`Added ${bin} to your user PATH`);
    const cli = join(r.dir, "data/pregate/bin/pregate.cmd");
    const run = (...args: string[]) => Bun.spawnSync(["cmd.exe", "/d", "/c", cli, ...args], { env: r.env, timeout: 90_000 });
    expect(run("--version").stdout.toString().trim()).toBe(`pregate ${pkg.version} (core ${VERSIONS.core})`);
    expect(run("update", "--engine", pkg.version).exitCode).toBe(0);
    expect(run("update", "--version", pkg.version).exitCode).toBe(0);
    expect(run("uninstall", "--purge", "--yes").exitCode).toBe(0);
    expect(userPath(r.key)).toEqual({ type: "REG_EXPAND_SZ", value: "" });
    for (let n = 0; n < 100 && existsSync(join(r.dir, "data/pregate")); n++) await Bun.sleep(50);
    expect(existsSync(join(r.dir, "data/pregate"))).toBe(false);
  });
  test("PATH keeps unexpanded entries, is added once and can be left alone", () => {
    const hash = createHash("sha256").update(readFileSync(zip)).digest("hex");
    const key = testKey();
    expect(reg("add", hkcu(key), "/v", "Path", "/t", "REG_EXPAND_SZ", "/d", "%SystemRoot%\\keep;", "/f").exitCode).toBe(0);
    const r = install(hash);
    if (r.code !== 0) throw new Error(r.text);
    const bin = join(r.dir, "data", "pregate", "bin");
    expect(userPath(r.key)).toEqual({ type: "REG_EXPAND_SZ", value: "%SystemRoot%\\keep;" + bin });
    const again = Bun.spawnSync(r.args, { env: r.env, stdout: "pipe", stderr: "pipe", timeout: 90_000 });
    expect(again.exitCode).toBe(0);
    expect(again.stdout.toString()).toContain("already on your user PATH");
    expect(userPath(r.key)).toEqual({ type: "REG_EXPAND_SZ", value: "%SystemRoot%\\keep;" + bin });
    const off = install(hash, undefined, { PREGATE_NO_MODIFY_PATH: "1" });
    if (off.code !== 0) throw new Error(off.text);
    expect(userPath(off.key)).toBeNull();
    expect(off.text).toContain("PATH unchanged");
  });
  test.each(["0".repeat(64), "not-a-hash"])("invalid checksum installs nothing: %s", (hash) => {
    const r = install(hash);
    expect(r.code).not.toBe(0);
    expect(existsSync(join(r.dir, "data/pregate"))).toBe(false);
    expect(readdirSync(r.temp)).toEqual([]);
  });
  test("version must be a release pin, never a branch", () => {
    const r = install("0".repeat(64), "main");
    expect(r.code).not.toBe(0); expect(r.text).toContain("Invalid version");
  });

  function publicInstall(mode: string) {
    const wrapper = join(area, "public-" + mode + ".ps1"), manifest = join(area, "sums-" + mode);
    const name = `pregate-${pkg.version}-windows-x64.zip`;
    const expected = mode === "mismatch" ? "0".repeat(64) : createHash("sha256").update(readFileSync(zip)).digest("hex");
    writeFileSync(manifest, mode === "malformed" ? "invalid manifest\n" : `${expected}  ${name}\n`);
    writeFileSync(wrapper, `param([string]$Version)
function Get-Command([string]$Name, [object]$ErrorAction) {
    if ($Name -eq 'curl.exe') { return [pscustomobject]@{ Source = 'Test-Curl' } }
    if ($Name -eq 'gh') { return [pscustomobject]@{ Source = 'gh' } }
    Microsoft.PowerShell.Core\\Get-Command -Name $Name -ErrorAction SilentlyContinue
}
function Test-Curl {
    Add-Content -LiteralPath $env:MOCK_LOG -Value ('curl ' + ($args -join ' '))
    $out = $args[[Array]::IndexOf($args, '--output') + 1]
    $name = [IO.Path]::GetFileName($args[-1])
    if ($env:MOCK_MODE -eq 'oversize') { $global:LASTEXITCODE = 63; return }
    if ($env:MOCK_MODE -eq 'private' -or ($env:MOCK_MODE -eq 'partial' -and $name -ne 'SHA256SUMS')) {
        Set-Content -LiteralPath $out -Value 'partial'
        Write-Error 'HTTP 404 private asset' -ErrorAction Continue
        $global:LASTEXITCODE = 22; return
    }
    Copy-Item -LiteralPath $(if ($name -eq 'SHA256SUMS') { $env:MOCK_SUMS } else { $env:MOCK_ZIP }) -Destination $out
    $global:LASTEXITCODE = 0
}
function gh {
    Add-Content -LiteralPath $env:MOCK_LOG -Value 'gh fallback'
    $dir = $args[[Array]::IndexOf($args, '--dir') + 1]
    if ((Test-Path -LiteralPath (Join-Path $dir 'SHA256SUMS')) -or (Test-Path -LiteralPath (Join-Path $dir '${name}'))) { throw 'partial pair was not removed' }
    Copy-Item -LiteralPath $env:MOCK_SUMS -Destination (Join-Path $dir 'SHA256SUMS')
    Copy-Item -LiteralPath $env:MOCK_ZIP -Destination (Join-Path $dir '${name}')
    $global:LASTEXITCODE = 0
}
& '${join(import.meta.dir, "../install.ps1").replaceAll("'", "''")}' -Version $Version -NoModifyPath
`);
    const networkLog = join(area, "network-" + mode + ".log");
    return { ...install("", pkg.version, { PREGATE_ARCHIVE: "", PREGATE_SHA256: "", MOCK_MODE: mode, MOCK_SUMS: manifest, MOCK_ZIP: zip, MOCK_LOG: networkLog }, wrapper), networkLog };
  }

  test.each(["public", "private", "partial"])("HTTPS %s fixture bootstraps with one complete channel and no real network or PATH write", mode => {
    const result = publicInstall(mode);
    expect(result.code, result.text).toBe(0); expect(readdirSync(result.temp)).toEqual([]); expect(userPath(result.key)).toBeNull();
    const log = readFileSync(result.networkLog, "utf8");
    expect(log.includes("gh fallback")).toBe(mode !== "public"); expect(log).toContain("curl -q --fail");
    expect(existsSync(join(result.dir, "data/pregate", pkg.version, "pregate.exe"))).toBe(true);
  });

  test.each(["mismatch", "malformed", "oversize"])("HTTPS %s never falls back or installs an engine", mode => {
    const result = publicInstall(mode);
    expect(result.code).not.toBe(0); expect(readdirSync(result.temp)).toEqual([]); expect(userPath(result.key)).toBeNull();
    expect(readFileSync(result.networkLog, "utf8")).not.toContain("gh fallback"); expect(existsSync(join(result.dir, "data/pregate"))).toBe(false);
  });
});
