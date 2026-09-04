# Windows version of run-cycle.sh. Windows Task Scheduler runs this
# script 4 times a day (registered by setup-task-scheduler.ps1).
# All output is also saved to logs\run-cycle.log since Task Scheduler
# does not capture console output on its own.
$root = Join-Path $PSScriptRoot ".."
Set-Location $root

$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Start-Transcript -Path (Join-Path $logDir "run-cycle.log") -Append

# node.exe returning a non-zero exit code does NOT stop the script by itself
# (only PowerShell cmdlet errors do) - check $LASTEXITCODE after each step.
function Invoke-Step {
  param([string]$ScriptPath)
  node $ScriptPath
  if ($LASTEXITCODE -ne 0) {
    throw "$ScriptPath failed with exit code $LASTEXITCODE"
  }
}

try {
  Write-Host "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') cycle start ====="

  Invoke-Step "src/prepare-data.js"
  Invoke-Step "src/generate-script.js"
  Invoke-Step "src/generate-image.js"
  Invoke-Step "src/generate-audio.js"
  Invoke-Step "src/render-all.js"
  Invoke-Step "src/upload-youtube.js"
  Invoke-Step "src/upload-drive.js"

  Write-Host "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') cycle done ====="
} catch {
  Write-Host "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') cycle FAILED: $_ ====="
} finally {
  Stop-Transcript
}
