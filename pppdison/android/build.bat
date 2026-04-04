@echo off
echo ============================================
echo    Nexo Messenger - Android APK Build
echo ============================================
echo.

cd /d "%~dp0app"

echo [1/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/4] Building web app...
cd ..\..\apps\server\web
call npm install
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build web app
    pause
    exit /b 1
)
cd %~dp0app

echo.
echo [3/4] Syncing Android project...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Failed to sync
    pause
    exit /b 1
)

echo.
echo [4/4] Building APK...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo ERROR: Failed to build APK
    pause
    exit /b 1
)

echo.
echo ============================================
echo    APK Build Complete!
echo ============================================
echo.
echo APK location: %~dp0app\android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
