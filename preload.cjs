const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  printHtml: (html, options) => ipcRenderer.invoke('print-html', { html, options }),
  saveCsv: (fileName, content, subfolder) => ipcRenderer.invoke('save-csv', { fileName, content, subfolder }),
  chooseBackupDirectory: () => ipcRenderer.invoke('choose-backup-dir'),
  saveJson: (fileName, content, directory) => ipcRenderer.invoke('save-json', { fileName, content, directory }),
  loadJson: (fileName, directory) => ipcRenderer.invoke('load-json', { fileName, directory }),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onAppClose: (callback) => ipcRenderer.on('app-close', () => callback()),
  closeApp: () => ipcRenderer.send('close-app'),
  showAlert: (message, title) => ipcRenderer.sendSync('show-alert-sync', { message, title }),
  showConfirm: (message, title) => ipcRenderer.sendSync('show-confirm-sync', { message, title }),
  onWebhookOrder: (callback) => ipcRenderer.on('webhook-order', (event, data) => callback(data)),
  dbCall: (method, ...args) => ipcRenderer.invoke('db-call', { method, args })
});

