const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // New Version API
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Store API
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value),
  
  // File & System API
  getStylePath: () => ipcRenderer.invoke('get-style-path'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),

  // Scan API
  onScanUpdate: (callback) => ipcRenderer.on('scan-update', (_event, value) => callback(value)),
  startScan: (scanType, path) => ipcRenderer.invoke('start-scan', scanType, path),

  // Window API
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
});