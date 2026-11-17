# Installs an Agent Console shortcut on the Windows Desktop.
# Creates both a .url Internet Shortcut and a .lnk via WScript.Shell.
#
# Usage (from agent-console/):
#   powershell -ExecutionPolicy Bypass -File .\scripts\install-desktop-shortcut.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\install-desktop-shortcut.ps1 -Url "http://127.0.0.1:5174/"
#
# Or: right-click this file → Run with PowerShell

param(
  [string]$Url = "http://127.0.0.1:5173/",
  [string]$Name = "Agent Console"
)

$ErrorActionPreference = "Stop"

$desktop = [Environment]::GetFolderPath("Desktop")
if (-not $desktop -or -not (Test-Path $desktop)) {
  throw "Could not resolve Desktop folder."
}

# 1) .url Internet Shortcut
$urlPath = Join-Path $desktop "$Name.url"
@"
[InternetShortcut]
URL=$Url
"@ | Set-Content -Path $urlPath -Encoding ASCII

# 2) .lnk via WScript.Shell (opens default browser at URL)
$lnkPath = Join-Path $desktop "$Name.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $Url
$shortcut.Description = "Open local Agent Console ($Url)"
$shortcut.WorkingDirectory = $desktop
try {
  $shortcut.Save()
} catch {
  Write-Warning "Could not write .lnk (TargetPath as URL may be blocked). .url was still created."
  Write-Warning $_.Exception.Message
}

Write-Host "Desktop shortcuts:"
Write-Host "  $urlPath"
if (Test-Path $lnkPath) {
  Write-Host "  $lnkPath"
}
Write-Host "  → $Url"
Write-Host ""
Write-Host "Start the app first: npm install && npm run dev"
