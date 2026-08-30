# Shoreline Care OS — Windows Setup & Shortcut Provisioning Engine
param(
    [string]$InstallPath = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SHORELINE CARE OS — PROVISIONING LOCAL INSTALLATION" -ForegroundColor Cyan
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
    npm --prefix $InstallPath install --omit=dev --silent
}
if (-not (Test-Path (Join-Path $InstallPath "server/node_modules"))) {
    Write-Host "    Installing server dependencies..." -ForegroundColor Gray
    npm --prefix (Join-Path $InstallPath "server") install --omit=dev --silent
}

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
$DesktopShortcut.Description = "Shoreline Care OS — Healthcare Dietary Operations & Clinical Nutrition"
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
$StartMenuShortcut.Description = "Shoreline Care OS — Healthcare Dietary Operations & Clinical Nutrition"
if (Test-Path $IconPath) {
    $StartMenuShortcut.IconLocation = "$IconPath, 0"
}
$StartMenuShortcut.Save()
Write-Host "    Start Menu shortcut created: $(Join-Path $StartMenuFolder 'Shoreline Care OS.lnk')" -ForegroundColor Green

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  SETUP SUCCESSFUL — READY TO LAUNCH" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
