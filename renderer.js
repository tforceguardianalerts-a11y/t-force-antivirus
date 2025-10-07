window.addEventListener("DOMContentLoaded", async () => {
  const allTabs = document.querySelectorAll(".tab-btn");
  const allTabContents = document.querySelectorAll(".tab-content");
  const statusShield = document.getElementById("statusShield");
  const statusText = document.getElementById("statusText");
  const quickScanBtn = document.getElementById("quickScanBtn");
  const fullScanBtn = document.getElementById("fullScanBtn");
  const customScanBtn = document.getElementById("customScanBtn");
  const scanButtons = [quickScanBtn, fullScanBtn, customScanBtn];
  const scanProgressBar = document.getElementById("scanProgressBar");
  const currentlyScanningFile = document.getElementById("currentlyScanningFile");
  const activityLog = document.getElementById("activityLog");
  const firewallBtn = document.getElementById("firewallToggle");
  const firewallStatus = document.getElementById("firewallStatus");
  const threatList = document.getElementById("threatList");
  const cpuLoadEl = document.getElementById("cpuLoad");
  const ramUsageEl = document.getElementById("ramUsage");
  const assistantLog = document.getElementById("assistantLog");
  const testVoiceBtn = document.getElementById("testVoiceBtn");
  const enableVoice = document.getElementById("enableVoice");
  const autoQuarantine = document.getElementById("autoQuarantine");
  const minimizeBtn = document.getElementById("minimizeBtn");
  const maximizeBtn = document.getElementById("maximizeBtn");
  const closeBtn = document.getElementById("closeBtn");
  const cpuChartCanvas = document.getElementById('cpuChart');
  const ramChartCanvas = document.getElementById('ramChart');
  const scanFrequency = document.getElementById('scanFrequency');
  const dayOfWeekGroup = document.getElementById('dayOfWeekGroup');
  const scanDay = document.getElementById('scanDay');
  const scanTime = document.getElementById('scanTime');
  const scanTypeSelect = document.getElementById('scanType');
  const saveScheduleBtn = document.getElementById('saveScheduleBtn');
  const deleteScheduleBtn = document.getElementById('deleteScheduleBtn');

  let scanInProgress = false;
  let settings = {};

  function speak(msg) {
    if (!settings.enableVoice) return;
    if (speechSynthesis.speaking) return;
    const p = document.createElement("p"); p.textContent = `> ${msg}`;
    assistantLog.prepend(p);
    speechSynthesis.speak(new SpeechSynthesisUtterance(msg));
  }

  function updateProtectionStatus(isProtected, message) {
    statusShield.className = isProtected ? "" : "not-protected";
    statusText.textContent = message;
  }

  function createVitalChart(canvas) {
    return new Chart(canvas.getContext('2d'), {
      type: 'doughnut', data: { datasets: [{ data: [0, 100], backgroundColor: ['#ff0000', '#333'], borderColor: '#111', borderWidth: 1, cutout: '80%' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 400 } }
    });
  }
  const cpuChart = createVitalChart(cpuChartCanvas);
  const ramChart = createVitalChart(ramChartCanvas);

  async function updateSystemStats() {
    const stats = await window.api.getSystemStats();
    if (stats && !stats.error) {
      cpuLoadEl.textContent = `${stats.cpuLoad.toFixed(0)}%`;
      ramUsageEl.textContent = `${stats.ramUsage.toFixed(0)}%`;
      cpuChart.data.datasets[0].data = [stats.cpuLoad, 100 - stats.cpuLoad];
      cpuChart.update();
      ramChart.data.datasets[0].data = [stats.ramUsage, 100 - stats.ramUsage];
      ramChart.update();
    } else {
      cpuLoadEl.textContent = 'N/A';
      ramUsageEl.textContent = 'N/A';
    }
  }

  function startScan(scanType, path) {
    if (scanInProgress) return;
    scanInProgress = true;
    scanButtons.forEach(b => b.disabled = true);
    scanProgressBar.value = 0;
    statusShield.className = "scanning";
    statusText.textContent = "SCANNING";
    currentlyScanningFile.textContent = `Initializing ${scanType} scan...`;
    speak(`${scanType} scan started.`);
    window.api.startScan(scanType, path);
  }
  
  (async () => {
    settings = (await window.api.getStoreValue("settings")) || { enableVoice: true, autoQuarantine: true };
    enableVoice.checked = settings.enableVoice;
    autoQuarantine.checked = settings.autoQuarantine;
    firewallStatus.textContent = await window.api.getFirewallStatus();
    updateSystemStats();
    
    for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0');
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${hour}:00`;
        scanTime.appendChild(option);
    }
    const schedule = (await window.api.getStoreValue('scanSchedule')) || {};
    scanFrequency.value = schedule.frequency || 'disabled';
    scanDay.value = schedule.day || 'MON';
    scanTime.value = schedule.time || '2';
    scanTypeSelect.value = schedule.type || 'Quick';
    scanFrequency.dispatchEvent(new Event('change'));
  })();

  allTabs.forEach(button => {
    button.addEventListener("click", () => {
      allTabs.forEach(b => b.classList.remove("active"));
      allTabContents.forEach(tc => tc.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });

  quickScanBtn.addEventListener("click", () => startScan("Quick"));
  fullScanBtn.addEventListener("click", () => startScan("Full"));
  customScanBtn.addEventListener("click", async () => {
    const folderPath = await window.api.selectFolder();
    if (folderPath) {
        startScan("Custom", folderPath);
    }
  });

  window.api.onScanUpdate((data) => {
    scanInProgress = false;
    scanButtons.forEach(b => b.disabled = false);
    scanProgressBar.value = 100;
    const isClean = data.threatsFound === 0;
    updateProtectionStatus(isClean, isClean ? "PROTECTED" : "THREAT DETECTED");
    if (data.type === "threat") {
      currentlyScanningFile.textContent = `Threat Found: ${data.threatName}`;
      speak(`Threat detected: ${data.threatName}`);
      if (settings.autoQuarantine) {
        window.api.addToQuarantine(data);
        speak("Threat auto-quarantined.");
      }
    } else if (data.type === "complete") {
      currentlyScanningFile.textContent = isClean ? "Scan complete. No threats found." : `${data.threatsFound} threat(s) found.`;
      speak("Scan complete.");
    }
  });

  statusShield.addEventListener("click", () => {
    if(scanInProgress) return;
    const isProtected = !statusShield.classList.contains("not-protected");
    updateProtectionStatus(!isProtected, isProtected ? "NOT PROTECTED" : "PROTECTED");
    speak(isProtected ? "Warning! System manually marked as not protected." : "System protection restored.");
  });

  firewallBtn.addEventListener("click", async () => {
    speak("Requesting permission to modify firewall...");
    const status = await window.api.toggleFirewall();
    firewallStatus.textContent = status;
    speak(`Firewall status is now ${status}`);
  });
  
  testVoiceBtn.addEventListener("click", () => speak("Hello, I am your AI assistant."));
  
  enableVoice.addEventListener("change", () => {
    settings.enableVoice = enableVoice.checked;
    window.api.setStoreValue("enableVoice", settings.enableVoice);
  });
  autoQuarantine.addEventListener("change", () => {
    settings.autoQuarantine = autoQuarantine.checked;
    window.api.setStoreValue("autoQuarantine", settings.autoQuarantine);
  });
  
  minimizeBtn.addEventListener("click", () => window.api.minimizeWindow());
  maximizeBtn.addEventListener("click", () => window.api.maximizeWindow());
  closeBtn.addEventListener("click", () => window.api.closeWindow());

  scanFrequency.addEventListener('change', () => {
    dayOfWeekGroup.style.display = scanFrequency.value === 'WEEKLY' ? 'block' : 'none';
  });

  saveScheduleBtn.addEventListener('click', () => {
    const schedule = {
        frequency: scanFrequency.value,
        day: scanDay.value,
        time: scanTime.value,
        type: scanTypeSelect.value
    };
    if (schedule.frequency !== 'disabled') {
        window.api.setSchedule(schedule);
        speak('Scan schedule saved.');
    } else {
        window.api.deleteSchedule();
        speak('Scan schedule deleted.');
    }
    document.querySelector(`.tab-btn[data-tab='dashboard']`).click();
  });
  
  deleteScheduleBtn.addEventListener('click', () => {
    window.api.deleteSchedule();
    speak('Scan schedule deleted.');
    scanFrequency.value = 'disabled';
    scanFrequency.dispatchEvent(new Event('change'));
    document.querySelector(`.tab-btn[data-tab='dashboard']`).click();
  });

  setInterval(updateSystemStats, 2000);
});