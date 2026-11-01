import type * as Zlib from "node:zlib";
import { slash } from "./paths.ts";
import type { HarnessId, HookKind } from "./types.ts";

// Loaded on first use: node:zlib takes milliseconds to initialize, and every hook would pay it.
const zlib = () => require("node:zlib") as typeof Zlib;

// PS7 -> intermediate process -> powershell.exe otherwise inherits incompatible modules.
export const PS_MODULES = "$env:PSModulePath=$PSHOME+'\\Modules;'+$env:PSModulePath; ";

// EncodedCommand is UTF-16LE and has no shell metacharacters: cmd, PowerShell and Git Bash
// pass the same bytes, including paths containing spaces, quotes, dollars and non-ASCII text.
export function powershellCommand(script: string): string {
  return `powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${Buffer.from(PS_MODULES + script, "utf16le").toString("base64")}`;
}

// cmd.exe refuses a command line over 8191 characters, and UTF-16 + base64 makes the hook script
// 2.7× its length: with the inline fallback, a data path past ~43 characters (a 14-letter user
// name) stopped every hook from running under cmd. Such a script travels deflated in ASCII base64,
// unpacked by a fixed bootstrap that still contains no shell metacharacter. Unpacking costs about
// 0.6 s per call, so a script that fits keeps the plain form (docs/research/windows-hook-latency.md).
const CMD_LINE = 8191 - 64;
const UNPACK = /^\$ProgressPreference='SilentlyContinue'; iex \(\[IO\.StreamReader\]::new\(\[IO\.Compression\.DeflateStream\]::new\(\[IO\.MemoryStream\]::new\(\[Convert\]::FromBase64String\('([A-Za-z0-9+/=]+)'\)\),\[IO\.Compression\.CompressionMode\]0\)\)\)\.ReadToEnd\(\)$/;
export function packedPowershellCommand(script: string): string {
  const packed = zlib().deflateRawSync(Buffer.from(PS_MODULES + script, "utf8"), { level: 9 }).toString("base64");
  return powershellCommand(`$ProgressPreference='SilentlyContinue'; iex ([IO.StreamReader]::new([IO.Compression.DeflateStream]::new([IO.MemoryStream]::new([Convert]::FromBase64String('${packed}')),[IO.Compression.CompressionMode]0))).ReadToEnd()`);
}

export function psQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function windowsHook(data: string, kind: HookKind, harness: HarnessId): string {
  const path = psQuote(`${slash(data)}/bin/launcher.ps1`);
  // Let the supervisor decide whether protection is active. A directory listing with suppressed
  // errors cannot prove that consent is absent, and hidden records are still valid records.
  const dirs = `$c=${psQuote(`${slash(data)}/consent`)}; $proposals=${psQuote(`${slash(data)}/proposals`)}; `;
  const script = `$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'; $OutputEncoding=[Console]::InputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $raw=[Console]::In.ReadToEnd(); ${dirs}try { if (!(Test-Path -LiteralPath ${path} -PathType Leaf)) { throw 'Missing launcher' }; $raw | & ${path} hook ${kind} --harness ${harness}; $rc=$LASTEXITCODE; if ($rc -eq 0 -or $rc -eq 2) { exit $rc } } catch {}; ${fallback(data, kind, harness)}`;
  const plain = powershellCommand(script);
  const command = plain.length <= CMD_LINE ? plain : packedPowershellCommand(script);
  if (command.length > CMD_LINE) throw new Error("Windows hook exceeds the cmd.exe command limit; use a shorter PREGATE data directory and rerun setup.");
  return command;
}

// Independent of the installation: a missing/corrupt launcher must still deny a consenting
// worktree. Match both canonical root and Git common directory, never a committed preset alone.
function fallback(data: string, kind: HookKind, harness: HarnessId): string {
  const stop = kind === "stop" && harness === "claude-code";
  const output = kind === "session-start" || (kind === "stop" && !stop) ? "exit 0"
    : stop ? `if ($env:GROK_HOOK_EVENT -or $env:CURSOR_VERSION) { exit 0 }; if ($p.stop_hook_active) { [Console]::Out.WriteLine('{"systemMessage":"PREGATE could not verify this turn; run pregate doctor"}'); exit 0 }; [Console]::Out.WriteLine('{"decision":"block","reason":"PREGATE could not verify this turn; run pregate doctor"}'); exit 2`
      : `[Console]::Error.WriteLine('PREGATE could not evaluate: its launcher failed; report it to the user'); exit 2`;
  return `$ErrorActionPreference='Continue'; $active=$false; ${REAL} try { $p=$raw | ConvertFrom-Json -ErrorAction SilentlyContinue; $dirs=@($env:CLAUDE_PROJECT_DIR,$env:CURSOR_PROJECT_DIR,$env:GROK_WORKSPACE_ROOT,(Get-Location).Path,$p.cwd,$p.workspaceRoot,$p.tool_input.file_path,$p.toolInput.file_path,$p.toolCall.args.TargetFile)+@($p.workspacePaths)+@($p.workspace_roots); $records=@(Get-ChildItem -Force -LiteralPath $c -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json }); $reviews=@(Get-ChildItem -Force -LiteralPath $proposals -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json }); foreach ($candidate in $dirs) { if (!$candidate) { continue }; $d=real $candidate; while ($d) { $g=(& git -C $d rev-parse --path-format=absolute --git-common-dir 2>$null); if ($LASTEXITCODE -eq 0 -and $g) { $g=real $g } else { $g=$null }; if ($records | Where-Object { -not $_.disabled -and $_.root.TrimEnd('/') -ieq $d.TrimEnd('/') -and (!$g -or $_.common.TrimEnd('/') -ieq $g.TrimEnd('/')) }) { $active=$true; break }; if ($reviews | Where-Object { $_.root.TrimEnd('/') -ieq $d.TrimEnd('/') }) { $active=$true; break }; if (Test-Path -LiteralPath (Join-Path $d '.git')) { break }; $parent=[IO.Directory]::GetParent($d); $d=if ($parent) { $parent.FullName } else { $null } }; if ($active) { break } } } catch { if ($records.Count -or $reviews.Count) { $active=$true } }; if (!$active) { exit 0 }; ${output}`;
}

// PowerShell 5.1 exposes junction/symlink targets, including relative targets. Resolve every
// ancestor so a registration reached through a junction is still the same consenting worktree.
const REAL = String.raw`function real($x) { for($n=0;$n -lt 40;$n++) { $x=[IO.Path]::GetFullPath($x); $d=$x; $tail=''; while($d) { $i=Get-Item -LiteralPath $d -Force -ErrorAction SilentlyContinue; if($i.Target) { $t=@($i.Target)[0]; if(![IO.Path]::IsPathRooted($t)) { $t=Join-Path (Split-Path $d) $t }; $x=Join-Path $t $tail; break }; $tail=(Split-Path $d -Leaf)+'/'+$tail; $d=Split-Path $d -Parent }; if(!$d) { return $x.Replace('\\?\UNC\','//').Replace('\\?\','').Replace('\','/') } }; throw 'Path loop' };`;

// The script a registered command runs, unpacking the deflated form; older registrations are plain.
export function commandScript(command: string): string {
  const encoded = /-EncodedCommand ([A-Za-z0-9+/=]+)$/.exec(command)?.[1];
  if (encoded === undefined) return command;
  const script = Buffer.from(encoded, "base64").toString("utf16le");
  const packed = UNPACK.exec(script.startsWith(PS_MODULES) ? script.slice(PS_MODULES.length) : script)?.[1];
  if (packed === undefined) return script;
  return inflatedScript(packed, command);
}

// Registrations can belong to another tool. Invalid or oversized compressed data stays opaque.
function inflatedScript(packed: string, command: string): string {
  try { return zlib().inflateRawSync(Buffer.from(packed, "base64"), { maxOutputLength: 1024 * 1024 }).toString("utf8"); }
  catch { return command; }
}
