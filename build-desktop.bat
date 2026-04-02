@echo off
echo ========================================
echo   Nexo Messenger - Build Desktop EXE
echo ========================================
echo.

REM Check if build directory exists
if not exist "build" mkdir build

echo [1/4] Creating installer resources...

REM Create simple icon placeholder (you should replace with real icon)
echo Creating placeholder icon...
(
echo [icon]
echo width=256
echo height=256
echo colors=32
) > build\icon.ico.txt

echo.
echo [2/4] Installing dependencies...
cd desktop
call npm install

echo.
echo [3/4] Building EXE installer...
echo This may take several minutes...
call npm run build

echo.
echo [4/4] Done!
echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Installer location: desktop\dist\Nexo-Messenger-Setup-1.0.0.exe
echo.
echo Features:
echo   ✓ Dark themed installer
echo   ✓ Custom installation directory
echo   ✓ Desktop shortcut created
echo   ✓ Start menu shortcut created
echo   ✓ Uninstaller included
echo.
echo To install:
echo   1. Run desktop\dist\Nexo-Messenger-Setup-1.0.0.exe
echo   2. Choose installation folder
echo   3. Click Install
echo   4. Launch Nexo Messenger from desktop
echo.
pause
