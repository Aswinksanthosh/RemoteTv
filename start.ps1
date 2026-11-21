# Hidden launcher run by the scheduled task. Exit code 75 = start again now (after an update),
# 0 = stop (another copy runs), anything else = wait 5 seconds and start again.
$root = $PSScriptRoot
$dir = Join-Path $env:USERPROFILE '.remotetv'
New-Item -ItemType Directory -Force $dir | Out-Null
$log = Join-Path $dir 'remotetv.log'
while ($true) {
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 1MB) { Move-Item $log "$log.old" -Force }
  & node "$root\bin\remotetv.mjs" *>> $log
  $code = $LASTEXITCODE
  if ($code -eq 75) { continue }
  if ($code -eq 0) { break }
  Start-Sleep -Seconds 5
}
