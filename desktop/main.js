const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Server URL - update to your Render URL
const SERVER_URL = 'https://nexo-0hs3.onrender.com';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'logo.png'),
    title: 'Nexo Messenger',
    backgroundColor: '#09090b',
    show: false,
    frame: true,
    titleBarStyle: 'default'
  });

  // Load from server URL
  mainWindow.loadURL(SERVER_URL);
  
  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();

  // Handle external links
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== SERVER_URL && !url.startsWith(SERVER_URL)) {
      event.preventDefault();
      require('electron').shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('get-server-url', () => {
  return SERVER_URL;
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

// Allow CORS for the server URL
app.on('ready', () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*']
      }
    });
  });
});
