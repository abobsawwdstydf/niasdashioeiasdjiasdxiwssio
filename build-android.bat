@echo off
echo ========================================
echo   Nexo Messenger - Build Android APK
echo ========================================
echo.

REM Get server URL from user
set /p SERVER_URL="Enter your server URL (e.g., https://nexo.onrender.com): "

if "%SERVER_URL%"=="" (
    echo Error: Server URL is required!
    pause
    exit /b 1
)

echo.
echo [1/6] Installing dependencies...
call npm install

echo.
echo [2/6] Building web app...
call npm run build -w apps/web

echo.
echo [3/6] Creating mobile app structure...
if exist "mobile" rmdir /q /s mobile
mkdir mobile
xcopy /E /I /Y "apps\web\dist" "mobile"

echo.
echo [4/6] Updating API configuration...
(
echo // Nexo App Configuration
echo export const API_URL = '%SERVER_URL%';
echo export const SOCKET_CONFIG = {
echo   transports: ['websocket', 'polling'],
echo   reconnection: true,
echo   reconnectionAttempts: 10,
echo   reconnectionDelay: 1000,
echo };
echo export const APP_CONFIG = {
echo   name: 'Nexo Messenger',
echo   version: '1.0.0',
echo   maxFileSize: 25 * 1024 * 1024 * 1024,
echo   maxFilesPerMessage: 1200,
echo };
) > mobile\config.js

echo.
echo [5/6] Initializing Capacitor...
cd mobile

REM Create package.json
echo {
  "name": "nexo-mobile",
  "version": "1.0.0",
  "description": "Nexo Messenger Mobile App",
  "main": "index.js",
  "scripts": {
    "build": "npx cap sync",
    "open": "npx cap open android",
    "build:apk": "npx cap build android"
  },
  "dependencies": {
    "@capacitor/android": "^5.0.0",
    "@capacitor/core": "^5.0.0",
    "@capacitor/cli": "^5.0.0"
  }
} > package.json

REM Install Capacitor
echo Installing Capacitor...
call npm install

REM Initialize Capacitor
echo Initializing Capacitor...
npx cap init "Nexo Messenger" "com.nexo.messenger" --web-dir=.

REM Add Android platform
echo Adding Android platform...
npx cap add android

REM Sync web assets
echo Syncing web assets...
npx cap sync

echo.
echo [6/6] Building APK...
echo This will download Android SDK if not installed...
npx cap build android

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo APK location: mobile/android/app/build/outputs/apk/
echo.
echo To install on device:
echo   adb install mobile/android/app/build/outputs/apk/debug/app-debug.apk
echo.
echo Server URL: %SERVER_URL%
echo.
pause
