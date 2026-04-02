@echo off
echo ========================================
echo   Nexo Messenger - Build APK ^& EXE
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
echo [1/5] Installing dependencies...
call npm install

echo.
echo [2/5] Updating API configuration...
echo // Nexo App Configuration > apps\web\src\config.ts
echo export const API_URL = '%SERVER_URL%'; >> apps\web\src\config.ts
echo export const SOCKET_CONFIG = { >> apps\web\src\config.ts
echo   transports: ['websocket', 'polling'], >> apps\web\src\config.ts
echo   reconnection: true, >> apps\web\src\config.ts
echo   reconnectionAttempts: 10, >> apps\web\src\config.ts
echo   reconnectionDelay: 1000, >> apps\web\src\config.ts
echo }; >> apps\web\src\config.ts
echo export const APP_CONFIG = { >> apps\web\src\config.ts
echo   name: 'Nexo Messenger', >> apps\web\src\config.ts
echo   version: '1.0.0', >> apps\web\src\config.ts
echo   maxFileSize: 25 * 1024 * 1024 * 1024, >> apps\web\src\config.ts
echo   maxFilesPerMessage: 1200, >> apps\web\src\config.ts
echo }; >> apps\web\src\config.ts

echo.
echo [3/5] Building web app...
call npm run build -w apps/web

echo.
echo [4/5] Building server...
call npm run build -w apps/server

echo.
echo [5/5] Creating distribution packages...

REM Create mobile app structure
echo Creating mobile app...
if exist "mobile" rmdir /q /s mobile
mkdir mobile
xcopy /E /I /Y "apps\web\dist" "mobile"

REM Copy config to mobile
copy /Y "apps\web\src\config.ts" "mobile\config.js"

REM Create desktop app structure
echo Creating desktop app...
if exist "desktop" rmdir /q /s desktop
mkdir desktop
xcopy /E /I /Y "apps\web\dist" "desktop"

REM Create Electron package.json for desktop
echo {
  "name": "nexo-desktop",
  "version": "1.0.0",
  "description": "Nexo Messenger Desktop App",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "devDependencies": {
    "electron": "^28.0.0"
  }
} > desktop\package.json

REM Create Electron main.js
(
echo const { app, BrowserWindow } = require('electron');
echo const path = require('path');
echo const { API_URL } = require('./config');
echo.
echo function createWindow() {
echo   const win = new BrowserWindow({
echo     width: 1200,
echo     height: 800,
echo     webPreferences: {
echo       nodeIntegration: false,
echo       contextIsolation: true,
echo       preload: path.join(__dirname, 'preload.js')
echo     },
echo     icon: path.join(__dirname, 'logo.png'),
echo     title: 'Nexo Messenger'
echo   });
echo   win.loadFile('index.html');
echo }
echo.
echo app.whenReady().then(createWindow);
echo.
echo app.on('window-all-closed', () => {
echo   if (process.platform !== 'darwin') app.quit();
echo });
) > desktop\main.js

REM Create Electron preload.js
(
echo const { contextBridge, ipcRenderer } = require('electron');
echo contextBridge.exposeInMainWorld('electronAPI', {
echo   getAPIUrl: () => '%SERVER_URL%'
echo });
) > desktop\preload.js

REM Copy config to desktop
copy /Y "apps\web\src\config.ts" "desktop\config.js"

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Server URL: %SERVER_URL%
echo.
echo Mobile app:    mobile/
echo Desktop app:   desktop/
echo.
echo To run Desktop app:
echo   cd desktop
echo   npm install
echo   npm run start
echo.
echo To build Desktop EXE:
echo   cd desktop
echo   npm install
echo   npx electron-builder --win
echo.
echo To build Mobile APK (requires Android Studio):
echo   Use Capacitor:
echo   cd mobile
echo   npm init -y
echo   npm install @capacitor/core @capacitor/cli
echo   npx cap init
echo   npx cap add android
echo   npx cap build android
echo.
pause
