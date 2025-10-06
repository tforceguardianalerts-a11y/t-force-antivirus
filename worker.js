const { parentPort } = require('worker_threads');
const os = require('os');

const getCpuTicks = () => os.cpus().map(cpu => cpu.times);
let startTicks = getCpuTicks();

function getCpuLoad() {
  const endTicks = getCpuTicks();
  const totalIdle = endTicks.reduce((acc, tick, i) => acc + (tick.idle - startTicks[i].idle), 0);
  const totalTick = endTicks.reduce((acc, tick, i) => {
    const start = startTicks[i];
    return acc + (tick.user - start.user) + (tick.nice - start.nice) + (tick.sys - start.sys) + (tick.irq - start.irq) + (tick.idle - start.idle);
  }, 0);
  startTicks = endTicks;
  if (totalTick === 0) return 0;
  const percentage = 100 * (1 - totalIdle / totalTick);
  return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(2))));
}

parentPort.on('message', (msg) => {
  if (msg === 'get-stats') {
    try {
      const ramUsage = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
      const stats = {
        osInfo: `${os.release()} (${os.platform()})`,
        cpuLoad: getCpuLoad(),
        ramUsage: parseFloat(ramUsage.toFixed(2)),
        homeDir: os.homedir()
      };
      parentPort.postMessage({ success: true, data: stats });
    } catch (e) {
      parentPort.postMessage({ success: false, error: e.message });
    }
  }
});