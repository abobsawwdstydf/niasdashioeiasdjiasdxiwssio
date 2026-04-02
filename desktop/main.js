const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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
    icon: path.join(__dirname, 'build', 'icon.ico'),
    title: 'Nexo Messenger',
    backgroundColor: '#09090b'
  });

  mainWindow.loadURL(SERVER_URL);
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== SERVER_URL && !url.startsWith(SERVER_URL)) {
      event.preventDefault();
      require('electron').shell.openExternal(url);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('get-server-url', () => SERVER_URL);
ipcMain.handle('get-platform', () => process.platform);
