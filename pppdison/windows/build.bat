@echo off
echo ============================================
echo    Nexo Messenger - Windows Build
echo ============================================
echo.

cd /d "%~dp0app"

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/3] Building EXE...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build
    pause
    exit /b 1
)

echo.
echo [3/3] Build complete!
echo.
echo Files created in: %~dp0app\dist\
echo.
dir %~dp0app\dist\*.exe /b
echo.
pause
