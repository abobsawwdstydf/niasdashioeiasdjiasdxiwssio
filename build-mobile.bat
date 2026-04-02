@echo off
echo ========================================
echo   Nexo Messenger - Build Mobile APK
echo ========================================
echo.

echo [1/5] Installing dependencies...
cd mobile
call npm install

echo.
echo [2/5] Initializing Capacitor...
npx cap init "Nexo Messenger" "com.nexo.messenger" --web-dir=.

echo.
echo [3/5] Adding Android platform...
npx cap add android

echo.
echo [4/5] Syncing web assets...
npx cap sync

echo.
echo [5/5] Building APK...
echo This will download Android SDK if not installed...
npx cap build android

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo APK location: mobile\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo To install on device:
echo   1. Enable USB debugging on your Android device
echo   2. Connect device via USB
echo   3. Run: adb install mobile\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Or copy APK to device and install manually
echo.
pause
