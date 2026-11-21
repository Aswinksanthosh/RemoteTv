@echo off
rem Stops RemoteTv and removes its auto-start. Your settings folder (.remotetv) stays.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Stop-ScheduledTask -TaskName RemoteTv -ErrorAction SilentlyContinue; Unregister-ScheduledTask -TaskName RemoteTv -Confirm:$false -ErrorAction SilentlyContinue; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*remotetv.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo RemoteTv removed from start-up.
pause
