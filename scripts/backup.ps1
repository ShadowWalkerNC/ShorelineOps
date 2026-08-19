# ==============================================================================
# ShorelineOps Automated Facility Backup Script (Windows PowerShell)
# ==============================================================================

param (
    [string]$BackupDir = ".\backups",
    [string]$ContainerName = "shoreline-postgres",
    [string]$DbUser = "shoreline",
    [string]$DbName = "shorelineops"
)

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "shorelineops_backup_$Timestamp.sql"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Host "[$((Get-Date))] Starting ShorelineOps database backup..." -ForegroundColor Cyan

docker exec -t $ContainerName pg_dump -U $DbUser $DbName > $BackupFile

Write-Host "[$((Get-Date))] Backup completed: $BackupFile" -ForegroundColor Green

# Remove backups older than 30 days
Get-ChildItem -Path $BackupDir -Filter "shorelineops_backup_*.sql" | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-30)
} | Remove-Item -Force

Write-Host "[$((Get-Date))] Backup rotation complete (retained last 30 days)." -ForegroundColor Cyan
