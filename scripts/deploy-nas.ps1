#Requires -Version 5.1
<#
.SYNOPSIS
  Deploy AI Model Catalog to Synology NAS (code by default).

.DESCRIPTION
  Syncs project files to NAS share. Production SQLite on NAS is not touched unless -IncludeDb.
  Does not overwrite existing .env on NAS (production secrets).

.PARAMETER NasPath
  UNC path to project folder on NAS.

.PARAMETER IncludeDb
  Copy local SQLite into data/ on NAS (overwrites production DB). Use only for initial seed or dev->NAS transfer.

.PARAMETER SkipDb
  Deprecated alias for default behavior (code only, no DB copy).

.PARAMETER IncludeEnv
  Create .env on NAS from local .env (DB_PATH -> /app/data/models.db).
  Skipped if .env already exists on NAS unless -ForceEnv.

.PARAMETER ForceEnv
  Overwrite .env on NAS (requires -IncludeEnv).

.EXAMPLE
  .\scripts\deploy-nas.ps1
  .\scripts\deploy-nas.ps1 -NasPath "\\192.168.1.113\docker\ai-model-catalog"
  .\scripts\deploy-nas.ps1 -IncludeDb
#>
param(
    [string]$NasPath = "\\192.168.1.113\docker\ai-model-catalog",
    [switch]$IncludeDb,
    [switch]$SkipDb,
    [switch]$IncludeEnv,
    [switch]$ForceEnv
)

$ErrorActionPreference = "Stop"
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

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
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=\s*(.+?)\s*`$") {
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

function Copy-SqliteFiles([string]$SourceDbPath, [string]$TargetDir) {
    if (-not (Test-Path $SourceDbPath)) {
        throw "SQLite file not found: $SourceDbPath"
    }

    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
    }

    $dbName = Split-Path $SourceDbPath -Leaf
    Copy-Item $SourceDbPath (Join-Path $TargetDir $dbName) -Force

    foreach ($suffix in @("-wal", "-shm")) {
        $sidecar = "$SourceDbPath$suffix"
        if (Test-Path $sidecar) {
            Copy-Item $sidecar (Join-Path $TargetDir "$dbName$suffix") -Force
        }
    }
}

function Test-EnvKeyLine([string]$Line) {
    return $Line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$'
}

function New-DockerEnvFromLocal([string]$LocalEnvPath) {
    $dockerExamplePath = Join-Path $rootDir ".env.docker.example"
    $lines = New-Object System.Collections.Generic.List[string]

    if (Test-Path $dockerExamplePath) {
        $lines.AddRange([string[]](Get-Content $dockerExamplePath))
    }

    if (Test-Path $LocalEnvPath) {
        $localKeys = @{}
        foreach ($line in Get-Content $LocalEnvPath) {
            if (Test-EnvKeyLine $line) {
                $localKeys[$Matches[1]] = $Matches[2]
            }
        }

        $skipKeys = @{ DB_PATH = $true; PORT = $true }
        $result = New-Object System.Collections.Generic.List[string]
        $presentKeys = @{}

        foreach ($line in $lines) {
            if (Test-EnvKeyLine $line) {
                $key = $Matches[1]
                $presentKeys[$key] = $true
                if ($localKeys.ContainsKey($key) -and -not $skipKeys.ContainsKey($key)) {
                    $result.Add("$key=$($localKeys[$key])")
                    continue
                }
            }
            $result.Add($line)
        }

        foreach ($entry in $localKeys.GetEnumerator()) {
            if ($presentKeys.ContainsKey($entry.Key)) { continue }
            if ($skipKeys.ContainsKey($entry.Key)) { continue }
            $result.Add("$($entry.Key)=$($entry.Value)")
        }

        return $result
    }

    return $lines
}

Write-Step "Deploy to NAS"
Write-Host "Project: $rootDir" -ForegroundColor Gray
Write-Host "NAS:     $NasPath" -ForegroundColor Gray

if (-not (Test-Path $NasPath)) {
    throw "NAS folder is not accessible: $NasPath. Check network, SMB access and share permissions."
}

$envPath = Join-Path $rootDir ".env"
$dbPath = Resolve-DbPath $rootDir $envPath
$nasDataDir = Join-Path $NasPath "data"
$nasEnvPath = Join-Path $NasPath ".env"
$copyDb = $IncludeDb

if ($copyDb) {
    $walPath = "$dbPath-wal"
    if (Test-Path $walPath) {
        Write-Host "Warning: WAL file found ($walPath)." -ForegroundColor Yellow
        Write-Host "Stop local dev server before DB deploy to avoid inconsistent copy." -ForegroundColor Yellow
        $answer = Read-Host "Continue DB copy? (y/N)"
        if ($answer -notin @("y", "Y")) {
            throw "Deploy cancelled. Run without -IncludeDb to update code only."
        }
    }
}

Write-Host "[1/3] Syncing code..." -ForegroundColor Yellow
$excludeDirs = @("node_modules", "dist", ".git", ".idea", ".vscode", "backups", ".cursor", "coverage")
$excludeFiles = @(".env", "*.log", "Thumbs.db", ".DS_Store")
$sqliteDataDir = Join-Path $rootDir "data"

$robocopyArgs = @(
    $rootDir,
    $NasPath,
    "/E",
    "/XO",
    "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"
)
foreach ($d in $excludeDirs) { $robocopyArgs += "/XD"; $robocopyArgs += $d }
$robocopyArgs += "/XD"
$robocopyArgs += $sqliteDataDir
foreach ($f in $excludeFiles) { $robocopyArgs += "/XF"; $robocopyArgs += $f }

& robocopy @robocopyArgs | Out-Null
Test-RobocopySuccess $LASTEXITCODE

if ($copyDb) {
    Write-Host "[2/3] Copying SQLite to data/..." -ForegroundColor Yellow
    Copy-SqliteFiles $dbPath $nasDataDir
    $dbSizeMb = [math]::Round((Get-Item $dbPath).Length / 1MB, 2)
    Write-Host "      $dbPath -> $nasDataDir ($dbSizeMb MB)" -ForegroundColor DarkGray
} else {
    Write-Host "[2/3] DB copy skipped (production data/ on NAS is unchanged)" -ForegroundColor DarkYellow
}

Write-Host "[3/3] Checking .env on NAS..." -ForegroundColor Yellow
if ($IncludeEnv -and ($ForceEnv -or -not (Test-Path $nasEnvPath))) {
    $envLines = New-DockerEnvFromLocal $envPath
    $normalized = @()
    $hasDbPath = $false
    foreach ($line in $envLines) {
        if ($line -match '^\s*DB_PATH\s*=') {
            $normalized += "DB_PATH=/app/data/models.db"
            $hasDbPath = $true
            continue
        }
        if ($line -match '^\s*PORT\s*=') {
            $normalized += "PORT=3000"
            continue
        }
        $normalized += $line
    }
    if (-not $hasDbPath) {
        $normalized += "DB_PATH=/app/data/models.db"
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllLines($nasEnvPath, $normalized, $utf8NoBom)
    Write-Host "      .env created/updated on NAS" -ForegroundColor DarkGray
} elseif (-not (Test-Path $nasEnvPath)) {
    $examplePath = Join-Path $rootDir ".env.docker.example"
    if (-not (Test-Path $examplePath)) {
        throw ".env missing on NAS and .env.docker.example not found in project."
    }
    Copy-Item $examplePath $nasEnvPath -Force
    Write-Host "      .env created from .env.docker.example - set ADMIN_PASSWORD and SESSION_SECRET" -ForegroundColor Yellow
} else {
    Write-Host "      existing .env on NAS left unchanged" -ForegroundColor DarkGray
}

Write-Step "File deploy complete"
Write-Host "Next steps on NAS:" -ForegroundColor Green
Write-Host "  1. Check .env in $NasPath" -ForegroundColor Green
Write-Host "  2. Container Manager -> project ai-model-catalog -> Build -> Start" -ForegroundColor Green
Write-Host "     or via SSH: cd /volume1/docker/ai-model-catalog && docker compose up -d --build" -ForegroundColor Green
Write-Host "  3. Verify: http://<NAS-IP>:3000/health" -ForegroundColor Green
