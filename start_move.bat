@echo off
chcp 65001 >nul
echo Starting Bonds Duplicate Mover...
echo This window will remain open until done.
echo DO NOT CLOSE THIS WINDOW!
echo.
cd /d "C:\Users\vip\bonds-global-web"
"C:\Users\vip\AppData\Local\Programs\Python\Python312\python.exe" "move_to_d.py"
echo.
echo ========================================
echo Process finished! Press any key to exit.
echo ========================================
pause >nul
