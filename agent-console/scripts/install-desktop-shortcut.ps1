# Installs a one-click Agent Console shortcut on the Windows Desktop.
# The .lnk runs start-agent-console.ps1 (checkout branch, npm install, npm run dev, open browser).
# Also writes a fallback .url that only opens the local URL (if the server is already up).
#
# Usage (from repo or agent-console/):
#   powershell -ExecutionPolicy Bypass -File .\agent-console\scripts\install-desktop-shortcut.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\install-desktop-shortcut.ps1
#
# Or: right-click this file → Run with PowerShell

param(
  [string]$Url = "http://127.0.0.1:5173/",
  [string]$Name = "Agent Console",
  [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

$desktop = [Environment]::GetFolderPath("Desktop")
if (-not $desktop -or -not (Test-Path $desktop)) {
  throw "Could not resolve Desktop folder."
}

$scriptsDir = $PSScriptRoot
$launcherPs1 = Join-Path $scriptsDir "start-agent-console.ps1"
$launcherBat = Join-Path $scriptsDir "Start Agent Console.bat"

if (-not (Test-Path $launcherPs1)) {
  throw "Missing launcher script: $launcherPs1"
}

# Prefer the .bat so double-click / .lnk work without ExecutionPolicy prompts.
$target = if (Test-Path $launcherBat) { $launcherBat } else { $launcherPs1 }
$args = ""
if ($RepoRoot) {
  if (Test-Path $launcherBat) {
    $args = "-RepoRoot `"$RepoRoot`""
  } else {
    $args = "-RepoRoot `"$RepoRoot`""
  }
}

# 1) Fallback .url (browser only — useful when server already running)
$urlPath = Join-Path $desktop "$Name.url"
@"
[InternetShortcut]
URL=$Url
"@ | Set-Content -Path $urlPath -Encoding ASCII

# 2) Primary .lnk → one-click launcher
$lnkPath = Join-Path $desktop "$Name.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)

if ($target.ToLower().EndsWith(".bat")) {
  $shortcut.TargetPath = $target
  $shortcut.Arguments = $args
  $shortcut.WorkingDirectory = $scriptsDir
} else {
  # Direct PowerShell fallback
  $shortcut.TargetPath = (Get-Command powershell.exe).Source
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcherPs1`" $args"
  $shortcut.WorkingDirectory = $scriptsDir
}

$shortcut.Description = "Start Agent Console (git pull, npm install, vite, open $Url)"
$shortcut.WindowStyle = 1
try {
  $shortcut.Save()
} catch {
  throw "Failed to write Desktop .lnk: $($_.Exception.Message)"
}

# Also drop a Desktop copy of the .bat for discoverability (optional convenience).
$desktopBat = Join-Path $desktop "Start Agent Console.bat"
@"
@echo off
cd /d "$scriptsDir"
call "Start Agent Console.bat" %*
"@ | Set-Content -Path $desktopBat -Encoding ASCII

Write-Host "Desktop one-click shortcuts installed:"
Write-Host "  $lnkPath"
Write-Host "    → $target"
Write-Host "  $desktopBat"
Write-Host "  $urlPath  (browser-only fallback)"
Write-Host ""
Write-Host "Double-click 'Agent Console' on the Desktop to:"
Write-Host "  checkout/pull cursor/agent-console-mvp-38ac"
Write-Host "  cd agent-console → npm install (if needed) → npm run dev → open $Url"
