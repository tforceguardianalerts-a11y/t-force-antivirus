const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require('path');
const { pathToFileURL } = require('url');
const { Worker } = require('worker_threads');
const sudo = require('sudo-prompt');
const Store = require("electron-store");
const { autoUpdater } = require('electron-updater');

const store = new Store();
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 768,
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
    frame: false, backgroundColor: '#0a0f1c'
  });
  mainWindow.loadFile("index.html");
  mainWindow.on("closed", () => { mainWindow = null; });

  // Check for updates after the window is created
  mainWindow.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
}

// --- AUTO-UPDATER LOGIC ---
autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-status', 'Update available. Downloading...');
});
autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-status', 'Update downloaded. Restart the app to apply.');
});

// --- IPC HANDLERS ---
// ... (All existing handlers are unchanged)

// --- Pasting for completion ---
ipcMain.handle('start-scan', (event, scanType, customPath) => { const defenderPath = `"C:\\Program Files\\Windows Defender\\MpCmdRun.exe"`; let scanArgs = ['-Scan', '-ScanType']; switch (scanType) { case 'Quick': scanArgs.push('1'); break; case 'Full': scanArgs.push('2'); break; case 'Custom': if (customPath) { scanArgs.push('3', '-File', `"${customPath}"`); } else { scanArgs.push('1'); } break; default: return; } const fullCommand = `${defenderPath} ${scanArgs.join(' ')}`; const sudoOptions = { name: 'TForce Anti Virus' }; sudo.exec(fullCommand, sudoOptions, (error, stdout) => { if (error) { console.error(`Sudo Exec Error: ${error}`); mainWindow.webContents.send('scan-update', { type: 'complete', threatsFound: -1 }); return; } const output = stdout.toString(); const match = output.match(/Threats found:\s*(\d+)/); const threatCount = match ? parseInt(match[1]) : 0; if (threatCount > 0) { mainWindow.webContents.send('scan-update', { type: 'threat', filePath: 'See Windows Security for details', threatName: `${threatCount} threat(s) detected` }); } mainWindow.webContents.send('scan-update', { type: 'complete', threatsFound: threatCount }); }); });
ipcMain.handle('get-store-value', (_, key) => store.get(key));
ipcMain.handle('set-store-value', (_, key, value) => store.set(key, value));
ipcMain.handle('get-style-path', () => pathToFileURL(path.join(__dirname, 'style.css')).href);
ipcMain.handle('select-folder', async () => { const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] }); return canceled ? null : filePaths[0]; });
ipcMain.handle('get-system-stats', () => { return new Promise((resolve) => { const worker = new Worker(path.join(__dirname, 'worker.js')); const timeout = setTimeout(() => { worker.terminate(); resolve({ error: true, message: "Stats worker timed out." }); }, 1500); worker.on('message', (response) => { clearTimeout(timeout); resolve(response.success ? response.data : { error: true, message: response.error }); worker.terminate(); }); worker.on('error', (err) => { clearTimeout(timeout); resolve({ error: true, message: err.message }); worker.terminate(); }); worker.postMessage('get-stats'); }); });
app.on("ready", createWindow);
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
app.on("activate", () => mainWindow === null && createWindow());
ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('maximize-window', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('close-window', () => mainWindow?.close());