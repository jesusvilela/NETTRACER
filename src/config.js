import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import { writeTextFileSafely } from "./persistence.js";

function toInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function loadConfig() {
  const rootDir = process.cwd();
  const dataDir = ensureDir(path.resolve(rootDir, process.env.DATA_DIR || "data"));
  const traceDir = ensureDir(path.join(dataDir, "traces"));
  const outboxDir = ensureDir(path.join(dataDir, "outbox"));
  const packetDir = ensureDir(path.join(dataDir, "packets"));
  const stateDir = ensureDir(path.join(dataDir, "state"));
  const operatorPasskey = loadOrCreatePasskey(stateDir, process.env.OPERATOR_PASSKEY);
  const signingKey = process.env.S1_SIGNING_KEY || crypto.createHash("sha256").update(`${operatorPasskey}:netracer`).digest("hex");

  const isDemoMode = process.argv.includes("--demo") || process.env.DEMO_MODE === "true";

  const config = {
    appName: process.env.APP_NAME || "netracer",
    demoMode: isDemoMode,
    // Bind to loopback by default; a network-facing bind is an explicit opt-in
    // via HOST so a fresh checkout never exposes the operator login over plain
    // HTTP on the LAN or internet without the operator deciding to do so.
    host: process.env.HOST || "127.0.0.1",
    port: toInt(process.env.PORT, 8787),
    dataDir,
    traceDir,
    outboxDir,
    packetDir,
    stateDir,
    trafficLimit: toInt(process.env.TRAFFIC_LIMIT, 100),
    traceLimit: toInt(process.env.TRACE_LIMIT, 500),
    packetLimit: toInt(process.env.PACKET_LIMIT, 2000),
    alertLimit: toInt(process.env.ALERT_LIMIT, 200),
    auditLimit: toInt(process.env.AUDIT_LIMIT, 500),
    debugRequests: process.env.DEBUG_REQUESTS === "true" || true,
    probeTtlMs: toInt(process.env.PROBE_TTL_MS, 4000),
    statusSummaryTtlMs: toInt(process.env.STATUS_SUMMARY_TTL_MS, 10000),
    modelListTtlMs: toInt(process.env.MODEL_LIST_TTL_MS, 30000),
    clientPresenceTtlMs: toInt(process.env.CLIENT_PRESENCE_TTL_MS, 3 * 60 * 1000),
    upstreamProbeTimeoutMs: toInt(process.env.UPSTREAM_PROBE_TIMEOUT_MS, 1200),
    upstreamModelTimeoutMs: toInt(process.env.UPSTREAM_MODEL_TIMEOUT_MS, 1500),
    upstreamCompletionTimeoutMs: toInt(process.env.UPSTREAM_COMPLETION_TIMEOUT_MS, 120000),
    commandEngineTimeoutMs: toInt(process.env.COMMAND_ENGINE_TIMEOUT_MS, 120000),
    sessionTtlMs: toInt(process.env.SESSION_TTL_MS, 8 * 60 * 60 * 1000),
    defaultModel: process.env.DEFAULT_MODEL || "substrate-broker-local",
    androidClientId: process.env.ANDROID_CLIENT_ID || "topostrasgo-android",
    operatorUser: process.env.OPERATOR_USER || "operator",
    operatorPasskey,
    signingKey,
    upstreams: readUpstreams(),
    commandEngines: readCommandEngines(),
    hostHints: {
      gpuClass: process.env.GPU_CLASS || "rtx3060ti-8g",
      vramMb: toInt(process.env.GPU_VRAM_MB, 8192),
      systemRamMb: toInt(process.env.SYSTEM_RAM_MB, 32600)
    },
    ingress: {
      localEndpoint: process.env.INGRESS_LOCAL_ENDPOINT || "ws://127.0.0.1:8765",
      notebookEndpoint: process.env.INGRESS_NOTEBOOK_ENDPOINT || "",
      heartbeatMs: toInt(process.env.INGRESS_HEARTBEAT_MS, 5000),
      reconnectBaseMs: toInt(process.env.INGRESS_RECONNECT_BASE_MS, 1000),
      maxReconnectMs: toInt(process.env.INGRESS_MAX_RECONNECT_MS, 30000),
      connectTimeoutMs: toInt(process.env.INGRESS_CONNECT_TIMEOUT_MS, 2500),
      maxScanFiles: toInt(process.env.INGRESS_MAX_SCAN_FILES, 300),
      maxScanFileBytes: toInt(process.env.INGRESS_MAX_SCAN_FILE_BYTES, 2 * 1024 * 1024)
    },
    nnn: {
      enabled: process.env.NNN_BRIDGE_ENABLED !== "0",
      sidecarMode: process.env.NNN_SIDECAR_MODE || "auto",
      apiUrl: process.env.NNN_API_URL || "http://127.0.0.1:3030",
      port: toInt(process.env.NNN_API_PORT, 3030),
      root: process.env.NNN_RAMDISK_ROOT || "",
      candidateRoots: readPathList(process.env.NNN_RAMDISK_ROOTS || "")
    },
    integrationRoots: {
      utai: process.env.UTAI_ROOT || "",
      igbundle: process.env.IGBUNDLE_ROOT || "",
      topostrasgo: process.env.TOPOSTRASGO_ROOT || ""
    }
  };

  config.network = buildNetworkSurface(config);
  return config;
}

export function refreshNetworkSurface(config) {
  const nextNetwork = buildNetworkSurface(config);
  const changed = JSON.stringify(nextNetwork.lanIps) !== JSON.stringify(config.network.lanIps) ||
                  nextNetwork.preferredLanIp !== config.network.preferredLanIp;
  config.network = nextNetwork;
  return changed;
}

function loadOrCreatePasskey(stateDir, envPasskey) {
  if (envPasskey) {
    return envPasskey;
  }
  const filePath = path.join(stateDir, "operator-passkey.txt");
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8").trim();
  }
  const generated = crypto.randomBytes(18).toString("base64url");
  writeTextFileSafely(filePath, generated);
  return generated;
}

function readUpstreams() {
  try {
    const raw = process.env.UPSTREAMS_JSON;
    const upstreams = raw ? JSON.parse(raw) : defaultUpstreams();
    return Array.isArray(upstreams) ? upstreams.map(normalizeUpstream).sort((a, b) => b.priority - a.priority) : [];
  } catch {
    return defaultUpstreams().map(normalizeUpstream).sort((a, b) => b.priority - a.priority);
  }
}

function defaultUpstreams() {
  return [
    { id: "lmstudio", baseUrl: "http://127.0.0.1:1234", model: process.env.LMSTUDIO_MODEL || "", priority: 100, healthPath: "/v1/models", kind: "openai" },
    { id: "ollama", baseUrl: "http://127.0.0.1:11434", model: process.env.OLLAMA_MODEL || "", priority: 80, healthPath: "/api/tags", kind: "ollama" },
    { id: "vllm", baseUrl: "http://127.0.0.1:8000", model: process.env.VLLM_MODEL || "", priority: 70, healthPath: "/v1/models", kind: "openai" },
    { id: "llamacpp", baseUrl: "http://127.0.0.1:8080", model: process.env.LLAMACPP_MODEL || "", priority: 60, healthPath: "/v1/models", kind: "openai" }
  ];
}

function normalizeUpstream(entry) {
  return {
    id: entry.id,
    baseUrl: entry.baseUrl,
    model: entry.model || "",
    priority: toInt(entry.priority, 50),
    healthPath: entry.healthPath || "/v1/models",
    kind: entry.kind || "openai",
    tags: Array.isArray(entry.tags) ? entry.tags : []
  };
}

function readCommandEngines() {
  try {
    const raw = process.env.COMMAND_ENGINES_JSON;
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readPathList(value) {
  return String(value || "")
    .split(/[;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildNetworkSurface({ host, port }) {
  const hostname = os.hostname();
  const lanIps = detectLanIps();
  const preferredLanIp = lanIps[0] || "127.0.0.1";
  const publicHost = host === "0.0.0.0" ? preferredLanIp : host;
  const httpUrls = [];
  const wsUrls = [];

  for (const candidate of uniqueHosts([publicHost, "localhost", ...lanIps, hostname])) {
    httpUrls.push(`http://${candidate}:${port}/`);
    wsUrls.push(`ws://${candidate}:${port}/ws/slang`);
  }

  return {
    hostname,
    lanIps,
    preferredLanIp,
    publicHost,
    httpUrls,
    wsUrls
  };
}

function detectLanIps() {
  const candidates = [];
  const interfaces = os.networkInterfaces();
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses || []) {
      if (!address || address.family !== "IPv4" || address.internal) continue;
      if (!isLanAddress(address.address)) continue;
      candidates.push({
        address: address.address,
        score: interfaceScore(name)
      });
    }
  }
  return [...new Set(candidates.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address)).map((item) => item.address))];
}

function isLanAddress(value) {
  return /^10\./.test(value)
    || /^192\.168\./.test(value)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(value);
}

function uniqueHosts(values) {
  return [...new Set(values.filter(Boolean))];
}

function interfaceScore(name) {
  const value = String(name || "").toLowerCase();
  let score = 0;
  if (/wi-?fi|wireless|wlan/.test(value)) score += 30;
  if (/ethernet|^eth|^en|lan/.test(value)) score += 24;
  if (/tailscale|zerotier|vpn/.test(value)) score -= 10;
  if (/virtualbox|host-only|vethernet|wsl|hyper-v|docker|vmware/.test(value)) score -= 40;
  return score;
}
