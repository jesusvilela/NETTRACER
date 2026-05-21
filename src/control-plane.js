import fs from "node:fs";
import path from "node:path";
import { readJsonWithRecovery, writeJsonFileSafely } from "./persistence.js";

const DEFAULT_POLICIES = {
  routePin: null,
  redactionLevel: "sanitized",
  admission: {
    maxPromptTokens: 12288,
    requireHealthyRuntime: true,
    allowLocalFallback: true
  },
  runtimeStates: {},
  proxy: {
    mode: "orchestrated",
    runtimeId: null,
    modelLimit: 64,
    modelDiscovery: "cached",
    exposeIdMode: "prefixed"
  },
  sdr: {
    enabled: true,
    defaultChannel: null,
    channels: {},
    sectionOps: {
      enabled: true,
      allowPromptDirective: true
    }
  },
  autoCycle: {
    enabled: true,
    intervalMs: 15000,
    failoverChannels: true,
    failbackPreferred: true,
    forceModelRefresh: true
  },
  archive: {
    enabled: true,
    autoIngest: true,
    compression: "gzip",
    compressionLevel: 9
  }
};

export class ControlPlane {
  constructor(config, traceStore) {
    this.config = config;
    this.traceStore = traceStore;
    this.filePath = path.join(config.stateDir, "control-plane.json");
    this.state = this.loadState();
  }

  loadState() {
    if (fs.existsSync(this.filePath) || fs.existsSync(`${this.filePath}.bak`)) {
      const { data, source } = readJsonWithRecovery(this.filePath);
      if (data) {
        const parsed = {
          ...data,
          policies: normalizePolicies(data.policies),
          topology: normalizeTopology(data.topology),
          lastUpdated: data.lastUpdated || new Date().toISOString()
        };
        if (source !== "primary") {
          this.persist(parsed);
        }
        return parsed;
      }
    }
    const state = {
      policies: structuredClone(DEFAULT_POLICIES),
      topology: normalizeTopology(),
      lastUpdated: new Date().toISOString()
    };
    this.persist(state);
    return state;
  }

  persist(nextState = this.state) {
    nextState.lastUpdated = new Date().toISOString();
    writeJsonFileSafely(this.filePath, nextState);
    this.state = nextState;
  }

  getPolicies() {
    return structuredClone(this.state.policies);
  }

  updatePolicy(partial, actor = "operator") {
    this.state.policies = {
      ...this.state.policies,
      ...partial,
      admission: {
        ...this.state.policies.admission,
        ...(partial.admission || {})
      },
      runtimeStates: {
        ...this.state.policies.runtimeStates,
        ...(partial.runtimeStates || {})
      },
      proxy: {
        ...this.state.policies.proxy,
        ...(partial.proxy || {})
      },
      sdr: {
        ...this.state.policies.sdr,
        ...(partial.sdr || {}),
        channels: {
          ...(this.state.policies.sdr?.channels || {}),
          ...(partial.sdr?.channels || {})
        },
        sectionOps: {
          ...(this.state.policies.sdr?.sectionOps || {}),
          ...(partial.sdr?.sectionOps || {})
        }
      },
      autoCycle: {
        ...this.state.policies.autoCycle,
        ...(partial.autoCycle || {})
      },
      archive: {
        ...this.state.policies.archive,
        ...(partial.archive || {})
      }
    };
    this.state.policies = normalizePolicies(this.state.policies);
    this.persist();
    const event = { type: "policy", actor, policy: this.getPolicies(), timestamp: Date.now() };
    this.traceStore.addAudit(event);
    this.traceStore.events.emit("policy", event);
    return this.getPolicies();
  }

  setRoutePin(runtimeId, actor = "operator") {
    return this.updatePolicy({ routePin: runtimeId }, actor);
  }

  clearRoutePin(actor = "operator") {
    return this.updatePolicy({ routePin: null }, actor);
  }

  setRuntimeEnabled(runtimeId, enabled, actor = "operator") {
    return this.updatePolicy({ runtimeStates: { [runtimeId]: { enabled } } }, actor);
  }

  isRuntimeEnabled(runtimeId) {
    const rule = this.state.policies.runtimeStates[runtimeId];
    return rule?.enabled !== false;
  }

  applyRoutePolicy(plan) {
    const policies = this.getPolicies();
    const pinned = policies.routePin;
    const filtered = plan.filter((item) => item.type === "command" || this.isRuntimeEnabled(item.id));
    if (pinned) {
      const pinnedItem = filtered.find((item) => item.id === pinned);
      if (pinnedItem) {
        return [pinnedItem, ...filtered.filter((item) => item.id !== pinned)];
      }
    }
    return filtered;
  }

  updateTopology({ upstreams = [], models = [], clients = [] }) {
    const nextTopology = normalizeTopology({
      nodes: [
        { id: "netracer", kind: "broker", label: this.config.appName },
        ...upstreams.map((item) => ({ id: item.id, kind: "runtime", label: item.id, healthy: item.healthy, priority: item.priority })),
        ...models.filter((item) => !item.broker_default).map((item) => ({ id: `model:${item.provider}:${item.id}`, kind: "model", label: item.id, provider: item.provider })),
        ...clients.map((item) => ({
          id: item.id,
          kind: "client",
          label: item.label || item.id,
          healthy: item.healthy,
          transport: item.transport || null,
          remoteAddress: item.remoteAddress || null,
          userAgent: item.userAgent || null,
          sessionUser: item.sessionUser || null,
          lastSeenAt: item.lastSeenAt || null,
          subscriptions: Array.isArray(item.subscriptions) ? item.subscriptions : [],
          paths: Array.isArray(item.paths) ? item.paths : [],
          methods: Array.isArray(item.methods) ? item.methods : []
        }))
      ],
      edges: [
        ...upstreams.map((item) => ({ from: "netracer", to: item.id, kind: "route", healthy: item.healthy, priority: item.priority })),
        ...models.filter((item) => !item.broker_default).map((item) => ({ from: item.provider, to: `model:${item.provider}:${item.id}`, kind: "hosts" })),
        ...clients.map((item) => ({
          from: "netracer",
          to: item.id,
          kind: "bind",
          healthy: item.healthy,
          transport: item.transport || null
        }))
      ]
    });
    const changed = JSON.stringify(this.state.topology) !== JSON.stringify(nextTopology);
    this.state.topology = nextTopology;
    if (changed) {
      this.persist();
      this.traceStore.events.emit("topology", this.state.topology);
    }
    return this.state.topology;
  }

  getTopology() {
    return structuredClone(this.state.topology);
  }

  listChannels() {
    return structuredClone(this.state.policies.sdr?.channels || {});
  }

  getAutoCyclePolicy() {
    return structuredClone(this.state.policies.autoCycle || DEFAULT_POLICIES.autoCycle);
  }

  upsertChannel({ name, runtimeId, model = "", op = "semantic", enabled = true, preferredRuntimeId = "" }, actor = "operator") {
    const channel = normalizeChannelName(name);
    if (!channel) throw new Error("invalid_channel_name");
    if (!runtimeId) throw new Error("channel_runtime_required");

    const current = { ...(this.state.policies.sdr?.channels || {}) };
    const existing = current[channel] || {};
    const normalizedPreferred = preferredRuntimeId ? String(preferredRuntimeId) : String(existing.preferredRuntimeId || runtimeId);
    const next = {
      ...current,
      [channel]: {
        runtimeId: String(runtimeId),
        model: String(model || ""),
        op: normalizeOp(op),
        enabled: enabled !== false,
        preferredRuntimeId: normalizedPreferred,
        failoverCount: Number(existing.failoverCount || 0),
        lastFailoverAt: Number(existing.lastFailoverAt || 0),
        updatedAt: Date.now()
      }
    };
    this.state.policies.sdr = {
      ...this.state.policies.sdr,
      channels: normalizeChannels(next)
    };
    this.state.policies = normalizePolicies(this.state.policies);
    this.persist();
    const event = { type: "policy", actor, policy: this.getPolicies(), timestamp: Date.now() };
    this.traceStore.addAudit(event);
    this.traceStore.events.emit("policy", event);
    return this.getPolicies();
  }

  deleteChannel(name, actor = "operator") {
    const channel = normalizeChannelName(name);
    if (!channel) throw new Error("invalid_channel_name");
    const current = { ...(this.state.policies.sdr?.channels || {}) };
    delete current[channel];
    this.state.policies.sdr = {
      ...this.state.policies.sdr,
      channels: normalizeChannels(current)
    };
    this.state.policies = normalizePolicies(this.state.policies);
    this.persist();
    const event = { type: "policy", actor, policy: this.getPolicies(), timestamp: Date.now() };
    this.traceStore.addAudit(event);
    this.traceStore.events.emit("policy", event);
    return this.getPolicies();
  }

  applyAutoCycleRuntime({ upstreams = [], models = [] }, actor = "autocycle") {
    const policy = this.getAutoCyclePolicy();
    const channels = this.listChannels();
    if (!policy.enabled || (!policy.failoverChannels && !policy.failbackPreferred)) {
      return { changed: false, actions: [], channels, policy };
    }

    const runtimeHealth = new Map(
      (upstreams || [])
        .filter((item) => item?.id)
        .map((item) => [String(item.id), item.healthy === true && item.enabled !== false])
    );
    const healthyByPriority = (upstreams || [])
      .filter((item) => item?.id && item.healthy === true && item.enabled !== false)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const runtimeModelIndex = indexRuntimeModels(models);

    const nextChannels = {};
    const actions = [];
    let changed = false;
    const now = Date.now();

    for (const [name, channel] of Object.entries(channels)) {
      const current = {
        ...channel,
        runtimeId: String(channel.runtimeId || ""),
        model: String(channel.model || ""),
        op: normalizeOp(channel.op),
        enabled: channel.enabled !== false,
        preferredRuntimeId: String(channel.preferredRuntimeId || channel.runtimeId || "")
      };

      const currentHealthy = runtimeHealth.get(current.runtimeId) === true;
      const preferredHealthy = runtimeHealth.get(current.preferredRuntimeId) === true;
      let targetRuntime = current.runtimeId;
      let targetModel = current.model;
      let reason = "";

      if (policy.failoverChannels && !currentHealthy && healthyByPriority.length > 0) {
        const best = String(healthyByPriority[0].id);
        if (best && best !== current.runtimeId) {
          targetRuntime = best;
          reason = "failover";
        }
      } else if (policy.failbackPreferred && current.preferredRuntimeId && current.runtimeId !== current.preferredRuntimeId && preferredHealthy) {
        targetRuntime = current.preferredRuntimeId;
        reason = "failback";
      }

      if (targetModel && targetRuntime !== current.runtimeId && !runtimeSupportsModel(runtimeModelIndex, targetRuntime, targetModel)) {
        targetModel = "";
      }

      if (targetRuntime !== current.runtimeId || targetModel !== current.model) {
        changed = true;
        const next = {
          ...current,
          runtimeId: targetRuntime,
          model: targetModel,
          lastAutoCycleAction: reason || "reroute",
          lastAutoCycleAt: now,
          updatedAt: now
        };
        if (reason === "failover") {
          next.failoverCount = Number(current.failoverCount || 0) + 1;
          next.lastFailoverAt = now;
        }
        nextChannels[name] = next;
        actions.push({
          channel: name,
          reason: reason || "reroute",
          fromRuntimeId: current.runtimeId,
          toRuntimeId: targetRuntime,
          modelReset: current.model !== targetModel
        });
      } else {
        nextChannels[name] = current;
      }
    }

    if (!changed) {
      return { changed: false, actions: [], channels: this.listChannels(), policy };
    }

    this.state.policies.sdr = {
      ...this.state.policies.sdr,
      channels: normalizeChannels(nextChannels)
    };
    this.state.policies = normalizePolicies(this.state.policies);
    this.persist();
    const event = {
      type: "policy",
      actor,
      timestamp: Date.now(),
      policy: this.getPolicies(),
      metadata: {
        autoCycle: {
          changed: true,
          actions
        }
      }
    };
    this.traceStore.addAudit(event);
    this.traceStore.events.emit("policy", event);
    return { changed: true, actions, channels: this.listChannels(), policy: this.getAutoCyclePolicy() };
  }
}

function normalizePolicies(policies) {
  const merged = {
    ...structuredClone(DEFAULT_POLICIES),
    ...(policies || {}),
    admission: {
      ...DEFAULT_POLICIES.admission,
      ...(policies?.admission || {})
    },
    runtimeStates: {
      ...DEFAULT_POLICIES.runtimeStates,
      ...(policies?.runtimeStates || {})
    },
    proxy: {
      ...DEFAULT_POLICIES.proxy,
      ...(policies?.proxy || {})
    },
    sdr: {
      ...DEFAULT_POLICIES.sdr,
      ...(policies?.sdr || {}),
      channels: {
        ...DEFAULT_POLICIES.sdr.channels,
        ...(policies?.sdr?.channels || {})
      },
      sectionOps: {
        ...DEFAULT_POLICIES.sdr.sectionOps,
        ...(policies?.sdr?.sectionOps || {})
      }
    },
    autoCycle: {
      ...DEFAULT_POLICIES.autoCycle,
      ...(policies?.autoCycle || {})
    },
    archive: {
      ...DEFAULT_POLICIES.archive,
      ...(policies?.archive || {})
    }
  };

  const mode = String(merged.proxy.mode || "orchestrated").toLowerCase();
  merged.proxy.mode = mode === "transparent" ? "transparent" : "orchestrated";
  merged.proxy.runtimeId = merged.proxy.runtimeId ? String(merged.proxy.runtimeId) : null;
  merged.proxy.modelLimit = Number.isFinite(Number(merged.proxy.modelLimit))
    ? Math.max(1, Math.min(500, Number(merged.proxy.modelLimit)))
    : DEFAULT_POLICIES.proxy.modelLimit;
  const discovery = String(merged.proxy.modelDiscovery || "cached").toLowerCase();
  merged.proxy.modelDiscovery = discovery === "active" ? "active" : "cached";
  const expose = String(merged.proxy.exposeIdMode || "prefixed").toLowerCase();
  merged.proxy.exposeIdMode = expose === "native" ? "native" : "prefixed";

  merged.sdr.enabled = merged.sdr.enabled !== false;
  merged.sdr.defaultChannel = merged.sdr.defaultChannel ? normalizeChannelName(merged.sdr.defaultChannel) : null;
  merged.sdr.sectionOps = {
    enabled: merged.sdr.sectionOps?.enabled !== false,
    allowPromptDirective: merged.sdr.sectionOps?.allowPromptDirective !== false
  };
  merged.sdr.channels = normalizeChannels(merged.sdr.channels);

  merged.autoCycle.enabled = merged.autoCycle.enabled !== false;
  merged.autoCycle.intervalMs = normalizeIntervalMs(merged.autoCycle.intervalMs, DEFAULT_POLICIES.autoCycle.intervalMs);
  merged.autoCycle.failoverChannels = merged.autoCycle.failoverChannels !== false;
  merged.autoCycle.failbackPreferred = merged.autoCycle.failbackPreferred !== false;
  merged.autoCycle.forceModelRefresh = merged.autoCycle.forceModelRefresh !== false;

  merged.archive.enabled = merged.archive.enabled !== false;
  merged.archive.autoIngest = merged.archive.autoIngest !== false;
  const compression = String(merged.archive.compression || "gzip").toLowerCase();
  merged.archive.compression = compression === "gzip" ? "gzip" : "gzip";
  const level = Number(merged.archive.compressionLevel);
  merged.archive.compressionLevel = Number.isFinite(level) ? Math.max(1, Math.min(9, Math.floor(level))) : DEFAULT_POLICIES.archive.compressionLevel;

  return merged;
}

function normalizeTopology(topology = null) {
  return {
    nodes: (Array.isArray(topology?.nodes) ? topology.nodes : [])
      .map(normalizeTopologyNode)
      .filter(Boolean)
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)),
    edges: (Array.isArray(topology?.edges) ? topology.edges : [])
      .map(normalizeTopologyEdge)
      .filter(Boolean)
      .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind))
  };
}

function normalizeTopologyNode(node) {
  const id = String(node?.id || "").trim();
  if (!id) return null;
  const normalized = {
    id,
    kind: String(node?.kind || "node"),
    label: String(node?.label || id)
  };
  if (typeof node?.healthy === "boolean") normalized.healthy = node.healthy;
  if (Number.isFinite(Number(node?.priority))) normalized.priority = Number(node.priority);
  if (node?.provider) normalized.provider = String(node.provider);
  if (node?.transport) normalized.transport = String(node.transport);
  if (node?.remoteAddress) normalized.remoteAddress = String(node.remoteAddress);
  if (node?.userAgent) normalized.userAgent = String(node.userAgent);
  if (node?.sessionUser) normalized.sessionUser = String(node.sessionUser);
  if (node?.lastSeenAt) normalized.lastSeenAt = String(node.lastSeenAt);
  if (Array.isArray(node?.subscriptions)) normalized.subscriptions = [...new Set(node.subscriptions.map((item) => String(item)).filter(Boolean))];
  if (Array.isArray(node?.paths)) normalized.paths = [...new Set(node.paths.map((item) => String(item)).filter(Boolean))];
  if (Array.isArray(node?.methods)) normalized.methods = [...new Set(node.methods.map((item) => String(item)).filter(Boolean))];
  return normalized;
}

function normalizeTopologyEdge(edge) {
  const from = String(edge?.from || "").trim();
  const to = String(edge?.to || "").trim();
  if (!from || !to) return null;
  const normalized = {
    from,
    to,
    kind: String(edge?.kind || "route")
  };
  if (typeof edge?.healthy === "boolean") normalized.healthy = edge.healthy;
  if (Number.isFinite(Number(edge?.priority))) normalized.priority = Number(edge.priority);
  if (edge?.transport) normalized.transport = String(edge.transport);
  return normalized;
}

function normalizeChannels(channels) {
  const output = {};
  for (const [rawName, value] of Object.entries(channels || {})) {
    const name = normalizeChannelName(rawName);
    if (!name) continue;
    if (!value || typeof value !== "object") continue;
    if (!value.runtimeId) continue;
    output[name] = {
      runtimeId: String(value.runtimeId),
      model: String(value.model || ""),
      op: normalizeOp(value.op),
      enabled: value.enabled !== false,
      preferredRuntimeId: String(value.preferredRuntimeId || value.runtimeId),
      failoverCount: Number(value.failoverCount || 0),
      lastFailoverAt: Number(value.lastFailoverAt || 0),
      lastAutoCycleAction: String(value.lastAutoCycleAction || ""),
      lastAutoCycleAt: Number(value.lastAutoCycleAt || 0),
      updatedAt: Number(value.updatedAt || 0)
    };
  }
  return output;
}

function normalizeChannelName(value) {
  const cleaned = String(value || "").trim().toLowerCase();
  if (!cleaned) return "";
  if (!/^[a-z0-9_-]{1,40}$/i.test(cleaned)) return "";
  return cleaned;
}

function normalizeOp(value) {
  const op = String(value || "").toLowerCase();
  if (["strict", "semantic", "lightweight", "reflective", "embedding"].includes(op)) {
    return op;
  }
  return "semantic";
}

function normalizeIntervalMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(3000, Math.min(10 * 60 * 1000, Math.floor(parsed)));
}

function indexRuntimeModels(models) {
  const index = new Map();
  for (const model of models || []) {
    const provider = String(model?.provider || "");
    if (!provider || provider === "broker" || provider === "sdr") continue;
    if (!index.has(provider)) {
      index.set(provider, new Set());
    }
    const set = index.get(provider);
    if (model.id) set.add(String(model.id));
    if (model.raw_id) set.add(String(model.raw_id));
  }
  return index;
}

function runtimeSupportsModel(index, runtimeId, modelId) {
  const runtimeModels = index.get(String(runtimeId || ""));
  if (!runtimeModels || runtimeModels.size === 0) {
    return true;
  }
  return runtimeModels.has(String(modelId || ""));
}
