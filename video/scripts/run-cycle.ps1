# Windows용 사이클 스크립트 (macOS의 run-cycle.sh와 동일한 역할).
# Windows 작업 스케줄러가 하루 4번 이 스크립트를 실행한다.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') 사이클 시작 ====="

node src/prepare-data.js
node src/generate-script.js
node src/generate-image.js
node src/generate-audio.js
node src/render-all.js
node src/upload-youtube.js

Write-Host "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') 사이클 완료 ====="
