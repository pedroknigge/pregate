$env:PSModulePath = $PSHOME + '\Modules;' + $env:PSModulePath
$ErrorActionPreference = 'Stop'
# Project launcher: resolves the lock's engine in <DATA>/<version>/ and never falls back to the
# global PATH launcher. Mirrors project-launcher.sh: a hook call that cannot reach the pinned
# engine fails closed (one stderr line, exit 2); any other call prints the reason and exits 1.
$argv = $args
$guide = $argv.Count -eq 0 -and !$MyInvocation.ExpectingInput -and ![Console]::IsInputRedirected -and ![Console]::IsOutputRedirected -and !$env:CI
$cli = $guide -or ($argv.Count -gt 0 -and $argv[0] -ne 'hook')
function Fail([string]$why) {
    if ($cli) {
        [Console]::Error.WriteLine("PREGATE: $why")
        exit 1
    }
    $active = $false
    foreach ($candidate in @($env:CLAUDE_PROJECT_DIR, $env:CURSOR_PROJECT_DIR, $env:GROK_WORKSPACE_ROOT, $PWD.Path)) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate '.pregate/pregate.lock.json') -PathType Leaf)) { $active = $true; break }
    }
    if (!$active) { exit 0 }
    $line = "PREGATE could not evaluate: $why; report it to the user"
    [Console]::Error.WriteLine($line.Substring(0, [Math]::Min(256, $line.Length)))
    exit 2
}
# An error this script does not expect must not end a hook with exit 1, which a harness reads as allow.
trap {
    [Console]::Error.WriteLine("PREGATE could not evaluate: the project launcher failed: $_; report it to the user")
    if ($cli) { exit 1 }
    exit 2
}
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$lock = Join-Path $root '.pregate/pregate.lock.json'
$version = $null
if (Test-Path -LiteralPath $lock -PathType Leaf) {
    if ($raw = Get-Content -LiteralPath $lock -Raw) {
        if ($raw -match '"engine"\s*:\s*"([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.]+)?)"') { $version = $Matches[1] }
    }
}
$dataBase = if ($env:XDG_DATA_HOME) { $env:XDG_DATA_HOME } elseif ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE 'AppData\Local' }
$data = Join-Path $dataBase 'pregate'
if (!$version) { Fail 'the lock names no valid engine version' }
$engine = Join-Path $data "$version/pregate.exe"
# An empty engine file is not an engine: the same test as the shell launcher ([ -s ]).
if (!(Test-Path -LiteralPath $engine -PathType Leaf) -or (Get-Item -LiteralPath $engine).Length -eq 0) {
    Fail "engine $version is not installed; run pregate prepare"
}
if ($guide) {
    & $engine guide
    exit $LASTEXITCODE
}
if ($cli) {
    & $engine @argv
    exit $LASTEXITCODE
}
[Console]::InputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$raw = if ($MyInvocation.ExpectingInput) { $input | Out-String } else { [Console]::In.ReadToEnd() }
$info = [Diagnostics.ProcessStartInfo]::new()
$info.FileName = $engine
$info.Arguments = '--supervise "' + $data + '" ' + $version + ' ' + ($argv -join ' ')
$info.UseShellExecute = $false
$info.RedirectStandardInput = $info.RedirectStandardOutput = $info.RedirectStandardError = $true
$info.StandardOutputEncoding = $info.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
$process = [Diagnostics.Process]::Start($info)
$stdout = $process.StandardOutput.ReadToEndAsync()
$stderr = $process.StandardError.ReadToEndAsync()
$deadline = if ($argv[1] -eq 'stop') { 50000 } elseif ($argv[1] -eq 'session-start') { 12000 } else { 110000 }
$clock = [Diagnostics.Stopwatch]::StartNew()
$bytes = [Text.Encoding]::UTF8.GetBytes($raw)
$inputTask = $process.StandardInput.BaseStream.WriteAsync($bytes, 0, $bytes.Length)
if (!$inputTask.Wait($deadline)) { $process.Kill(); Fail 'the engine did not read its input in time' }
$process.StandardInput.Close()
if (!$process.WaitForExit([int][Math]::Max(1, $deadline - $clock.ElapsedMilliseconds))) { $process.Kill(); Fail 'the engine timed out' }
[Console]::Out.Write($stdout.Result)
[Console]::Error.Write($stderr.Result)
exit $process.ExitCode
