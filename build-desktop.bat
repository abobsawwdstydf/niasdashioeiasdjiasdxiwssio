@echo off
echo ========================================
echo   Nexo Messenger - Build Desktop EXE
echo ========================================
echo.

cd desktop

echo [1/2] Installing dependencies...
call npm install --legacy-peer-deps

echo.
echo [2/2] Building EXE installer...
echo This may take 5-10 minutes...
call npm run build

cd ..

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
if exist "desktop\dist\*.exe" (
echo SUCCESS! Installer created:
dir /b desktop\dist\*.exe
) else (
echo ERROR: Build failed, dist folder not created
echo Check error messages above
)
echo.
pause
