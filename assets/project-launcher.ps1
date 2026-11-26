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
    $root = $null
    foreach ($candidate in @($env:CLAUDE_PROJECT_DIR, $env:CURSOR_PROJECT_DIR, $env:GROK_WORKSPACE_ROOT, $PWD.Path)) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate '.pregate/pregate.lock.json') -PathType Leaf)) { $active = $true; $root = $candidate; break }
    }
    if (!$active) { exit 0 }
    $open = $true
    if ($root) {
        $q = $root
        for ($i = 0; $i -lt 40 -and $q; $i++) {
            $preset = Join-Path $q '.pregate/preset.json'
            if (Test-Path -LiteralPath $preset) {
                if ((Get-Content -LiteralPath $preset -Raw -ErrorAction SilentlyContinue) -match '"uncertainty"\s*:\s*"closed"') { $open = $false }
                break
            }
            if (Test-Path -LiteralPath (Join-Path $q '.git')) { break }
            $q = [IO.Path]::GetDirectoryName($q)
        }
    }
    if ($open) {
        if ($argv.Count -ge 4 -and $argv[1] -eq 'pre' -and $argv[3] -eq 'cursor') { [Console]::Out.WriteLine('{"permission":"allow"}') }
        exit 0
    }
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

function To-Key([string]$p) {
    if ([string]::IsNullOrWhiteSpace($p)) { return $null }
    $plain = $p
    if ($plain.StartsWith('\\?\UNC\')) { $plain = '\\' + $plain.Substring(7) }
    elseif ($plain.StartsWith('\\?\')) { $plain = $plain.Substring(4) }
    try { $full = [IO.Path]::GetFullPath($plain) } catch { return $null }
    return ($full -replace '\\', '/').TrimEnd('/').ToLowerInvariant()
}

function Git-Common([string]$dir) {
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
    if (-not $gitKnown) { return 'yes' }
    if ($gitDir -or (Test-Path -LiteralPath $gitPath)) { return 'no' }
    $parent = Split-Path $dir -Parent
    if ($parent -and ($parent -ne $dir)) { return (Test-Candidate $parent) }
    return 'no'
}

# JSON.stringify writes one backslash as two. A Windows path in the payload is C:\\repo\\file.
function ConvertFrom-JsonPath([string]$escaped) {
    if ([string]::IsNullOrEmpty($escaped)) { return $escaped }
    # A script block returns the character itself. -replace would treat a backslash as an escape.
    $text = [regex]::Replace($escaped, '\\"', { '"' })
    $text = [regex]::Replace($text, '\\\\', { '\' })
    return [regex]::Replace($text, '\\/', { '/' })
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
        foreach ($m in [regex]::Matches($raw, '"(?:cwd|workspaceRoot|workspace_root|file_path|filePath|TargetFile|Path|Cwd)"\s*:\s*"((?:[^"\\]|\\.)*)"')) {
            $path = ConvertFrom-JsonPath $m.Groups[1].Value
            if ($path -and (Test-Candidate $path) -eq 'yes') { return $true }
        }
        if ($raw -match '"workspacePaths"\s*:\s*\[\s*"((?:[^"\\]|\\.)*)"') {
            if ((Test-Candidate (ConvertFrom-JsonPath $Matches[1])) -eq 'yes') { return $true }
        }
    }
    return $false
}

# Pre exits 0 before the engine when this checkout is not enforced. onFailure cannot block that.
$script:HookBuffered = $false
$script:HookRaw = ''
if ($argv.Count -ge 2 -and $argv[0] -eq 'hook' -and $argv[1] -eq 'pre') {
    [Console]::InputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    $script:HookRaw = if ($MyInvocation.ExpectingInput) { $input | Out-String } else { [Console]::In.ReadToEnd() }
    $script:HookBuffered = $true
    try {
        if (-not (Test-PregateEnforced $script:HookRaw)) {
            # Cursor's native preToolUse treats empty stdout as a failure when failClosed is set.
            if ($argv.Count -ge 4 -and $argv[3] -eq 'cursor') { [Console]::Out.WriteLine('{"permission":"allow"}') }
            exit 0
        }
    } catch { exit 0 }
}
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
if (-not $script:HookBuffered) {
    [Console]::InputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    $raw = if ($MyInvocation.ExpectingInput) { $input | Out-String } else { [Console]::In.ReadToEnd() }
} else {
    $raw = $script:HookRaw
}
$info = [Diagnostics.ProcessStartInfo]::new()
$info.FileName = $engine
$info.Arguments = '--supervise "' + $data + '" ' + $version + ' ' + ($argv -join ' ')
$info.UseShellExecute = $false
$info.RedirectStandardInput = $info.RedirectStandardOutput = $info.RedirectStandardError = $true
$info.StandardOutputEncoding = $info.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
$process = [Diagnostics.Process]::Start($info)
$stdout = $process.StandardOutput.ReadToEndAsync()
$stderr = $process.StandardError.ReadToEndAsync()
$deadline = if ($argv[1] -eq 'stop') { 50000 } elseif ($argv[1] -eq 'session-start' -or $argv[1] -eq 'post-invocation') { 12000 } else { 110000 }
$clock = [Diagnostics.Stopwatch]::StartNew()
$bytes = [Text.Encoding]::UTF8.GetBytes($raw)
$inputTask = $process.StandardInput.BaseStream.WriteAsync($bytes, 0, $bytes.Length)
if (!$inputTask.Wait($deadline)) { $process.Kill(); Fail 'the engine did not read its input in time' }
$process.StandardInput.Close()
if (!$process.WaitForExit([int][Math]::Max(1, $deadline - $clock.ElapsedMilliseconds))) { $process.Kill(); Fail 'the engine timed out' }
[Console]::Out.Write($stdout.Result)
[Console]::Error.Write($stderr.Result)
exit $process.ExitCode
