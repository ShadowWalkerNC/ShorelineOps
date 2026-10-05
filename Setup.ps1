# Shoreline Care OS - Windows Setup & Shortcut Provisioning Engine
param(
    [string]$InstallPath = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath (Join-Path $InstallPath 'server/dist/index.js')) -or
    -not (Test-Path -LiteralPath (Join-Path $InstallPath 'dist/app/index.html'))) {
    throw 'Compiled application artifacts are missing. Build the distribution before setup.'
}
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=19)?0:1)"
if ($LASTEXITCODE -ne 0) { throw 'Node.js 22.19 or newer is required; Node.js 24 is recommended.' }

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SHORELINE CARE OS - PROVISIONING LOCAL INSTALLATION" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Ensure Data Directories
$AppDataFolder = [System.IO.Path]::Combine($env:APPDATA, "ShorelineOps")
$DataDir = [System.IO.Path]::Combine($AppDataFolder, "data")
$LogsDir = [System.IO.Path]::Combine($AppDataFolder, "logs")

Write-Host "`n[*] Creating local data directories..." -ForegroundColor Yellow
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}
Write-Host "    Data Directory: $DataDir" -ForegroundColor Green

# 2. Check and Install Dependencies if needed
Write-Host "`n[*] Checking local runtime packages..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $InstallPath "node_modules"))) {
    Write-Host "    Installing frontend and root dependencies..." -ForegroundColor Gray
    npm --prefix $InstallPath ci --omit=dev --silent
    if ($LASTEXITCODE -ne 0) { throw 'Runtime dependency installation failed; shortcuts were not created.' }
}
# Root workspace installation supplies server packages; do not run a second
# workspace install, which can prune or change the pinned dependency tree.
node -e "const {createRequire}=require('node:module');const path=require('node:path');const req=createRequire(path.resolve(process.argv[1],'server/package.json'));req('express');req('sqlite3')" $InstallPath
if ($LASTEXITCODE -ne 0) { throw 'Runtime dependencies are incomplete; reinstall the pinned root workspace before creating shortcuts.' }

# 3. Create Desktop and Start Menu Shortcuts
Write-Host "`n[*] Generating Desktop and Start Menu Shortcuts..." -ForegroundColor Yellow

$WScriptShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$StartMenuPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)

$LauncherBatPath = Join-Path $InstallPath "ShorelineOps-Launcher.bat"
$IconPath = Join-Path $InstallPath "public/favicon.ico"
if (-not (Test-Path $IconPath)) {
    $IconPath = Join-Path $InstallPath "dist/favicon.ico"
}

# Desktop Shortcut
$DesktopShortcut = $WScriptShell.CreateShortcut((Join-Path $DesktopPath "Shoreline Care OS.lnk"))
$DesktopShortcut.TargetPath = $LauncherBatPath
$DesktopShortcut.WorkingDirectory = $InstallPath
$DesktopShortcut.Description = "Shoreline Care OS - Healthcare Dietary Operations & Clinical Nutrition"
if (Test-Path $IconPath) {
    $DesktopShortcut.IconLocation = "$IconPath, 0"
}
$DesktopShortcut.Save()
Write-Host "    Desktop shortcut created: $(Join-Path $DesktopPath 'Shoreline Care OS.lnk')" -ForegroundColor Green

# Start Menu Shortcut
$StartMenuFolder = Join-Path $StartMenuPath "Shoreline Care OS"
if (-not (Test-Path $StartMenuFolder)) {
    New-Item -ItemType Directory -Path $StartMenuFolder -Force | Out-Null
}
$StartMenuShortcut = $WScriptShell.CreateShortcut((Join-Path $StartMenuFolder "Shoreline Care OS.lnk"))
$StartMenuShortcut.TargetPath = $LauncherBatPath
$StartMenuShortcut.WorkingDirectory = $InstallPath
$StartMenuShortcut.Description = "Shoreline Care OS - Healthcare Dietary Operations & Clinical Nutrition"
if (Test-Path $IconPath) {
    $StartMenuShortcut.IconLocation = "$IconPath, 0"
}
$StartMenuShortcut.Save()
Write-Host "    Start Menu shortcut created: $(Join-Path $StartMenuFolder 'Shoreline Care OS.lnk')" -ForegroundColor Green

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  SHORTCUTS CREATED - SIGNING KEYS AND FACILITY SETUP STILL REQUIRED" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
