# Windows version of run-cycle.sh. Windows Task Scheduler runs this
# script 4 times a day (registered by setup-task-scheduler.ps1).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') cycle start ====="

node src/prepare-data.js
node src/generate-script.js
node src/generate-image.js
node src/generate-audio.js
node src/render-all.js
node src/upload-youtube.js

Write-Host "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') cycle done ====="
