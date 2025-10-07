const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { Worker } = require('worker_threads');
const sudo = require('sudo-prompt');
const Store = require("electron-store");
const { exec } = require('child_process');

const store = new Store();
let mainWindow;
let isFirewallOn = null;
const taskName = "TForceAntiVirusScheduledScan";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
    frame: false, backgroundColor: '#000', icon: path.join(__dirname, "assets", "icon.ico")
  });
  mainWindow.loadFile("index.html");
  sudo.exec('netsh advfirewall show allprofiles', { name: 'TForce Security' }, (err, out) => {
    if (out) isFirewallOn = out.toString().includes("State                                 ON");
  });
}

ipcMain.handle('set-schedule', (_, schedule) => {
  const defenderPath = `C:\\Program Files\\Windows Defender\\MpCmdRun.exe`;
  let scanArgs = `-Scan -ScanType ${schedule.type === 'Quick' ? '1' : '2'}`;
  const time = `${schedule.time.toString().padStart(2, '0')}:00`;
  let scheduleArgs = `/sc ${schedule.frequency} /st ${time}`;
  if (schedule.frequency === 'WEEKLY') {
    scheduleArgs += ` /d ${schedule.day}`;
  }
  const command = `schtasks /create /tn "${taskName}" /tr "'${defenderPath}' ${scanArgs}" ${scheduleArgs} /rl HIGHEST /f`;
  sudo.exec(command, { name: 'TForce Task Scheduler' }, (error) => {
    if (error) console.error(`Schedule Create Error: ${error}`);
  });
});

ipcMain.handle('delete-schedule', () => {
  const command = `schtasks /delete /tn "${taskName}" /f`;
  sudo.exec(command, { name: 'TForce Task Scheduler' }, (error) => {
    if (error && !error.message.includes('not found')) {
      console.error(`Schedule Delete Error: ${error}`);
    }
  });
});

ipcMain.handle("start-scan", (_, scanType, customPath) => {
  const defenderPath = `'C:\\Program Files\\Windows Defender\\MpCmdRun.exe'`;
  let scanArgs = `-Scan -ScanType `;
  switch(scanType) {
    case 'Quick': scanArgs += '1'; break;
    case 'Full': scanArgs += '2'; break;
    case 'Custom':
      if (!customPath) return;
      scanArgs += `3 -File "${customPath}"`;
      break;
    default: return;
  }
  const fullCommand = `powershell -Command "Start-Process -FilePath ${defenderPath} -ArgumentList '${scanArgs}' -Wait -WindowStyle Hidden"`;
  const sudoOptions = { name: 'TForce Security Scan' };
  sudo.exec(fullCommand, sudoOptions, (error, stdout) => {
    if (error) { mainWindow.webContents.send('scan-update', { type: 'complete', threatsFound: -1 }); return; }
    const output = stdout.toString();
    let threatCount = 0;
    if (output.toLowerCase().includes("found some threats")) { threatCount = 1; }
    if (threatCount > 0) {
      const threatData = { filePath: "Threat detected by Windows Defender", threatName: "See Windows Security for details" };
      mainWindow.webContents.send('scan-update', { type: 'threat', ...threatData });
    }
    mainWindow.webContents.send('scan-update', { type: 'complete', threatsFound: threatCount });
  });
});

ipcMain.handle("get-firewall-status", () => { return new Promise(resolve => { sudo.exec('netsh advfirewall show allprofiles', { name: 'TForce Security' }, (err, out) => { if (err) return resolve("Unknown"); isFirewallOn = out.toString().includes("State                                 ON"); resolve(isFirewallOn ? "Firewall: ON" : "Firewall: OFF"); }); }); });
ipcMain.handle("toggle-firewall", async () => { const currentState = await new Promise(resolve => { sudo.exec('netsh advfirewall show allprofiles', { name: 'TForce Security' }, (err, out) => { if (err) return resolve("Unknown"); resolve(out.toString().includes("State                                 ON") ? "Firewall: ON" : "Firewall: OFF"); }); }); const newState = currentState === "Firewall: ON" ? 'off' : 'on'; const command = `netsh advfirewall set allprofiles state ${newState}`; return new Promise(resolve => { sudo.exec(command, { name: 'TForce Security Firewall' }, (error) => { if (error) return resolve("ERROR"); isFirewallOn = (newState === 'on'); resolve(isFirewallOn ? "Firewall: ON" : "Firewall: OFF"); }); }); });
ipcMain.handle('get-system-stats', () => { return new Promise((resolve) => { const worker = new Worker(path.join(__dirname, 'worker.js')); const timeout = setTimeout(() => { worker.terminate(); resolve({ error: true, message: "Stats worker timed out." }); }, 1500); worker.on('message', (response) => { clearTimeout(timeout); resolve(response.success ? response.data : { error: true, message: response.error }); }); worker.on('error', (err) => { clearTimeout(timeout); resolve({ error: true, message: err.message }); }); worker.postMessage('get-stats'); }); });
ipcMain.handle('select-folder', async () => { const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] }); return canceled || filePaths.length === 0 ? null : filePaths[0]; });
ipcMain.on("add-quarantine", (event, file) => { let q = store.get('quarantineList', []); q.push({ file, time: new Date().toISOString() }); store.set('quarantineList', q); });
ipcMain.on("set-store", (_, key, value) => { store.set(key, value); });
ipcMain.handle("get-store", (_, key) => { return store.get(key); });
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('maximize-window', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('close-window', () => mainWindow?.close());