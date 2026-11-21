# One-time setup: installs what is missing, pairs the phone, starts RemoteTv at every sign-in.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}
try {
  function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') }
  function Need($cmd, $id, $name) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
      Write-Host "Installing $name ..."
      winget install -e --id $id --accept-package-agreements --accept-source-agreements | Out-Null
      Refresh-Path
      if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$name was installed but is not visible yet. Close this window and run Install.cmd again." }
    }
  }
  if ($root -like '*OneDrive*') { Write-Host 'Note: this folder is inside OneDrive. It works, but a folder like C:\RemoteTv is more reliable.' -ForegroundColor Yellow }
  Need node OpenJS.NodeJS.LTS 'Node.js'
  Need git Git.Git 'Git'
  $hasAdb = (Get-Command adb -ErrorAction SilentlyContinue) -or (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter 'Google.PlatformTools*' -ErrorAction SilentlyContinue)
  if (-not $hasAdb) { Write-Host 'Installing ADB ...'; winget install -e --id Google.PlatformTools --accept-package-agreements --accept-source-agreements | Out-Null }

  node "$root\bin\setup.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Setup did not finish (see the message above).' }

  # Let the phone (Tailscale addresses only) reach the page.
  Get-NetFirewallRule -DisplayName 'RemoteTv' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName 'RemoteTv' -Direction Inbound -Protocol TCP -LocalPort 8793 -RemoteAddress '100.64.0.0/10' -Action Allow -Profile Any | Out-Null

  # Start at every sign-in, hidden, restarting by itself.
  $name = 'RemoteTv'
  Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$root\start.ps1`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName $name
  Write-Host "`nDone. RemoteTv is running and will start by itself at every sign-in." -ForegroundColor Green
  Write-Host 'Use the phone page from now on. You do not need to touch this laptop again.'
} catch {
  Write-Host "`nProblem: $($_.Exception.Message)" -ForegroundColor Red
}
Read-Host "`nPress Enter to close"
