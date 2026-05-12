$ErrorActionPreference = "Stop"

$appName = "Wargram"
$installDir = Join-Path $env:LOCALAPPDATA $appName
$zipPath = Join-Path $PSScriptRoot "wargram-win-unpacked.zip"

Get-Process -Name $appName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if (Test-Path $installDir) {
  Remove-Item -LiteralPath $installDir -Recurse -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Expand-Archive -LiteralPath $zipPath -DestinationPath $installDir -Force

$exePath = Join-Path $installDir "Wargram.exe"
$shell = New-Object -ComObject WScript.Shell

$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "Wargram.lnk"
$shortcut = $shell.CreateShortcut($desktopShortcut)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = $installDir
$shortcut.IconLocation = $exePath
$shortcut.Save()

$startMenuDir = Join-Path ([Environment]::GetFolderPath("Programs")) "Wargram"
New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null
$startShortcut = Join-Path $startMenuDir "Wargram.lnk"
$shortcut = $shell.CreateShortcut($startShortcut)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = $installDir
$shortcut.IconLocation = $exePath
$shortcut.Save()

Start-Process -FilePath $exePath -WorkingDirectory $installDir
