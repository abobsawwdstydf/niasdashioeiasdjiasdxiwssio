const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Server URL - update this to your Render URL
const SERVER_URL = 'https://твоё-приложение.onrender.com';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'logo.png'),
    title: 'Nexo Messenger',
    backgroundColor: '#09090b'
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
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

// IPC handlers for API URL
ipcMain.handle('get-server-url', () => {
  return SERVER_URL;
});
