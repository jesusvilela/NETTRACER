import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Broker } from "../src/broker.js";

function makeBroker() {
  const config = {
    androidClientId: "android",
    defaultModel: "substrate-broker-local",
    probeTtlMs: 5000,
    statusSummaryTtlMs: 1000,
    modelListTtlMs: 1000,
    clientPresenceTtlMs: 60000,
    upstreamProbeTimeoutMs: 25,
    upstreamModelTimeoutMs: 25,
    upstreamCompletionTimeoutMs: 250,
    commandEngineTimeoutMs: 250,
    outboxDir: path.join(process.cwd(), "data", "outbox"),
    signingKey: "test-signing-key",
    upstreams: [
      { id: "lmstudio", baseUrl: "http://127.0.0.1:1234", model: "a", priority: 100, healthPath: "/v1/models" },
      { id: "ollama", baseUrl: "http://127.0.0.1:11434", model: "b", priority: 80, healthPath: "/v1/models", kind: "ollama" }
    ],
    commandEngines: [
      { id: "strict-local", command: "dummy", args: [], priority: 1000 }
    ]
  };
  const traceStore = { addTraffic() {}, addTrace() {}, addPacket() {}, addAlert() {}, events: { emit() {} }, getPacket() { return null; }, getPacketLineage() { return []; } };
  const telemetry = { sample: async () => ({ gpu: { name: "gpu", freeMb: 1000 }, memory: { freeMb: 20000 } }) };
  const controlPlane = {
    applyRoutePolicy(plan) { return plan; },
    getPolicies() {
      return {
        admission: { maxPromptTokens: 4096, allowLocalFallback: true },
        proxy: { mode: "orchestrated", runtimeId: null, modelLimit: 64, modelDiscovery: "cached", exposeIdMode: "prefixed" },
        sdr: {
          enabled: true,
          defaultChannel: null,
          channels: {
            a: { runtimeId: "lmstudio", model: "channel-model-a", op: "strict", enabled: true }
          },
          sectionOps: { enabled: true, allowPromptDirective: true }
        }
      };
    },
    isRuntimeEnabled() { return true; },
    getTopology() { return { nodes: [], edges: [] }; },
    updateTopology() { return { nodes: [], edges: [] }; }
  };
  return new Broker(config, traceStore, telemetry, controlPlane);
}

test("buildRoutePlan prioritizes strict command engines first", () => {
  const broker = makeBroker();
  const plan = broker.buildRoutePlan("strict");
  assert.equal(plan[0].id, "strict-local");
  assert.equal(plan[1].id, "lmstudio");
});

test("resolveRoutingPreferences reads channel alias and section op directives", () => {
  const broker = makeBroker();
  const analysis = { routeHint: "semantic" };
  const routing = broker.resolveRoutingPreferences({
    model: "a",
    messages: [{ role: "user", content: "§ROUTE{channel=a,op=strict}" }]
  }, analysis);

  assert.equal(routing.channel, "a");
  assert.equal(routing.preferredRuntimeId, "lmstudio");
  assert.equal(routing.preferredModel, "channel-model-a");
  assert.equal(routing.op, "strict");
  assert.equal(routing.routeHint, "strict");
});

test("getStatusSummary times out unhealthy upstream probes instead of hanging", async () => {
  const broker = makeBroker();
  const originalFetch = global.fetch;
  global.fetch = (_url, options = {}) => new Promise((_resolve, reject) => {
    const signal = options.signal;
    if (signal?.aborted) {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      return;
    }
    signal?.addEventListener("abort", () => {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    }, { once: true });
  });

  try {
    const startedAt = Date.now();
    const summary = await broker.getStatusSummary(true);
    const elapsedMs = Date.now() - startedAt;

    assert.equal(summary.degraded, true);
    assert.equal(summary.upstreams.length, 2);
    assert.ok(summary.upstreams.every((item) => item.healthy === false));
    assert.ok(summary.upstreams.every((item) => /timeout_after_25ms/.test(item.error || "")));
    assert.ok(elapsedMs < 300);
  } finally {
    global.fetch = originalFetch;
  }
});

test("getStatusSummary carries observed clients into topology", async () => {
  const broker = makeBroker();
  let topologyArgs = null;
  broker.controlPlane.updateTopology = (args) => {
    topologyArgs = args;
    return {
      nodes: [
        { id: "netracer", kind: "broker", label: "netracer" },
        ...(args.clients || []).map((client) => ({ id: client.id, kind: "client", label: client.label }))
      ],
      edges: (args.clients || []).map((client) => ({ from: "netracer", to: client.id, kind: "bind" }))
    };
  };
  broker.safeTelemetrySample = async () => ({ gpu: { name: "gpu", freeMb: 1000 }, memory: { freeMb: 20000 } });
  broker.discoverUpstreams = async () => [{
    engine: broker.config.upstreams[0],
    probe: { healthy: true, checkedAt: Date.now(), error: null },
    models: []
  }];
  broker.listModels = async () => [];

  broker.observeClient({ clientId: "node-alpha", label: "node-alpha" }, {
    transport: "ws/slang",
    path: "/ws/slang",
    method: "GET",
    remoteAddress: "127.0.0.1",
    userAgent: "node-alpha/1.0",
    subscriptions: ["lmstudio"]
  });

  const summary = await broker.getStatusSummary(true);

  assert.equal(topologyArgs.clients.length, 1);
  assert.equal(topologyArgs.clients[0].id, "node-alpha");
  assert.deepEqual(topologyArgs.clients[0].subscriptions, ["lmstudio"]);
  assert.ok(summary.clients.some((client) => client.id === "node-alpha"));
  assert.ok(summary.topology.nodes.some((node) => node.id === "node-alpha" && node.kind === "client"));
});

test("getStatusSummary serves stale cache immediately while refreshing in background", async () => {
  const broker = makeBroker();
  broker.statusCache = {
    checkedAt: Date.now() - 5000,
    summary: {
      defaultModel: broker.config.defaultModel,
      hostHints: broker.config.hostHints,
      telemetry: { gpu: { name: "gpu", freeMb: 1000 }, memory: { freeMb: 20000 } },
      policies: broker.controlPlane.getPolicies(),
      topology: { nodes: [{ id: "netracer", kind: "broker", label: "netracer" }], edges: [] },
      upstreams: [],
      clients: [],
      commandEngines: [],
      degraded: false
    }
  };
  broker.discoverUpstreams = async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
    return [{
      engine: broker.config.upstreams[0],
      probe: { healthy: true, checkedAt: Date.now(), error: null },
      models: []
    }];
  };
  broker.listModels = async () => [];

  const startedAt = Date.now();
  const summary = await broker.getStatusSummary();
  const elapsedMs = Date.now() - startedAt;

  assert.ok(elapsedMs < 40);
  assert.equal(summary.recovery?.source, "stale-status-cache");
  assert.equal(summary.recovery?.refreshing, true);
  await broker.statusRefreshPromise;
  assert.equal(Array.isArray(broker.statusCache.summary?.upstreams), true);
});
