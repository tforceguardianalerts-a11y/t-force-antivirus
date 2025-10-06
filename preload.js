const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  startScan: (scanType, path) => ipcRenderer.invoke("start-scan", scanType, path),
  onScanUpdate: (callback) => ipcRenderer.on("scan-update", (_, data) => callback(data)),
  toggleFirewall: () => ipcRenderer.invoke("toggle-firewall"),
  getFirewallStatus: () => ipcRenderer.invoke("get-firewall-status"),
  addToQuarantine: (file) => ipcRenderer.send("add-quarantine", file),
  setStoreValue: (key, value) => ipcRenderer.send("set-store", key, value),
  getStoreValue: (key) => ipcRenderer.invoke("get-store", key),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
});