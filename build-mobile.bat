@echo off
echo ========================================
echo   Nexo Messenger - Build Mobile APK
echo ========================================
echo.

if not exist "mobile" mkdir mobile

echo [1/4] Installing dependencies...
cd mobile
call npm install

echo.
echo [2/4] Initializing Capacitor...
npx cap init "Nexo Messenger" "com.nexo.messenger" --web-dir=.

echo.
echo [3/4] Adding Android platform...
npx cap add android

echo.
echo [4/4] Syncing and building...
npx cap sync
npx cap build android

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo APK: mobile\android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
