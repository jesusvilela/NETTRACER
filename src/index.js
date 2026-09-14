import { loadConfig, refreshNetworkSurface } from "./config.js";
import { TraceStore } from "./trace-store.js";
import { Broker } from "./broker.js";
import { createServer } from "./server.js";
import { HostTelemetry } from "./telemetry.js";
import { ControlPlane } from "./control-plane.js";
import { AuthManager } from "./auth.js";
import { IngressOrchestrator } from "./ingress-orchestrator.js";
import { AutoCycleManager } from "./auto-cycle.js";
import { S1Archive } from "./s1-archive.js";
import { SlangControlPlane } from "./slang-control-plane.js";
import { EventEmitter } from "node:events";
import { startNnnBridge, stopNnnBridge } from "./nnn-bridge.js";
import { startDiscoveryService } from "./discovery.js";
import { stepAllNodes } from "./nnn-bridge.js";

const config = loadConfig();
startNnnBridge(config);

const traceStore = new TraceStore(config);
startDiscoveryService(config, traceStore);

process.on("exit", () => stopNnnBridge());
process.on("SIGINT", () => { stopNnnBridge(); process.exit(); });
process.on("SIGTERM", () => { stopNnnBridge(); process.exit(); });

// Dynamic IP Polling Loop
setInterval(() => {
  if (refreshNetworkSurface(config)) {
    traceStore.addAudit({
      type: "network-surface-changed",
      timestamp: Date.now(),
      lanIps: config.network.lanIps,
      preferredLanIp: config.network.preferredLanIp
    });
    // Trigger topology event to force UI refresh with updated IPs
    traceStore.events.emit("topology", controlPlane.getTopology());
  }
}, 15000);

// Background Hamiltonian Manifold Annealing
setInterval(async () => {
  try {
    const energy = await telemetry.getSystemEnergy();
    const targetFiber = {
      self_reflection: 0.5,
      identity_fixed_point: 0.5,
      other_recognition: 0.5,
      mutual_resonance: 0.5,
      cosmological_context: 0.5,
      adiabatic_stability: 0.5,
      ergocetic_efficiency: 0.5,
      erdodetic_path_quality: 0.5
    };
    await stepAllNodes(targetFiber, 0.1 * energy, 0.05);
  } catch (e) {
  }
}, 60000);

const telemetry = new HostTelemetry(config);
const controlPlane = new ControlPlane(config, traceStore);
const auth = new AuthManager(config, traceStore);
const broker = new Broker(config, traceStore, telemetry, controlPlane);
console.log("Initializing Ingress Orchestrator...");
const ingress = safeComponent("ingress", () => new IngressOrchestrator({ config, traceStore, broker }), createIngressFallback);
console.log("Initializing AutoCycle Manager...");
const autoCycle = safeComponent("autoCycle", () => new AutoCycleManager({ broker, controlPlane, traceStore }), createAutoCycleFallback);
console.log("Initializing S1 Archive...");
const archive = safeComponent("archive", () => new S1Archive({ config, traceStore, controlPlane }), createArchiveFallback);
console.log("Initializing Slang Control Plane...");
const slangControlPlane = safeComponent("slangControlPlane", () => new SlangControlPlane({ config, traceStore, controlPlane, broker }), createSlangFallback);
try {
  autoCycle.start();
} catch (error) {
  traceStore.addAlert({
    id: `alert_autocycle_start_${Date.now()}`,
    title: "Auto-cycle startup degraded",
    type: "autocycle-start-failed",
    detail: error.message,
    timestamp: Date.now()
  });
}
console.log("Creating Server...");
const server = createServer({ config, traceStore, broker, telemetry, controlPlane, auth, ingress, autoCycle, archive, slangControlPlane });

if (config.demoMode) {
  console.log("🎮 Demo mode active: generating synthetic .s1 packet stream...");
  let packetCount = 0;
  setInterval(() => {
    packetCount++;
    const stages = ["ING", "CHK", "CMT", "RLB"];
    const routes = ["demo-lmstudio", "demo-ollama", "demo-vllm"];
    const route = routes[packetCount % routes.length];
    const stage = stages[packetCount % stages.length];
    broker.emitPacket({
      packetType: packetCount % 3 === 0 ? "proof" : "execution",
      clientId: "demo-client",
      actor: "demo-operator",
      intent: `Demo synthetic traffic stream packet #${packetCount}`,
      route,
      model: `${route}-model`,
      stage: { name: stage, score: 0.95 },
      labels: [`§NODE:${route}`, `§DEMO:#${packetCount}`]
    });
  }, 4000);
}

console.log(`Starting server on ${config.host}:${config.port}...`);
server.listen(config.port, config.host, () => {
  console.log(JSON.stringify({
    app: config.appName,
    host: config.host,
    port: config.port,
    defaultModel: config.defaultModel,
    dashboard: config.network.httpUrls[0] || `http://localhost:${config.port}/`,
    dashboardLocal: `http://localhost:${config.port}/`,
    atlas: `${config.network.httpUrls[0] || `http://localhost:${config.port}/`}api/atlas`,
    slangWs: config.network.wsUrls[0] || `ws://localhost:${config.port}/ws/slang`,
    lanIps: config.network.lanIps,
    operatorUser: config.operatorUser,
    operatorPasskeyFile: `${config.stateDir}\\operator-passkey.txt`,
    upstreamOrder: config.upstreams.map((item) => `${item.id}:${item.priority}`),
    ingress: {
      localEndpoint: config.ingress.localEndpoint,
      notebookEndpoint: config.ingress.notebookEndpoint || null
    }
  }, null, 2));
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(
      JSON.stringify(
        {
          app: config.appName,
          error: "port_in_use",
          host: config.host,
          port: config.port,
          message: `Port ${config.host}:${config.port} is already in use. Stop the other netracer instance or start with PORT=<new-port>.`,
          examples: [
            "Get-NetTCPConnection -LocalAddress 0.0.0.0 -LocalPort 8787 -State Listen | Select-Object OwningProcess",
            "Stop-Process -Id <OwningProcess>",
            "$env:PORT=8788; npm start"
          ]
        },
        null,
        2
      )
    );
    process.exit(1);
    return;
  }
  console.error(error);
  process.exit(1);
});

function safeComponent(name, factory, fallbackFactory) {
  try {
    return factory();
  } catch (error) {
    console.error(JSON.stringify({
      app: config.appName,
      error: "startup_component_degraded",
      component: name,
      message: error.message
    }, null, 2));
    traceStore.addAlert({
      id: `alert_startup_${name}_${Date.now()}`,
      title: "Startup component degraded",
      type: "startup-component-degraded",
      component: name,
      detail: error.message,
      timestamp: Date.now()
    });
    return fallbackFactory(error);
  }
}

function createIngressFallback(error) {
  const events = new EventEmitter();
  const state = {
    status: "degraded",
    queueDepth: 0,
    lastError: error.message,
    localEndpoint: config.ingress?.localEndpoint || "",
    activeEndpoint: null,
    fallbackEndpoint: config.ingress?.notebookEndpoint || "",
    backend: "webgpu",
    validateLogic: false,
    reconnectAttempt: 0,
    lastHeartbeatAt: null,
    lastJob: null,
    notebookUrl: ""
  };
  return {
    events,
    getState() {
      return structuredClone(state);
    },
    async startSession() {
      throw new Error("ingress_unavailable");
    },
    stopSession() {
      return this.getState();
    },
    async enqueueScan() {
      throw new Error("ingress_unavailable");
    }
  };
}

function createAutoCycleFallback(error) {
  const state = {
    running: false,
    lastRunAt: 0,
    lastDurationMs: 0,
    lastError: error.message,
    lastReason: "startup-fallback",
    lastActions: [],
    totalRuns: 0,
    totalActions: 0,
    policy: controlPlane.getAutoCyclePolicy ? controlPlane.getAutoCyclePolicy() : controlPlane.getPolicies().autoCycle,
    intervalMs: 0,
    nextRunAt: 0
  };
  return {
    start() {},
    stop() {},
    refreshFromPolicy() {
      return this.getState();
    },
    getState() {
      return structuredClone(state);
    },
    async runOnce() {
      throw new Error("autocycle_unavailable");
    }
  };
}

function createArchiveFallback(error) {
  return {
    getStatus() {
      return {
        dbPath: pathJoin(config.stateDir, "s1-archive.sqlite"),
        policy: controlPlane.getPolicies().archive,
        packetCount: 0,
        rawBytes: 0,
        compressedBytes: 0,
        compressionRatio: 1,
        latestTs: 0,
        oldestTs: 0,
        lastIngestAt: 0,
        ingestedPackets: 0,
        lastError: error.message,
        degraded: true
      };
    },
    compactFromTrace(limit = 0) {
      return { requested: Number(limit) || 0, inserted: 0, skipped: Number(limit) || 0, degraded: true };
    },
    prune(keepLatest = 0) {
      return { keepLatest: Number(keepLatest) || 0, deleted: 0, degraded: true };
    },
    getRecent() {
      return [];
    },
    getPacket() {
      return null;
    }
  };
}

function createSlangFallback(error) {
  const baseStatus = {
    activePack: null,
    network: config.network,
    installedPacks: [],
    relayCount: 0,
    nodeInboxCounts: {},
    nodeBindings: {},
    topologyNodeCount: 0,
    topology: {
      generatedAt: new Date().toISOString(),
      activePack: null,
      nodes: [],
      edges: [],
      metrics: {
        totalNodes: 0,
        boundNodes: 0,
        unboundNodes: 0,
        inboxNodes: 0,
        edgeCount: 0,
        coverageRatio: 0,
        kindCounts: {},
        orphanedBindings: [],
        orphanedInboxNodes: []
      }
    },
    lastCarrierInspection: null,
    sourceCandidates: [],
    degraded: true,
    lastError: error.message
  };
  return {
    syncTopology() {
      return { changed: false, messages: [], removedBindings: [], bindings: {} };
    },
    getTopologySnapshot() {
      return structuredClone(baseStatus.topology);
    },
    getStatus() {
      return structuredClone(baseStatus);
    },
    getCognitiveSnapshot() {
      return {
        generatedAt: new Date().toISOString(),
        version: "cognitive-reflection.v1",
        claim: "degraded_fallback",
        score: 0,
        floorScore: 0,
        activeCount: 0,
        totalCount: 0,
        qualities: [],
        evidence: {},
        matrix: [],
        n: {},
        recommendation: "slang_control_plane_unavailable"
      };
    },
    getCognitiveMemory() {
      return [];
    },
    getLearners() {
      return { substrate: null, learners: [], metaLearningEvents: [] };
    },
    bootstrapCoreLearners() {
      throw new Error("slang_control_plane_unavailable");
    },
    runMetaLearningCycle() {
      throw new Error("slang_control_plane_unavailable");
    },
    getReservoirComputingScheme() {
      return {
        generatedAt: new Date().toISOString(),
        version: "reservoir-computing.v1",
        roles: { inputs: [], memory: "memory:slang-recurrent", reservoir: [], substrate: null, readout: "netracer" },
        stateVector: { nodes: [], values: [], dimension: 0 },
        transitions: [],
        metrics: { learnerCount: 0, memoryDepth: 0, reservoirNodeCount: 0, transitionCount: 0, spectralRadius: 0, leakRate: 0, echoStateScore: 0 },
        update: "§RESERVOIR{degraded=true}"
      };
    },
    getActivePack() {
      return null;
    },
    listPacks() {
      return [];
    },
    buildGraphMap({ nodeId = "" } = {}) {
      return { selectedNodeId: nodeId || "", sections: [], strands: [], metrics: { connectedBundleCount: 0 } };
    },
    getNodeMessages() {
      return [];
    },
    applyPackUpgrade() {
      throw new Error("slang_control_plane_unavailable");
    },
    inspectMultimodal() {
      throw new Error("slang_control_plane_unavailable");
    },
    sendMultimodal() {
      throw new Error("slang_control_plane_unavailable");
    },
    receiveFromNode() {
      throw new Error("slang_control_plane_unavailable");
    }
  };
}

function pathJoin(...parts) {
  return parts.join("\\");
}
