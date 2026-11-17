# One-click Agent Console launcher for Windows.
# Checks out the PR branch, installs deps if needed, starts Vite, opens the browser.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-agent-console.ps1
#   Or double-click "Start Agent Console.bat"
#
# Optional:
#   -RepoRoot "D:\code\floorplan-3d"
#   -Branch "cursor/agent-console-mvp-38ac"
#   -Url "http://127.0.0.1:5173/"
#   -SkipGit   # skip fetch/checkout/pull
#   -ForceInstall

param(
  [string]$RepoRoot = "",
  [string]$Branch = "cursor/agent-console-mvp-38ac",
  [string]$Url = "http://127.0.0.1:5173/",
  [string]$Port = "5173",
  [switch]$SkipGit,
  [switch]$ForceInstall
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Agent Console launcher"

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Find-RepoRoot {
  param([string]$Hint)

  if ($Hint -and (Test-Path (Join-Path $Hint "agent-console\package.json"))) {
    return (Resolve-Path $Hint).Path
  }

  # Script lives at <repo>/agent-console/scripts/start-agent-console.ps1
  $fromScript = Resolve-Path (Join-Path $PSScriptRoot "..\..")
  if (Test-Path (Join-Path $fromScript "agent-console\package.json")) {
    return $fromScript.Path
  }

  # Walk up from cwd
  $probe = (Get-Location).Path
  while ($probe) {
    if (Test-Path (Join-Path $probe "agent-console\package.json")) {
      return $probe
    }
    $parent = Split-Path $probe -Parent
    if (-not $parent -or $parent -eq $probe) { break }
    $probe = $parent
  }

  # Common clone locations
  $candidates = @(
    (Join-Path $env:USERPROFILE "floorplan-3d"),
    (Join-Path $env:USERPROFILE "source\floorplan-3d"),
    (Join-Path $env:USERPROFILE "src\floorplan-3d"),
    (Join-Path $env:USERPROFILE "code\floorplan-3d"),
    (Join-Path $env:USERPROFILE "Documents\floorplan-3d"),
    (Join-Path $env:USERPROFILE "Desktop\floorplan-3d"),
    (Join-Path $env:USERPROFILE "repos\floorplan-3d")
  )
  foreach ($c in $candidates) {
    if (Test-Path (Join-Path $c "agent-console\package.json")) {
      return (Resolve-Path $c).Path
    }
  }

  return $null
}

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name. Install it and re-run."
  }
}

function Wait-ForUrl([string]$TargetUrl, [int]$TimeoutSec = 90) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  return $false
}

try {
  Assert-Command "git"
  Assert-Command "npm"
  Assert-Command "node"

  Write-Step "Locating floorplan-3d repo"
  $root = Find-RepoRoot -Hint $RepoRoot
  if (-not $root) {
    Write-Host @"
Could not find the floorplan-3d clone (looking for agent-console\package.json).

Clone once, then re-run this launcher:
  git clone https://github.com/zhuzhuyumeng/floorplan-3d.git
  cd floorplan-3d
  powershell -ExecutionPolicy Bypass -File .\agent-console\scripts\start-agent-console.ps1

Or pass -RepoRoot "D:\path\to\floorplan-3d"
"@
    throw "Repo root not found."
  }
  Write-Host "Repo: $root"

  $appDir = Join-Path $root "agent-console"
  if (-not (Test-Path (Join-Path $appDir "package.json"))) {
    throw "Missing agent-console app at $appDir"
  }

  if (-not $SkipGit) {
    Write-Step "Updating git branch '$Branch'"
    Push-Location $root
    try {
      git rev-parse --is-inside-work-tree | Out-Null
      git fetch origin $Branch 2>&1 | Out-Host
      $current = (git rev-parse --abbrev-ref HEAD).Trim()
      if ($current -ne $Branch) {
        git checkout $Branch 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) {
          git checkout -B $Branch "origin/$Branch" 2>&1 | Out-Host
        }
      }
      git pull --ff-only origin $Branch 2>&1 | Out-Host
    } finally {
      Pop-Location
    }
  } else {
    Write-Host "Skipping git update (-SkipGit)."
  }

  Write-Step "Preparing dependencies"
  Push-Location $appDir
  try {
    $nodeModules = Join-Path $appDir "node_modules"
    $needInstall = $ForceInstall -or -not (Test-Path $nodeModules) -or -not (Test-Path (Join-Path $nodeModules "vite"))
    if ($needInstall) {
      Write-Host "Running npm install..."
      npm install
      if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" }
    } else {
      Write-Host "node_modules present — skipping npm install (use -ForceInstall to refresh)."
    }

    # If something is already serving the URL, just open the browser.
    $alreadyUp = $false
    try {
      $probe = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($probe.StatusCode -ge 200 -and $probe.StatusCode -lt 500) {
        $alreadyUp = $true
      }
    } catch { $alreadyUp = $false }

    if ($alreadyUp) {
      Write-Step "Dev server already running — opening browser"
      Start-Process $Url | Out-Null
      Write-Host "Opened $Url"
      Write-Host "This window can be closed."
      return
    }

    Write-Step "Starting Vite on port $Port"
    # Spawn Vite in its own cmd window (/k keeps logs visible). Launcher does not block on it.
    $devCmd = "npm run dev -- --host 127.0.0.1 --port $Port"
    $proc = Start-Process `
      -FilePath "cmd.exe" `
      -ArgumentList @("/k", "cd /d `"$appDir`" && title Agent Console (Vite) && $devCmd") `
      -WorkingDirectory $appDir `
      -PassThru `
      -WindowStyle Normal

    Write-Host "Waiting for $Url ..."
    if (Wait-ForUrl -TargetUrl $Url -TimeoutSec 90) {
      Write-Step "Opening browser"
      Start-Process $Url | Out-Null
      Write-Host "Agent Console is ready at $Url"
      Write-Host "Dev server window PID: $($proc.Id) — close that window to stop the app."
      Write-Host "You can close this launcher window."
    } else {
      Write-Warning "Timed out waiting for $Url. Check the Vite window for errors."
      if (-not $proc.HasExited) {
        Write-Host "Vite process still running (PID $($proc.Id))."
      }
      throw "Dev server did not become ready in time."
    }
  } finally {
    Pop-Location
  }
} catch {
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Press Enter to close..."
  [void][System.Console]::ReadLine()
  exit 1
}
