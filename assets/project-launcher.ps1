$ErrorActionPreference = 'Stop'
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
function EnginePath {
    $engine = Join-Path $data "$version/pregate.exe"
    if (!$version) { throw 'the lock names no valid engine version' }
    if (!(Test-Path -LiteralPath $engine -PathType Leaf) -or (Get-Item -LiteralPath $engine).Length -eq 0) { throw "engine $version is not installed; run pregate prepare" }
    return $engine
}
if ($args.Count -eq 0 -and !$MyInvocation.ExpectingInput -and ![Console]::IsInputRedirected -and ![Console]::IsOutputRedirected -and !$env:CI) {
    $engine = EnginePath
    & $engine guide
    exit $LASTEXITCODE
}
if ($args.Count -eq 0 -or $args[0] -eq 'hook') {
    $engine = EnginePath
    [Console]::InputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    $raw = if ($MyInvocation.ExpectingInput) { $input | Out-String } else { [Console]::In.ReadToEnd() }
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $engine
    $info.Arguments = '--supervise "' + $data + '" ' + $version + ' ' + ($args -join ' ')
    $info.UseShellExecute = $false
    $info.RedirectStandardInput = $info.RedirectStandardOutput = $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = $info.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    $process = [Diagnostics.Process]::Start($info)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $deadline = if ($args[1] -eq 'stop') { 50000 } elseif ($args[1] -eq 'session-start') { 12000 } else { 110000 }
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $bytes = [Text.Encoding]::UTF8.GetBytes($raw)
    $inputTask = $process.StandardInput.BaseStream.WriteAsync($bytes, 0, $bytes.Length)
    if (!$inputTask.Wait($deadline)) { $process.Kill(); exit 2 }
    $process.StandardInput.Close()
    if (!$process.WaitForExit([int][Math]::Max(1, $deadline - $clock.ElapsedMilliseconds))) { $process.Kill(); exit 2 }
    [Console]::Out.Write($stdout.Result)
    [Console]::Error.Write($stderr.Result)
    exit $process.ExitCode
}
$engine = EnginePath
& $engine @args
exit $LASTEXITCODE
