window.addEventListener('DOMContentLoaded', () => {
  // --- ELEMENT SELECTORS ---
  const allTabs = document.querySelectorAll('.tab-content');
  const allTabBtns = document.querySelectorAll('.tab-btn');
  const clockElement = document.getElementById('clock');
  const statusCircle = document.getElementById('statusCircle');
  const statusText = document.getElementById('statusText');
  const activityLog = document.getElementById('activityLog');
  const assistantLog = document.getElementById('assistantLog');
  const systemInfoPanel = document.getElementById('systemInfoPanel');
  const scanProgressBar = document.getElementById('scanProgressBar');
  const currentlyScanningFile = document.getElementById('currentlyScanningFile');
  const quickScanBtn = document.getElementById('quickScanBtn');
  const fullScanBtn = document.getElementById('fullScanBtn');
  const customScanBtn = document.getElementById('customScanBtn');
  const scanButtons = [quickScanBtn, fullScanBtn, customScanBtn];
  const threatListElement = document.getElementById('threatList');
  const quarantineTabBtn = document.querySelector('.tab-btn[data-tab="quarantine"] .notification-dot');
  const cpuLoadEl = document.getElementById('cpuLoad');
  const ramUsageEl = document.getElementById('ramUsage');
  const enableVoiceToggle = document.getElementById('enableVoice');
  const autoQuarantineToggle = document.getElementById('autoQuarantine');
  const scanOnStartupToggle = document.getElementById('scanOnStartup');
  const appVersionSpan = document.getElementById('appVersion');

  // --- DATA STORES ---
  let quarantineList = [];
  let settings = {};
  let isProtected = true;
  let scanInProgress = false;

  // --- CORE FUNCTION DEFINITIONS ---
  function renderQuarantineList() {
    threatListElement.innerHTML = '';
    if (quarantineList.length === 0) {
      threatListElement.innerHTML = '<li>No threats detected. The system is clean.</li>';
    } else {
      quarantineList.forEach(threat => {
        const item = document.createElement('li'); item.classList.add('threat-item');
        item.innerHTML = `<span>${threat.filePath}</span><span>${threat.threatName}</span><span>${threat.date}</span><div class="threat-actions"><button class="delete-btn" data-id="${threat.id}">Delete</button><button class="restore-btn" data-id="${threat.id}">Restore</button></div>`;
        threatListElement.appendChild(item);
      });
    }
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleThreatAction));
    document.querySelectorAll('.restore-btn').forEach(btn => btn.addEventListener('click', handleThreatAction));
    quarantineTabBtn.classList.toggle('visible', quarantineList.length > 0);
  }
  async function handleThreatAction(event) {
    const threatId = Number(event.target.dataset.id);
    const action = event.target.classList.contains('delete-btn') ? 'delete' : 'restore';
    const threat = quarantineList.find(t => t.id === threatId);
    await window.api.quarantineAction(action, threat);
    quarantineList = quarantineList.filter(t => t.id !== threatId);
    await window.api.setStoreValue('quarantineList', quarantineList);
    renderQuarantineList();
  }
  function updateProtectionStatus(newStatus, message) {
    isProtected = newStatus;
    statusCircle.classList.remove('scanning', 'red');
    statusText.classList.remove('scanning');
    statusCircle.classList.toggle('red', !isProtected);
    statusText.textContent = message;
    if (!isProtected) speak(`Warning. ${message}.`);
  }
  let preferredVoice = null;
  function loadVoices() {
    const voices = speechSynthesis.getVoices();
    preferredVoice = voices.find(v => v.name === 'Google UK English Male' && v.lang === 'en-GB') || voices.find(v => v.lang === 'en-GB' && v.gender === 'male') || voices.find(v => v.lang === 'en-US' && v.gender === 'male') || voices[0];
  }
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
  function speak(message, force = false) {
    if ((!settings.enableVoice && !force) || speechSynthesis.speaking) return;
    const utter = new SpeechSynthesisUtterance(message);
    if (preferredVoice) utter.voice = preferredVoice;
    speechSynthesis.speak(utter);
    if (assistantLog) { const logEntry = document.createElement('p'); logEntry.textContent = `> ${message}`; assistantLog.prepend(logEntry); }
  }
  function createLogEntry(message, type = 'info') {
    const entry = document.createElement('li');
    entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    if (type === 'error') entry.style.color = 'var(--red-glow)';
    return entry;
  }
  function createVitalChart(canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, { type: 'doughnut', data: { datasets: [{ data: [0, 100], backgroundColor: ['#00f7ff', '#1a223e'], borderColor: '#0a0f1c', borderWidth: 2, cutout: '80%' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 500 } } });
  }
  const cpuChart = createVitalChart('cpuChart');
  const ramChart = createVitalChart('ramChart');
  async function updateSystemStats() {
    const stats = await window.api.getSystemStats();
    if (stats && !stats.error) {
      if (stats.osInfo) systemInfoPanel.textContent = `System Platform: ${stats.osInfo}`;
      cpuLoadEl.innerText = stats.cpuLoad; ramUsageEl.innerText = stats.ramUsage;
      cpuChart.data.datasets[0].data = [stats.cpuLoad, 100 - stats.cpuLoad];
      ramChart.data.datasets[0].data = [stats.ramUsage, 100 - stats.ramUsage];
      cpuChart.update(); ramChart.update();
    } else { cpuLoadEl.innerText = "N/A"; ramUsageEl.innerText = "N/A"; }
  }
  function updateClock() { clockElement.innerText = new Date().toLocaleTimeString('en-GB'); }
  async function startScan(scanType, targetPath) {
    if (scanInProgress) return;
    scanInProgress = true;
    scanButtons.forEach(b => b.disabled = true);
    scanProgressBar.classList.add('scanning');
    statusCircle.classList.remove('red');
    statusCircle.classList.add('scanning');
    statusText.classList.add('scanning');
    statusText.textContent = `SCANNING`;
    currentlyScanningFile.textContent = `Initializing scan...`;
    activityLog.prepend(createLogEntry(`${scanType} scan initiated...`));
    speak(`${scanType} scan has commenced.`);
    await window.api.startScan(scanType, targetPath);
  }
  async function saveSettings() { await window.api.setStoreValue('settings', settings); }

  // --- INITIALIZATION & EVENT LISTENERS ---
  (async () => {
    try {
      const version = await window.api.getAppVersion();
      if(appVersionSpan) appVersionSpan.innerText = `v${version}`;
      const stylesheet = document.getElementById('stylesheet');
      const stylePath = await window.api.getStylePath();
      stylesheet.setAttribute('href', stylePath);
      settings = (await window.api.getStoreValue('settings')) || { enableVoice: true, autoQuarantine: true, scanOnStartup: false };
      enableVoiceToggle.checked = settings.enableVoice;
      autoQuarantineToggle.checked = settings.autoQuarantine;
      if (scanOnStartupToggle) scanOnStartupToggle.checked = settings.scanOnStartup;
      quarantineList = (await window.api.getStoreValue('quarantineList')) || [];
      renderQuarantineList();
      if (settings.scanOnStartup) startScan('Quick', 'System Startup');
    } catch (error) { console.error("Initialization failed:", error); }
  })();

  window.api.on('update-status', (message) => {
    speak(message);
    const updateNotification = document.getElementById('updateNotification');
    if(updateNotification) updateNotification.textContent = message;
  });

  window.api.onScanUpdate(async (update) => {
    scanInProgress = false;
    scanButtons.forEach(b => b.disabled = false);
    scanProgressBar.classList.remove('scanning');
    statusCircle.classList.remove('scanning');
    statusText.classList.remove('scanning');
    scanProgressBar.value = 100;
    if (update.type === 'threat') {
      const { filePath, threatName } = update;
      currentlyScanningFile.textContent = `Threat Found: ${threatName}`;
      activityLog.prepend(createLogEntry(`THREAT DETECTED: ${threatName} at ${filePath}`, 'error'));
      updateProtectionStatus(false, 'THREAT DETECTED');
      scanProgressBar.classList.add('threat');
      if (settings.autoQuarantine) {
        const newThreat = { id: Date.now(), filePath, threatName, date: new Date().toLocaleDateString() };
        quarantineList.push(newThreat);
        await window.api.setStoreValue('quarantineList', quarantineList);
        renderQuarantineList();
        speak('Threat automatically quarantined.');
      } else { speak('Threat detected. Manual action required.'); }
    } else if (update.type === 'complete') {
      const summaryMessage = update.threatsFound > 0 ? `${update.threatsFound} threat(s) found.` : "Scan Complete. See Windows Security for results.";
      if (update.threatsFound === -1) { currentlyScanningFile.textContent = "Scan cancelled by user."; }
      else { currentlyScanningFile.textContent = summaryMessage; }
      activityLog.prepend(createLogEntry(`Scan completed. ${summaryMessage}`));
      speak('Scan is complete.');
      if (update.threatsFound === 0) { updateProtectionStatus(true, 'PROTECTED'); }
    }
  });

  enableVoiceToggle.addEventListener('change', (e) => { settings.enableVoice = e.target.checked; saveSettings(); speak('Voice assistant ' + (settings.enableVoice ? 'enabled.' : 'disabled.'), true); });
  autoQuarantineToggle.addEventListener('change', (e) => { settings.autoQuarantine = e.target.checked; saveSettings(); });
  if (scanOnStartupToggle) {
    scanOnStartupToggle.addEventListener('change', (e) => { settings.scanOnStartup = e.target.checked; saveSettings(); window.api.setAutoLaunch(e.target.checked); });
  }
  allTabBtns.forEach(btn => { btn.addEventListener('click', () => { allTabs.forEach(tab => tab.classList.remove('active')); allTabBtns.forEach(b => b.classList.remove('active')); document.getElementById(btn.dataset.tab).classList.add('active'); btn.classList.add('active'); }); });
  quickScanBtn.addEventListener('click', () => startScan('Quick'));
  fullScanBtn.addEventListener('click', () => startScan('Full'));
  customScanBtn.addEventListener('click', async () => { const folderPath = await window.api.selectFolder(); if (folderPath) startScan('Custom', folderPath); });
  statusCircle.addEventListener('click', () => { if (scanInProgress) return; isProtected = !isProtected; updateProtectionStatus(isProtected, isProtected ? 'PROTECTED' : 'NOT PROTECTED'); });
  let isFirewallOn = true;
  document.getElementById('firewallToggle').addEventListener('click', () => { isFirewallOn = !isFirewallOn; document.getElementById('firewallStatus').innerText = `Firewall: ${isFirewallOn ? 'ON' : 'OFF'}`; speak(`Firewall has been ${isFirewallOn ? 'enabled.' : 'disabled'}.`); });
  document.getElementById('testVoiceBtn').addEventListener('click', () => speak('Hello Sir. T-Force systems are online and at your command.'));
  document.getElementById('minimizeBtn').addEventListener('click', () => window.api.minimizeWindow());
  document.getElementById('maximizeBtn').addEventListener('click', () => window.api.maximizeWindow());
  document.getElementById('closeBtn').addEventListener('click', () => window.api.closeWindow());
  
  setInterval(updateClock, 1000);
  setInterval(updateSystemStats, 2000);
});