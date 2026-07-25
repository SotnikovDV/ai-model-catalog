#Requires -Version 5.1
<#
.SYNOPSIS
  Ручной бэкап локальной разработки AI Model Catalog (SQLite + код).

.PARAMETER IncludeEnv
  Включить файл .env в архив (по умолчанию — нет).

.EXAMPLE
  .\scripts\backup-dev.ps1
  .\scripts\backup-dev.ps1 -IncludeEnv
#>
param(
    [switch]$IncludeEnv
)

$ErrorActionPreference = "Stop"
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

# Папка для zip-архивов бэкапа (измените при необходимости)
$BackupOutputDir = Join-Path $rootDir "backups"

function Write-Step([string]$Message) {
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Test-RobocopySuccess([int]$ExitCode) {
    if ($ExitCode -gt 7) {
        throw "robocopy failed with exit code $ExitCode"
    }
}

function Get-EnvValue([string]$EnvPath, [string]$Key) {
    if (-not (Test-Path $EnvPath)) { return $null }
    foreach ($line in Get-Content $EnvPath) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=\s*(.+?)\s*$") {
            return $Matches[1].Trim('"').Trim("'")
        }
    }
    return $null
}

function Resolve-DbPath([string]$Root, [string]$EnvPath) {
    $raw = Get-EnvValue $EnvPath "DB_PATH"
    if (-not $raw) { $raw = "./data/models.db" }
    if ([System.IO.Path]::IsPathRooted($raw)) {
        return $raw
    }
    return Join-Path $Root $raw
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$backupName = "ai-model-catalog-dev-$timestamp"
$envPath = Join-Path $rootDir ".env"
$dbPath = Resolve-DbPath $rootDir $envPath
$dbDir = Split-Path $dbPath -Parent
$dbName = Split-Path $dbPath -Leaf

$OutputDir = $BackupOutputDir
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

$workDir = Join-Path $OutputDir $backupName
$zipPath = "$workDir.zip"

Write-Step "Бэкап dev: $backupName"
Write-Host "Проект: $rootDir" -ForegroundColor Gray
Write-Host "БД:     $dbPath" -ForegroundColor Gray
Write-Host "Выход:  $zipPath" -ForegroundColor Gray

if (Test-Path $workDir) { Remove-Item $workDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

Write-Host "[1/3] Копирование кода..." -ForegroundColor Yellow
$codeDir = Join-Path $workDir "code"
New-Item -ItemType Directory -Force -Path $codeDir | Out-Null

$excludeDirs = @("node_modules", "dist", ".git", ".idea", ".vscode", "backups", "data")
$excludeFiles = @("*.log", "Thumbs.db", ".DS_Store")

$robocopyArgs = @($rootDir, $codeDir, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np")
foreach ($d in $excludeDirs) { $robocopyArgs += "/XD"; $robocopyArgs += $d }
foreach ($f in $excludeFiles) { $robocopyArgs += "/XF"; $robocopyArgs += $f }

& robocopy @robocopyArgs | Out-Null
Test-RobocopySuccess $LASTEXITCODE

if ($IncludeEnv -and (Test-Path $envPath)) {
    Copy-Item $envPath (Join-Path $codeDir ".env") -Force
    Write-Host "      .env включён в архив" -ForegroundColor DarkGray
}

Write-Host "[2/3] Копирование SQLite..." -ForegroundColor Yellow
$dbBackupDir = Join-Path $workDir "database"
New-Item -ItemType Directory -Force -Path $dbBackupDir | Out-Null

if (Test-Path $dbPath) {
    Copy-Item $dbPath (Join-Path $dbBackupDir $dbName) -Force
    foreach ($suffix in @("-wal", "-shm")) {
        $sidecar = "$dbPath$suffix"
        if (Test-Path $sidecar) {
            Copy-Item $sidecar (Join-Path $dbBackupDir "$dbName$suffix") -Force
        }
    }
    Set-Content -Path (Join-Path $dbBackupDir "db-path.txt") -Value $dbPath -Encoding UTF8
} else {
    Write-Host "      Файл БД не найден: $dbPath" -ForegroundColor DarkYellow
}

Write-Host "[3/3] Создание архива..." -ForegroundColor Yellow
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path "$workDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item $workDir -Recurse -Force

$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Step "Готово"
Write-Host "Файл: $zipPath ($sizeMb MB)" -ForegroundColor Green
