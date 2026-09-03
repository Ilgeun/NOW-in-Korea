# 딱 한 번만 실행하는 설치 스크립트: Windows 작업 스케줄러에
# "매일 00:00 / 06:00 / 12:00 / 18:00에 run-cycle.ps1 실행"을 등록한다.
# (macOS의 launchd plist와 동일한 역할)

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
  -Description "NOW in Korea - 6시간마다 트렌드 영상 생성 및 유튜브 업로드" `
  -RunLevel Limited

Write-Host "`n등록 완료! '작업 스케줄러' 앱(taskschd.msc)에서 'NOW-in-Korea-VideoUploader'로 확인할 수 있습니다."
Write-Host "지금 바로 한 번 테스트하려면: Start-ScheduledTask -TaskName 'NOW-in-Korea-VideoUploader'"
