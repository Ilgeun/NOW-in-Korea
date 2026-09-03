# One-time setup: registers a Windows Task Scheduler job that runs
# run-cycle.ps1 daily at 00:00 / 06:00 / 12:00 / 18:00.
# (Equivalent of the launchd plist used on macOS.)

$scriptPath = Join-Path $PSScriptRoot "run-cycle.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

$triggers = @(
  New-ScheduledTaskTrigger -Daily -At "00:00"
  New-ScheduledTaskTrigger -Daily -At "06:00"
  New-ScheduledTaskTrigger -Daily -At "12:00"
  New-ScheduledTaskTrigger -Daily -At "18:00"
)

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries

Register-ScheduledTask -TaskName "NOW-in-Korea-VideoUploader" `
  -Action $action `
  -Trigger $triggers `
  -Settings $settings `
  -Description "NOW in Korea video generation and YouTube upload, 4x per day" `
  -RunLevel Limited

Write-Host ""
Write-Host "Done. Check Task Scheduler (taskschd.msc) for 'NOW-in-Korea-VideoUploader'."
Write-Host "To test it right now, run:"
Write-Host "  Start-ScheduledTask -TaskName 'NOW-in-Korea-VideoUploader'"
