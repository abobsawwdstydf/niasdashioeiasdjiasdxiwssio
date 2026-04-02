@echo off
echo ========================================
echo   Nexo Messenger - Build APK & EXE
echo ========================================
echo.

echo [1/4] Installing dependencies...
call npm install

echo.
echo [2/4] Building web app...
call npm run build -w apps/web

echo.
echo [3/4] Building server...
call npm run build -w apps/server

echo.
echo [4/4] Creating distribution packages...

REM Create APK wrapper (using Capacitor/Electron approach)
echo Creating mobile app structure...
if not exist "mobile" mkdir mobile
copy /Y "apps\web\dist\*.*" "mobile\" /E

REM Create EXE wrapper (using Electron)
echo Creating desktop app structure...
if not exist "desktop" mkdir desktop
copy /Y "apps\web\dist\*.*" "desktop\" /E

REM Create Electron package.json for desktop
echo {
  "name": "nexo-desktop",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "devDependencies": {
    "electron": "^28.0.0"
  }
} > desktop\package.json

REM Create Electron main.js
echo const { app, BrowserWindow } = require('electron');
echo const path = require('path');
echo.
echo function createWindow() {
echo   const win = new BrowserWindow({
echo     width: 1200,
echo     height: 800,
echo     webPreferences: {
echo       nodeIntegration: true
echo     },
echo     icon: path.join(__dirname, 'logo.png')
echo   });
echo   win.loadFile('index.html');
echo }
echo.
echo app.whenReady().then(createWindow);
echo.
echo app.on('window-all-closed', () => {
echo   if (process.platform !== 'darwin') app.quit();
echo });
> desktop\main.js

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Mobile app:    mobile/
echo Desktop app:   desktop/
echo.
echo To build EXE:
echo   cd desktop
echo   npm install
echo   npm run start
echo.
echo To build APK (requires Android Studio):
echo   Use Capacitor or Cordova with mobile/ folder
echo.
pause
