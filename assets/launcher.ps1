$env:PSModulePath = $PSHOME + '\Modules;' + $env:PSModulePath
$ErrorActionPreference = 'Stop'
$version = '@ENGINE_VERSION@'
$data = Split-Path $PSScriptRoot -Parent
$engine = Join-Path $data "$version/pregate.exe"
if (!(Test-Path -LiteralPath $engine -PathType Leaf) -or (Get-Item -LiteralPath $engine).Length -eq 0) {
    [Console]::Error.WriteLine("PREGATE: engine $version is not installed; reinstall PREGATE")
    exit 1
}
if ($args.Count -eq 0 -and !$MyInvocation.ExpectingInput -and ![Console]::IsInputRedirected -and ![Console]::IsOutputRedirected -and !$env:CI) {
    & $engine guide
    exit $LASTEXITCODE
}
if ($args.Count -eq 0 -or $args[0] -eq 'hook') {
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
    $deadline = if ($args[1] -eq 'stop') { 50000 } elseif ($args[1] -eq 'session-start' -or $args[1] -eq 'post-invocation') { 12000 } else { 110000 }
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $bytes = [Text.Encoding]::UTF8.GetBytes($raw)
    $inputTask = $process.StandardInput.BaseStream.WriteAsync($bytes, 0, $bytes.Length)
    if (!$inputTask.Wait($deadline)) { $process.Kill(); exit 1 }
    $process.StandardInput.Close()
    if (!$process.WaitForExit([int][Math]::Max(1, $deadline - $clock.ElapsedMilliseconds))) { $process.Kill(); exit 1 }
    [Console]::Out.Write($stdout.Result)
    [Console]::Error.Write($stderr.Result)
    exit $process.ExitCode
} else {
    & $engine @args
}
exit $LASTEXITCODE
