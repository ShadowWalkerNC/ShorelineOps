# ==============================================================================
# ShorelineOps Automated Facility Backup Script (Windows PowerShell)
#
# Failure handling: pg_dump output goes to a pre-restricted temporary file
# first. The final artifact is published only when the native pg_dump exit
# code is 0 and the output is non-empty; rotation runs only after a
# successful publish and can never fail the run. A failure discards the
# temp file, skips rotation, and exits nonzero.
#
# DB identity is explicit (no stale defaults): -DbUser/-DbName are required
# and must match the deployment's Compose-required values (production
# DB_USER/DB_NAME, local POSTGRES_USER/POSTGRES_DB). Missing values fail fast
# before any command runs.
#
# Injection safety: ContainerName/DbUser/DbName are strictly allowlisted
# (letters, digits, '_', '-', '.' only) before any command runs, rejecting
# quotes, %, &, and all other shell metacharacters. docker is launched
# directly via System.Diagnostics.ProcessStartInfo (no cmd.exe, no
# string-built command line) and stdout is copied as raw bytes.
#
# Published output is authenticated AES-256-GCM ciphertext. The isolated restore drill
# remains a pending acceptance gate (see
# docs/audits/DEPLOYMENT_IMPLEMENTATION_2026-10-01.md); store artifacts
# accordingly; keys must be kept separately from artifacts.
# ==============================================================================

param (
    [string]$BackupDir = ".\backups",
    [string]$ContainerName = "shoreline-postgres",
    [string]$DbUser = "",
    [string]$DbName = "",
    [string]$KeyFile = ""
)

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
    Write-Error 'backup.ps1 requires Windows file ACLs. Use scripts/backup.sh on Linux or macOS.'
    exit 1
}

# Locale-independent owner identity: the current user's SID, not $env:USERNAME
# (bare usernames are not valid icacls grantees in all locales/configs).
$OwnerSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$AdminsSid = "S-1-5-32-544" # local Administrators group, locale-independent

function Protect-BackupFile {
    param([string]$Path)
    icacls $Path /inheritance:r /grant:r "*$($OwnerSid):F" "*$($AdminsSid):F" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "icacls failed with code $LASTEXITCODE for $Path."
    }
}

function Assert-SafeBackupToken {
    param([string]$Value, [string]$Name, [string]$ComposeVar)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name is required: pass explicit -$Name matching the deployment's $ComposeVar value (Compose requires $ComposeVar with no defaults; this script ships no stale defaults)."
    }
    if ($Value -notmatch '^[A-Za-z0-9_.-]+$') {
        throw "$Name contains rejected characters: '$Value'. Only letters, digits, '_', '-', '.' are allowed; quotes, %, &, and other shell metacharacters are rejected before any command runs."
    }
}

$BackupFile = Join-Path $BackupDir "shorelineops_backup_$Timestamp.sql.enc"
$TempFile = "$BackupFile.tmp.$PID"
$TempOwned = $false

function Remove-TempOutput {
    if ($TempOwned -and (Test-Path -LiteralPath $TempFile)) {
        Remove-Item -LiteralPath $TempFile -Force -ErrorAction SilentlyContinue
    }
}

try {
    # Strict validation FIRST, before any command (docker, icacls, filesystem
    # writes): explicit DB identity + shell-metacharacter rejection.
    Assert-SafeBackupToken $ContainerName "ContainerName" "container_name"
    Assert-SafeBackupToken $DbUser "DbUser" "DB_USER / POSTGRES_USER"
    Assert-SafeBackupToken $DbName "DbName" "DB_NAME / POSTGRES_DB"

    if ([string]::IsNullOrWhiteSpace($KeyFile)) { throw 'Explicit -KeyFile is required.' }
    $KeyFile = (Resolve-Path -LiteralPath $KeyFile).Path
    $keyAcl = [System.IO.File]::GetAccessControl($KeyFile)
    foreach ($rule in $keyAcl.Access) {
        $sid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
        if ($rule.AccessControlType -eq 'Allow' -and $sid -notin @($OwnerSid, $AdminsSid, 'S-1-5-18')) { throw 'Key file ACL grants access outside owner, Administrators or SYSTEM.' }
    }
    $cryptoTool = Join-Path $PSScriptRoot 'backup-tool.mjs'
    & node $cryptoTool check --key-file $KeyFile
    if ($LASTEXITCODE -ne 0) { throw 'Encryption prerequisites failed; no dump started.' }

    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCmd -or [string]::IsNullOrWhiteSpace($dockerCmd.Source)) {
        throw "docker CLI not found on PATH. Install Docker Desktop or run this script where the 'docker' command is available."
    }

    $createdDir = $false
    if (-not (Test-Path -LiteralPath $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir | Out-Null
        $createdDir = $true
    }

    if ($createdDir) {
        # Newly created directory: restrict inheritance so anything created
        # inside starts restricted. Best-effort only — the temp and final
        # files are each restricted individually below, which is the actual
        # guarantee. Existing directories are left untouched.
        icacls $BackupDir /inheritance:r /grant:r "*$($OwnerSid):(OI)(CI)F" "*$($AdminsSid):(OI)(CI)F" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Could not restrict ACL on new directory $BackupDir (icacls exit $LASTEXITCODE); continuing with per-file restriction."
        }
    }

    Write-Host "[$((Get-Date))] Starting ShorelineOps database backup..." -ForegroundColor Cyan

    # Pre-create the temp file and restrict it BEFORE the dump runs: a file
    # created by the dump would otherwise inherit the directory ACL
    # (potentially broadly readable) for the whole dump duration. The
    # FileStream Truncate below reuses this same file object, preserving its ACL.
    New-Item -ItemType File -Path $TempFile | Out-Null
    $TempOwned = $true
    try {
        Protect-BackupFile $TempFile
    } catch {
        Remove-TempOutput
        throw
    }

    # Native failure detection: $ErrorActionPreference does not fire on native
    # exit codes, so inspect the process exit code explicitly.
    # No -t/--tty flag: a pseudo-TTY mangles piped output and fails without a
    # console; pg_dump streams to stdout and needs no terminal.
    #
    # Safe execution (no shell): docker launches directly via
    # System.Diagnostics.ProcessStartInfo with no cmd.exe and no string-built
    # command line. Tokens were allowlisted above, so the Arguments string is
    # safe even on Windows PowerShell 5.1 (which has no ArgumentList).
    # BackupDir/TempFile never reach a shell: they go only to PowerShell
    # cmdlets and the .NET FileStream below.
    #
    # Byte fidelity: PowerShell's `>` operator decodes native stdout as text
    # and re-encodes (UTF-16 by default in Windows PowerShell), corrupting the
    # dump. Copying StandardOutput.BaseStream (raw stdout bytes) preserves bytes.
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $dockerCmd.Source
    $psi.Arguments = "exec $ContainerName pg_dump -U $DbUser $DbName"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $false
    $psi.CreateNoWindow = $true
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    try {
        $proc.Start() | Out-Null
    } catch {
        throw "Failed to start docker pg_dump: $($_.Exception.Message). Temp output discarded; rotation skipped; no artifact published."
    }
    $fileStream = New-Object System.IO.FileStream($TempFile, [System.IO.FileMode]::Truncate, [System.IO.FileAccess]::Write)
    try {
        $proc.StandardOutput.BaseStream.CopyTo($fileStream)
    } finally {
        $fileStream.Close()
        $proc.StandardOutput.Close()
    }
    $proc.WaitForExit()
    $dumpExit = $proc.ExitCode
    if ($dumpExit -ne 0) {
        throw "pg_dump exited with code $dumpExit. Temp output discarded; rotation skipped; no artifact published."
    }
    $tempItem = Get-Item -LiteralPath $TempFile
    if ($tempItem.Length -eq 0) {
        throw "pg_dump produced empty output. Temp output discarded; rotation skipped; no artifact published."
    }

    & node $cryptoTool encrypt --key-file $KeyFile $TempFile $BackupFile
    if ($LASTEXITCODE -ne 0) { throw 'Encryption failed; rotation skipped.' }
    Remove-TempOutput

    # Re-apply the restrictive ACL after the move (same-volume moves preserve
    # the source ACL, but do not depend on that).
    try {
        Protect-BackupFile $BackupFile
    } catch {
        Remove-Item -LiteralPath $BackupFile -Force -ErrorAction SilentlyContinue
        throw "icacls failed for the published artifact; published artifact removed instead of leaving it broadly readable."
    }

    Write-Host "[$((Get-Date))] Backup completed: $BackupFile" -ForegroundColor Green

    # Remove backups older than 30 days (only after a successful publish).
    # Housekeeping must never fail a completed backup: resolve to an absolute
    # path, refuse unsafe roots, and treat rotation errors as warnings.
    try {
        $BackupDirFull = (Resolve-Path -LiteralPath $BackupDir -ErrorAction Stop).Path
        if ([string]::IsNullOrWhiteSpace($BackupDirFull) -or $BackupDirFull -match '^[A-Za-z]:\\?$') {
            Write-Warning "Backup rotation skipped: refusing to prune in '$BackupDirFull'."
        } else {
            Get-ChildItem -LiteralPath $BackupDirFull -Filter "shorelineops_backup_*.sql.enc" -File -ErrorAction Stop | Where-Object {
                $_.LastWriteTime -lt (Get-Date).AddDays(-30)
            } | Remove-Item -Force -ErrorAction Stop
            Write-Host "[$((Get-Date))] Backup rotation complete (retained last 30 days)." -ForegroundColor Cyan
        }
    } catch {
        Write-Warning "Backup rotation failed (non-fatal; published artifact kept): $($_.Exception.Message)"
    }
}
catch {
    Write-Host "[$((Get-Date))] Backup FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Remove-TempOutput
    exit 1
}
