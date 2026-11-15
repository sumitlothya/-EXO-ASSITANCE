const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: (name, folder) => ipcRenderer.invoke('file-open', name, folder),
  moveFile: (src, dest) => ipcRenderer.invoke('file-move', src, dest),
  listFiles: (folder) => ipcRenderer.invoke('file-list', folder),
  latestFile: (folder) => ipcRenderer.invoke('file-latest', folder),
  openApp: (name) => ipcRenderer.invoke('app-open', name),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
});

