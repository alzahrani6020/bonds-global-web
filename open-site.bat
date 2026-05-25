@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
echo.
echo تم تشغيل الخادم في نافذة منفصلة. أغلق تلك النافذة لإيقاف المعاينة.
pause
