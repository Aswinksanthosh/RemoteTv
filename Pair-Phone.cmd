@echo off
rem Shows a new QR code for a phone. Old phone links stop working.
cd /d "%~dp0"
node bin\pair.mjs
echo.
pause
