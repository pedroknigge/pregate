$env:PSModulePath = $PSHOME + '\Modules;' + $env:PSModulePath
$ErrorActionPreference = 'Stop'
$version = '@ENGINE_VERSION@'
$data = Split-Path $PSScriptRoot -Parent
$engine = Join-Path $data "$version/pregate.exe"

function To-Key([string]$p) {
    if ([string]::IsNullOrWhiteSpace($p)) { return $null }
    $plain = $p
    if ($plain.StartsWith('\\?\UNC\')) { $plain = '\\' + $plain.Substring(7) }
    elseif ($plain.StartsWith('\\?\')) { $plain = $plain.Substring(4) }
    try { $full = [IO.Path]::GetFullPath($plain) } catch { return $null }
    return ($full -replace '\\', '/').TrimEnd('/').ToLowerInvariant()
}

function Git-Common([string]$dir) {
    # A worktree's common dir is on disk. Read it before starting git, which can be missing or slow.
    $marker = Join-Path $dir '.git'
    if (Test-Path -LiteralPath $marker -PathType Leaf) {
        try {
            $text = Get-Content -LiteralPath $marker -Raw -ErrorAction Stop
            if ($text -match '(?m)^gitdir: (.+?)\s*$') {
                $pointed = $Matches[1].Trim()
                if (-not [IO.Path]::IsPathRooted($pointed)) { $pointed = [IO.Path]::GetFullPath((Join-Path $dir $pointed)) }
                $commonFile = Join-Path $pointed 'commondir'
                if (Test-Path -LiteralPath $commonFile -PathType Leaf) {
                    $rel = (Get-Content -LiteralPath $commonFile -Raw -ErrorAction Stop).Trim()
                    $common = if ([IO.Path]::IsPathRooted($rel)) { $rel } else { [IO.Path]::GetFullPath((Join-Path $pointed $rel)) }
                    return (To-Key $common)
                }
                return (To-Key $pointed)
            }
        } catch {}
    }
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = 'git'
        $psi.Arguments = '-C "' + ($dir -replace '"', '\"') + '" rev-parse --path-format=absolute --git-common-dir'
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        $p = [System.Diagnostics.Process]::Start($psi)
        if (-not $p.WaitForExit(5000)) { try { $p.Kill() } catch {} ; return $null }
        if ($p.ExitCode -ne 0) { return $null }
        $line = ($p.StandardOutput.ReadToEnd() -split "`r?`n")[0]
        if ([string]::IsNullOrWhiteSpace($line)) { return $null }
        $line = $line.Trim()
        if (-not [IO.Path]::IsPathRooted($line)) { $line = Join-Path $dir $line }
        return (To-Key $line)
    } catch { return $null }
}

function Test-Candidate([string]$candidate) {
    if ([string]::IsNullOrWhiteSpace($candidate)) { return 'no' }
    $dir = $candidate
    try {
        $item = Get-Item -LiteralPath $candidate -Force -ErrorAction Stop
        if (-not $item.PSIsContainer) { return 'no' }
        $dir = $item.FullName
        # Windows PowerShell 5.1 has no .Target. A junction must become the path consent stored.
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            $quoted = '"' + ($item.FullName -replace '"', '""') + '"'
            $out = & cmd.exe /d /c "cd /d $quoted && cd"
            $line = @($out | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) | Select-Object -Last 1
            if ($line) { $dir = $line.Trim() }
        }
    } catch { return 'no' }
    $dKey = To-Key $dir
    if (-not $dKey) { return 'no' }
    $gitPath = Join-Path $dir '.git'
    $gitDir = $false
    if (Test-Path -LiteralPath $gitPath -PathType Container) {
        $gitItem = Get-Item -LiteralPath $gitPath -Force
        if (-not ($gitItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) { $gitDir = $true }
    }
    $gKey = $null
    $gitKnown = $true
    if ($gitDir) { $gKey = To-Key $gitPath }
    else {
        $gKey = Git-Common $dir
        if (-not $gKey) { $gitKnown = $false }
    }
    $rootOff = $false; $projectOff = $false; $rootOn = $false; $repoOn = $false; $proposal = $false
    foreach ($rec in $script:ConsentRecords) {
        $root = To-Key ([string]$rec.root)
        $common = To-Key ([string]$rec.common)
        $repo = To-Key ([string]$rec.repo)
        if ($root -and $root -eq $dKey) {
            if ($rec.disabled -eq $true) { $rootOff = $true }
            if ($common -and $common -eq $gKey) { $rootOn = $true }
        }
        if ($repo -and $repo -eq $gKey) {
            if ($rec.disabled -eq $true) { $projectOff = $true } else { $repoOn = $true }
        }
        if ($rec.kind -eq 'proposal' -and $root -eq $dKey) { $proposal = $true }
    }
    if ($projectOff -or $rootOff) { return 'no' }
    if ($rootOn -or $repoOn -or $proposal) { return 'yes' }
    # Unknown git runs the engine, matching the shell. A known repo with no record does not.
    if (-not $gitKnown) { return 'yes' }
    if ($gitDir -or (Test-Path -LiteralPath $gitPath)) { return 'no' }
    $parent = Split-Path $dir -Parent
    if ($parent -and ($parent -ne $dir)) { return (Test-Candidate $parent) }
    return 'no'
}

function Test-PregateEnforced([string]$raw) {
    $script:ConsentRecords = @()
    foreach ($pair in @(
        @{ Dir = (Join-Path $data 'consent'); Kind = 'consent' },
        @{ Dir = (Join-Path $data 'proposals'); Kind = 'proposal' }
    )) {
        if (-not (Test-Path -LiteralPath $pair.Dir)) { continue }
        foreach ($f in [IO.Directory]::EnumerateFiles($pair.Dir, '*.json')) {
            try {
                $obj = Get-Content -LiteralPath $f -Raw -ErrorAction Stop | ConvertFrom-Json
                $obj | Add-Member -NotePropertyName kind -NotePropertyValue $pair.Kind -Force
                $script:ConsentRecords += $obj
            } catch {}
        }
    }
    foreach ($c in @($env:CLAUDE_PROJECT_DIR, $env:CURSOR_PROJECT_DIR, $env:GROK_WORKSPACE_ROOT, $PWD.Path)) {
        if ($c -and (Test-Candidate $c) -eq 'yes') { return $true }
    }
    if ($raw) {
        foreach ($m in [regex]::Matches($raw, '"(?:cwd|workspaceRoot|workspace_root|file_path|filePath|TargetFile|Path|Cwd)"\s*:\s*"([^"\\]*)"')) {
            if ($m.Groups[1].Value -and (Test-Candidate $m.Groups[1].Value) -eq 'yes') { return $true }
        }
        if ($raw -match '"workspacePaths"\s*:\s*\[\s*"([^"\\]*)"') {
            if ((Test-Candidate $Matches[1]) -eq 'yes') { return $true }
        }
    }
    return $false
}

function Require-Engine {
    if (!(Test-Path -LiteralPath $engine -PathType Leaf) -or (Get-Item -LiteralPath $engine).Length -eq 0) {
        [Console]::Error.WriteLine("PREGATE: engine $version is not installed; reinstall PREGATE")
        exit 1
    }
}

$guided = $args.Count -eq 0 -and !$MyInvocation.ExpectingInput -and ![Console]::IsInputRedirected -and ![Console]::IsOutputRedirected -and !$env:CI
if ($guided) {
    Require-Engine
    & $engine guide
    exit $LASTEXITCODE
}
if ($args.Count -eq 0 -or $args[0] -eq 'hook') {
    [Console]::InputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    $raw = if ($MyInvocation.ExpectingInput) { $input | Out-String } else { [Console]::In.ReadToEnd() }
    # Only a registered `hook pre`. A bare call is `hook auto` and must still start the engine.
    # Never-enabled and disabled checkouts exit 0 with empty stdout even when the engine is
    # missing, crashes, or would hang.
    if ($args.Count -ge 2 -and $args[0] -eq 'hook' -and $args[1] -eq 'pre') {
        try { if (-not (Test-PregateEnforced $raw)) { exit 0 } } catch { exit 0 }
    }
    Require-Engine
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
    Require-Engine
    & $engine @args
}
exit $LASTEXITCODE
