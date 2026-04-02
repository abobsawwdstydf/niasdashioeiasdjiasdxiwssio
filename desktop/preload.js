const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  platform: process.platform
});
