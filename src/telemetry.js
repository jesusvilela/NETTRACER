import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class HostTelemetry {
  constructor(config) {
    this.config = config;
    this.lastSample = null;
    this.lastSampleAt = 0;
    this.cacheMs = 3000;
  }

  async sample() {
    const now = Date.now();
    if (this.lastSample && now - this.lastSampleAt < this.cacheMs) {
      return this.lastSample;
    }

    const cpus = os.cpus();
    const sample = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpu: {
        model: cpus[0]?.model || "unknown",
        logicalCores: cpus.length
      },
      memory: {
        totalMb: Math.round(os.totalmem() / 1024 / 1024),
        freeMb: Math.round(os.freemem() / 1024 / 1024),
        usedMb: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)
      },
      gpu: await readGpuTelemetry(this.config.hostHints)
    };

    this.lastSample = sample;
    this.lastSampleAt = now;
    return sample;
  }

  async getSystemEnergy() {
    const sample = await this.sample();
    const cpuLoad = sample.cpu.logicalCores > 0 ? (sample.memory.usedMb / sample.memory.totalMb) : 0.5;
    const gpuLoad = (sample.gpu.utilizationPct || 0) / 100;
    // Composite energy scalar: higher load = higher energy (H)
    return (cpuLoad * 0.4 + gpuLoad * 0.6);
  }
}

async function readGpuTelemetry(hostHints) {
  try {
    const { stdout } = await execFileAsync("nvidia-smi", [
      "--query-gpu=name,memory.total,memory.free,utilization.gpu",
      "--format=csv,noheader,nounits"
    ], { timeout: 2000 });
    const line = stdout.trim().split(/\r?\n/)[0] || "";
    const [name, total, free, util] = line.split(",").map((item) => item.trim());
    return {
      vendor: "nvidia",
      name,
      totalMb: Number.parseInt(total, 10) || hostHints.vramMb,
      freeMb: Number.parseInt(free, 10) || 0,
      utilizationPct: Number.parseInt(util, 10) || 0
    };
  } catch {
    return {
      vendor: "unknown",
      name: hostHints.gpuClass,
      totalMb: hostHints.vramMb,
      freeMb: 0,
      utilizationPct: 0
    };
  }
}
