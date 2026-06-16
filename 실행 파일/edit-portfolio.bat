@echo off
setlocal
cd /d "%~dp0"
if not exist "admin.html" (
    cd ..
)
if not exist "admin.html" (
    echo Could not find admin.html.
    echo Put this file inside the Spine-Viewer folder or one folder below it.
    echo.
    pause
    exit /b 1
)
set PORT=8001

:find_port
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
    set /a PORT+=1
    goto find_port
)

echo Starting local portfolio editor...
echo.
echo A browser window will open at:
echo http://127.0.0.1:%PORT%/admin.html
echo.
echo Keep this window open while editing.
echo Close this window when you are done.
echo.

start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:%PORT%/admin.html'"
python "%~dp0local_editor_server.py" %PORT%

pause
