const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

// Server URL (can be changed in settings)
let SERVER_URL = process.env.NEXO_SERVER_URL || 'http://localhost:3001';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Nexo Messenger',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load server or production build
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL(SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Try to load from built web files
    const webPath = path.join(__dirname, '..', '..', 'apps', 'server', 'web', 'dist', 'index.html');
    mainWindow.loadFile(webPath).catch(() => {
      mainWindow.loadURL(SERVER_URL);
    });
  }

  // Create menu
  const template = [
    {
      label: 'Файл',
      submenu: [
        { label: 'Настройки сервера', click: () => showServerSettings() },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Помощь',
      submenu: [
        { label: 'О приложении', click: () => showAbout() }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showServerSettings() {
  const settingsWindow = new BrowserWindow({
    width: 500,
    height: 300,
    title: 'Настройки сервера',
    parent: mainWindow,
    modal: true
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; padding: 30px; }
        h2 { margin-bottom: 20px; color: #6366f1; }
        input { width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #333; background: #16213e; color: #eee; font-size: 14px; }
        button { width: 100%; padding: 12px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 10px; }
        .btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
        .btn-secondary { background: #333; color: #eee; }
      </style>
    </head>
    <body>
      <h2>🌐 Настройки сервера</h2>
      <label>URL сервера:</label>
      <input type="text" id="serverUrl" value="${SERVER_URL}" placeholder="http://localhost:3001">
      <button class="btn-primary" onclick="saveAndRestart()">Применить и перезагрузить</button>
      <button class="btn-secondary" onclick="window.close()">Отмена</button>
      <script>
        function saveAndRestart() {
          const url = document.getElementById('serverUrl').value.trim();
          if (url) {
            require('electron').ipcRenderer.send('set-server-url', url);
          }
        }
      </script>
    </body>
    </html>
  `;

  settingsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

function showAbout() {
  const aboutWindow = new BrowserWindow({
    width: 400,
    height: 300,
    title: 'О приложении',
    parent: mainWindow,
    modal: true
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; padding: 30px; text-align: center; }
        h1 { background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; }
        p { margin: 5px 0; color: #888; }
      </style>
    </head>
    <body>
      <h1>Nexo Messenger</h1>
      <p>Версия: 1.0.0</p>
      <p>Платформа: Windows</p>
      <p>Сервер: ${SERVER_URL}</p>
    </body>
    </html>
  `;

  aboutWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle URL change
ipcMain.on('set-server-url', (event, url) => {
  SERVER_URL = url;
  if (mainWindow) {
    mainWindow.loadURL(url);
    event.sender.close();
  }
});
