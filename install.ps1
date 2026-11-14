# Windows bootstrap: verify the release ZIP, run setup, then put the pregate launcher on the user PATH.
# setup exits 0 when at least one harness was wired. A detected harness that could not be wired
# (Codex trust not confirmed) is a warning on stdout and does not fail setup. A non-zero exit
# means no harness was wired, or setup hit a real error. That fails this install. install.sh
# uses the same rule.
# -NoModifyPath (or PREGATE_NO_MODIFY_PATH=1) leaves PATH alone; tests set it so they never write the
# tester's registry; PREGATE_PATH_KEY (a subkey of HKCU, default Environment) lets them check it.
param([string]$Version, [switch]$NoModifyPath)
$env:PSModulePath = $PSHOME + '\Modules;' + $env:PSModulePath
$ErrorActionPreference = 'Stop'
$DEFAULT_VERSION = '0.0.10'
$repo = 'pedroknigge/pregate'
if (!$Version) { $Version = $DEFAULT_VERSION }
$Version = $Version -replace '^v', ''
if ($Version -cnotmatch '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$') { throw 'Invalid version: expected X.Y.Z or X.Y.Z-pre' }
if (![Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'PREGATE requires Windows x64' }
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('pregate-install-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
function Get-PublicFile([string]$Url, [string]$File, [long]$Limit) {
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if (!$curl) { return $false }
    # Windows PowerShell 5 can turn native stderr into a terminating error under Stop.
    # Inspect the native exit code so a failed public download can take the gh fallback.
    $previous = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $curl.Source -q --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --tlsv1.2 --max-redirs 5 --connect-timeout 10 --max-time 120 --max-filesize $Limit --output $File $Url 2>$null
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previous }
    if ($code -eq 63) { throw 'Public download exceeds its size limit; nothing installed' }
    if ($code -ne 0) { return $false }
    if (!(Test-Path -LiteralPath $File -PathType Leaf)) { throw 'Public download is missing; nothing installed' }
    $size = (Get-Item -LiteralPath $File).Length
    if ($size -eq 0 -or $size -gt $Limit) { throw 'Public download is empty or exceeds its size limit; nothing installed' }
    return $true
}
function Get-PublicRelease([string]$Base, [string]$Name) {
    if (!(Get-PublicFile "$Base/SHA256SUMS" (Join-Path $tmp 'SHA256SUMS') 1048576)) { return $false }
    $entries = @(Get-Content -LiteralPath (Join-Path $tmp 'SHA256SUMS') | Where-Object { $_ -cmatch ('^[0-9a-f]{64}  ' + [regex]::Escape($Name) + '$') })
    if ($entries.Count -ne 1) { throw "SHA256SUMS has no unique valid SHA-256 for $Name; nothing installed" }
    return Get-PublicFile "$Base/$Name" (Join-Path $tmp $Name) 268435456
}
function Invoke-CosignVerify([string]$File, [string]$Bundle) {
    $cosign = Get-Command cosign -ErrorAction SilentlyContinue
    if (-not $cosign) { throw 'cosign is required to verify the release signature; nothing installed' }
    $previous = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        if ($env:PREGATE_COSIGN_KEY) {
            & $cosign.Source verify-blob --key $env:PREGATE_COSIGN_KEY --bundle $Bundle $File
        } else {
            $identity = "^https://github.com/$repo/\.github/workflows/release\.yml@refs/tags/v"
            & $cosign.Source verify-blob --bundle $Bundle --certificate-identity-regexp $identity --certificate-oidc-issuer https://token.actions.githubusercontent.com $File
        }
        if ($LASTEXITCODE -ne 0) { throw "cosign signature mismatch for $([IO.Path]::GetFileName($File)); nothing installed" }
    } finally { $ErrorActionPreference = $previous }
}
function Get-ReleaseBundle([string]$Base, [string]$BundleName) {
    $dest = Join-Path $tmp $BundleName
    if (Test-Path -LiteralPath $dest) { return $true }
    if (Get-PublicFile "$Base/$BundleName" $dest 1048576) { return $true }
    Remove-Item -LiteralPath $dest -Force -ErrorAction SilentlyContinue
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        $previous = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & gh release download "v$Version" --repo $repo --pattern $BundleName --dir $tmp 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $dest)) { return $true }
        } finally { $ErrorActionPreference = $previous }
    }
    Remove-Item -LiteralPath $dest -Force -ErrorAction SilentlyContinue
    return $false
}
function Confirm-ReleaseSignatures([string]$Base, [string]$Name, [string]$ArchivePath) {
    $cosign = Get-Command cosign -ErrorAction SilentlyContinue
    if (-not $cosign) {
        if ($env:PREGATE_REQUIRE_SIGNATURE -eq '1') { throw 'cosign is required to verify the release signature; nothing installed' }
        return
    }
    foreach ($bundleName in @('SHA256SUMS.bundle', "$Name.bundle")) {
        if (!(Get-ReleaseBundle $Base $bundleName)) {
            if ($env:PREGATE_REQUIRE_SIGNATURE -eq '1') { throw "release has no $bundleName; nothing installed" }
            Write-Warning "release v$Version has no $bundleName; signature not verified"
        }
    }
    $sumsBundle = Join-Path $tmp 'SHA256SUMS.bundle'
    $archiveBundle = Join-Path $tmp "$Name.bundle"
    if (Test-Path -LiteralPath $sumsBundle) { Invoke-CosignVerify (Join-Path $tmp 'SHA256SUMS') $sumsBundle }
    if (Test-Path -LiteralPath $archiveBundle) { Invoke-CosignVerify $ArchivePath $archiveBundle }
}
function Confirm-OfflineSignature([string]$ArchivePath) {
    if ($env:PREGATE_COSIGN_KEY -or $env:PREGATE_COSIGN_BUNDLE) {
        $bundle = if ($env:PREGATE_COSIGN_BUNDLE) { $env:PREGATE_COSIGN_BUNDLE } else { "$ArchivePath.bundle" }
        if (!(Test-Path -LiteralPath $bundle)) { throw "cosign bundle missing for $ArchivePath; nothing installed" }
        Invoke-CosignVerify $ArchivePath $bundle
        return
    }
    if ($env:PREGATE_MINISIGN_PUB) {
        $minisign = Get-Command minisign -ErrorAction SilentlyContinue
        if (-not $minisign) { throw 'minisign is required to verify the archive signature; nothing installed' }
        $sig = if ($env:PREGATE_MINISIGN_SIG) { $env:PREGATE_MINISIGN_SIG } else { "$ArchivePath.minisig" }
        if (!(Test-Path -LiteralPath $sig)) { throw "minisign signature missing for $ArchivePath; nothing installed" }
        $previous = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & $minisign.Source -V -p $env:PREGATE_MINISIGN_PUB -m $ArchivePath -x $sig
            if ($LASTEXITCODE -ne 0) { throw "minisign signature mismatch for $ArchivePath; nothing installed" }
        } finally { $ErrorActionPreference = $previous }
    }
}
try {
    $name = "pregate-$Version-windows-x64.zip"
    if ($env:PREGATE_ARCHIVE) {
        if (!$env:PREGATE_SHA256) { throw 'PREGATE_ARCHIVE needs PREGATE_SHA256' }
        $archive = $env:PREGATE_ARCHIVE
        $expected = $env:PREGATE_SHA256
    } else {
        $base = "https://github.com/$repo/releases/download/v$Version"
        if (!(Get-PublicRelease $base $name)) {
            Remove-Item -LiteralPath (Join-Path $tmp $name), (Join-Path $tmp 'SHA256SUMS') -Force -ErrorAction SilentlyContinue
            if (!(Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Public release unavailable; gh is required: https://cli.github.com, then gh auth login. Or use PREGATE_ARCHIVE with PREGATE_SHA256.' }
            & gh release download "v$Version" --repo $repo --pattern $name --pattern SHA256SUMS --dir $tmp
            if ($LASTEXITCODE -ne 0) { throw "Could not download v$Version; check the network, gh auth status and repository access" }
        }
        $archive = Join-Path $tmp $name
        if (!(Test-Path -LiteralPath $archive -PathType Leaf) -or !(Test-Path -LiteralPath (Join-Path $tmp 'SHA256SUMS') -PathType Leaf)) { throw "Release has no $name or SHA256SUMS" }
        if ((Get-Item -LiteralPath $archive).Length -gt 268435456 -or (Get-Item -LiteralPath (Join-Path $tmp 'SHA256SUMS')).Length -gt 1048576) { throw 'Release exceeds its size limit; nothing installed' }
        $entries = @(Get-Content -LiteralPath (Join-Path $tmp 'SHA256SUMS') | Where-Object { $_ -cmatch ('^[0-9a-f]{64}  ' + [regex]::Escape($name) + '$') })
        if ($entries.Count -ne 1) { throw "SHA256SUMS has no unique valid SHA-256 for $name; nothing installed" }
        $expected = if ($env:PREGATE_SHA256) { $env:PREGATE_SHA256 } else { $entries[0].Substring(0,64) }
    }
    if ($expected -notmatch '^[0-9a-fA-F]{64}$') { throw 'Expected SHA-256 must have 64 hex digits' }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ine $expected) { throw 'SHA-256 mismatch; nothing installed' }
    if ($env:PREGATE_ARCHIVE) { Confirm-OfflineSignature $archive } else { Confirm-ReleaseSignatures $base $name $archive }
    $extract = Join-Path $tmp 'x'
    Expand-Archive -LiteralPath $archive -DestinationPath $extract
    $binary = Join-Path $extract 'pregate.exe'
    if (!(Test-Path -LiteralPath $binary -PathType Leaf)) { throw 'Archive has no pregate.exe' }
    & $binary setup
    $setup = $LASTEXITCODE
    if ($setup -ne 0) {
        [Console]::Error.WriteLine("PREGATE setup failed (exit $setup)")
        exit $setup
    }
    # Same data home as the engine's storageDir("data"): XDG_DATA_HOME, else LOCALAPPDATA.
    $dataHome = if ($env:XDG_DATA_HOME) { $env:XDG_DATA_HOME } elseif ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $HOME 'AppData\Local' }
    $bin = [IO.Path]::GetFullPath((Join-Path $dataHome 'pregate\bin'))
    if ($NoModifyPath -or $env:PREGATE_NO_MODIFY_PATH -eq '1') {
        Write-Output "PATH unchanged; add $bin to your user PATH to run pregate."
    } else {
        # Read the raw value so %VARIABLES% in existing entries survive, and write it back as REG_EXPAND_SZ.
        $pathKey = if ($env:PREGATE_PATH_KEY) { $env:PREGATE_PATH_KEY } else { 'Environment' }
        $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($pathKey)
        try {
            $raw = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            $entries = @($raw -split ';' | Where-Object { $_ -ne '' })
            $present = $entries | Where-Object { [Environment]::ExpandEnvironmentVariables($_).TrimEnd('\') -ieq $bin.TrimEnd('\') }
            if ($present) {
                Write-Output "pregate is already on your user PATH ($bin)."
            } else {
                $key.SetValue('Path', (($entries + $bin) -join ';'), [Microsoft.Win32.RegistryValueKind]::ExpandString)
                # A user-scope write through Environment broadcasts WM_SETTINGCHANGE, so new terminals see the PATH.
                if ($pathKey -eq 'Environment') {
                    [Environment]::SetEnvironmentVariable('PREGATE_PATH_REFRESH', '1', 'User')
                    [Environment]::SetEnvironmentVariable('PREGATE_PATH_REFRESH', $null, 'User')
                }
                Write-Output "Added $bin to your user PATH. Open a new terminal, then run: pregate --version"
            }
        } finally { $key.Close() }
    }
} finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force
}
