@echo off
echo ========================================
echo   Nexo Messenger - Build Dark Installer
echo ========================================
echo.

cd desktop

echo [1/3] Creating installer assets...

REM Create placeholder icon (replace with real 256x256 icon)
if not exist "build\icon.ico" (
  echo Creating placeholder icon...
  echo [icon placeholder - replace with real icon.ico] > build\icon.ico.txt
)

echo.
echo [2/3] Installing dependencies...
call npm install --legacy-peer-deps

echo.
echo [3/3] Building dark themed installer...
echo This may take 5-10 minutes...
call npm run build

cd ..

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
if exist "desktop\dist\*.exe" (
echo SUCCESS! Dark themed installer created:
echo.
dir /b desktop\dist\*.exe
echo.
echo Features:
echo   - Dark theme (#09090b background)
echo   - Custom installation directory
echo   - Desktop + Start Menu shortcuts
echo   - Auto-launch after install
echo   - Russian + English support
) else (
echo ERROR: Build failed
)
echo.
pause
