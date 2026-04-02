@echo off
echo ========================================
echo   Nexo Messenger - Build Desktop EXE
echo ========================================
echo.

if not exist "desktop\build" mkdir desktop\build

echo [1/3] Installing dependencies...
cd desktop
call npm install

echo.
echo [2/3] Building EXE installer...
call npm run build

echo.
echo [3/3] Done!
echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Installer: desktop\dist\Nexo-Messenger-Setup-1.0.0.exe
echo.
pause
