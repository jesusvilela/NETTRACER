import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ControlPlane } from "../src/control-plane.js";

function makeControlPlane() {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-cp-"));
  const config = {
    stateDir,
    appName: "netracer"
  };
  const traceStore = {
    addAudit() {},
    events: { emit() {} }
  };
  return new ControlPlane(config, traceStore);
}

test("ControlPlane normalizes proxy policy fields", () => {
  const controlPlane = makeControlPlane();
  const updated = controlPlane.updatePolicy({
    proxy: {
      mode: "transparent",
      modelLimit: 9999,
      modelDiscovery: "ACTIVE",
      exposeIdMode: "native"
    }
  }, "tester");

  assert.equal(updated.proxy.mode, "transparent");
  assert.equal(updated.proxy.modelLimit, 500);
  assert.equal(updated.proxy.modelDiscovery, "active");
  assert.equal(updated.proxy.exposeIdMode, "native");
});

test("ControlPlane upserts and deletes SDR channels", () => {
  const controlPlane = makeControlPlane();
  const withChannel = controlPlane.upsertChannel({
    name: "a",
    runtimeId: "lmstudio",
    model: "model-a",
    op: "strict",
    enabled: true
  }, "tester");

  assert.equal(withChannel.sdr.channels.a.runtimeId, "lmstudio");
  assert.equal(withChannel.sdr.channels.a.model, "model-a");
  assert.equal(withChannel.sdr.channels.a.op, "strict");
  assert.equal(withChannel.sdr.channels.a.enabled, true);
  assert.equal(withChannel.sdr.channels.a.preferredRuntimeId, "lmstudio");

  const withoutChannel = controlPlane.deleteChannel("a", "tester");
  assert.equal(withoutChannel.sdr.channels.a, undefined);
});

test("ControlPlane normalizes auto-cycle policy fields", () => {
  const controlPlane = makeControlPlane();
  const updated = controlPlane.updatePolicy({
    autoCycle: {
      enabled: true,
      intervalMs: 2000000,
      failoverChannels: true,
      failbackPreferred: false,
      forceModelRefresh: true
    }
  }, "tester");

  assert.equal(updated.autoCycle.enabled, true);
  assert.equal(updated.autoCycle.intervalMs, 600000);
  assert.equal(updated.autoCycle.failoverChannels, true);
  assert.equal(updated.autoCycle.failbackPreferred, false);
  assert.equal(updated.autoCycle.forceModelRefresh, true);
});

test("ControlPlane auto-cycle reroutes channel to healthy runtime", () => {
  const controlPlane = makeControlPlane();
  controlPlane.upsertChannel({
    name: "a",
    runtimeId: "lmstudio",
    preferredRuntimeId: "lmstudio",
    model: "model-a",
    op: "semantic",
    enabled: true
  }, "tester");

  const result = controlPlane.applyAutoCycleRuntime({
    upstreams: [
      { id: "lmstudio", healthy: false, enabled: true, priority: 100 },
      { id: "ollama", healthy: true, enabled: true, priority: 80 }
    ],
    models: [
      { id: "ollama/model-b", raw_id: "model-b", provider: "ollama" }
    ]
  }, "autocycle");

  assert.equal(result.changed, true);
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].channel, "a");
  const channels = controlPlane.listChannels();
  assert.equal(channels.a.runtimeId, "ollama");
  assert.equal(channels.a.preferredRuntimeId, "lmstudio");
  assert.equal(channels.a.failoverCount, 1);
});

test("ControlPlane normalizes archive policy fields", () => {
  const controlPlane = makeControlPlane();
  const updated = controlPlane.updatePolicy({
    archive: {
      enabled: true,
      autoIngest: false,
      compression: "brotli",
      compressionLevel: 99
    }
  }, "tester");

  assert.equal(updated.archive.enabled, true);
  assert.equal(updated.archive.autoIngest, false);
  assert.equal(updated.archive.compression, "gzip");
  assert.equal(updated.archive.compressionLevel, 9);
});

test("ControlPlane recovers from backup state when primary state is corrupted", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-cp-recover-"));
  const filePath = path.join(stateDir, "control-plane.json");
  fs.writeFileSync(filePath, "{invalid-json");
  fs.writeFileSync(`${filePath}.bak`, JSON.stringify({
    policies: {
      routePin: "lmstudio"
    },
    topology: {
      nodes: [{ id: "node-a", kind: "runtime", label: "node-a" }],
      edges: []
    },
    lastUpdated: new Date().toISOString()
  }, null, 2));

  const controlPlane = new ControlPlane({
    stateDir,
    appName: "netracer"
  }, {
    addAudit() {},
    events: { emit() {} }
  });

  assert.equal(controlPlane.getPolicies().routePin, "lmstudio");
  assert.equal(controlPlane.getTopology().nodes[0].id, "node-a");
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(filePath, "utf8")));
});

test("ControlPlane topology includes connected client nodes and bind edges", () => {
  const controlPlane = makeControlPlane();
  const topology = controlPlane.updateTopology({
    upstreams: [{ id: "lmstudio", healthy: true, priority: 100 }],
    models: [{ id: "qwen", provider: "lmstudio", broker_default: false }],
    clients: [{
      id: "node-alpha",
      label: "node-alpha",
      healthy: true,
      transport: "ws/slang",
      remoteAddress: "127.0.0.1",
      userAgent: "node-alpha/1.0",
      subscriptions: ["lmstudio"],
      paths: ["/ws/slang"],
      methods: ["GET"],
      lastSeenAt: new Date().toISOString()
    }]
  });

  assert.ok(topology.nodes.some((node) => node.id === "node-alpha" && node.kind === "client"));
  assert.ok(topology.edges.some((edge) => edge.from === "netracer" && edge.to === "node-alpha" && edge.kind === "bind"));
});
