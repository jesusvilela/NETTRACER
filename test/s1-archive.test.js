import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TraceStore } from "../src/trace-store.js";
import { ControlPlane } from "../src/control-plane.js";
import { S1Archive } from "../src/s1-archive.js";
import { buildS1Packet, S1_PACKET_TYPES } from "../src/packet.js";

function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-archive-"));
  const config = {
    appName: "netracer",
    stateDir: path.join(root, "state"),
    packetDir: path.join(root, "packets"),
    traceDir: path.join(root, "traces"),
    trafficLimit: 200,
    traceLimit: 200,
    packetLimit: 200,
    alertLimit: 100,
    auditLimit: 100
  };
  fs.mkdirSync(config.stateDir, { recursive: true });
  fs.mkdirSync(config.packetDir, { recursive: true });
  fs.mkdirSync(config.traceDir, { recursive: true });
  const traceStore = new TraceStore(config);
  const controlPlane = new ControlPlane(config, traceStore);
  return { config, traceStore, controlPlane };
}

test("S1Archive ingests packets and reports compression stats", () => {
  const { config, traceStore, controlPlane } = makeEnv();
  const archive = new S1Archive({ config, traceStore, controlPlane });

  const packet = buildS1Packet({
    packetType: S1_PACKET_TYPES.INTENT,
    clientId: "test-client",
    route: "lmstudio",
    model: "model-a",
    intent: "archive test payload"
  });
  traceStore.addPacket(packet);

  const status = archive.getStatus();
  assert.equal(status.packetCount >= 1, true);
  assert.equal(status.compressedBytes > 0, true);
  const rows = archive.getRecent(5);
  assert.equal(rows.length >= 1, true);
  const restored = archive.getPacket(packet.id);
  assert.equal(restored.packet.id, packet.id);
});

test("S1Archive compact and prune APIs work", () => {
  const { config, traceStore, controlPlane } = makeEnv();
  const archive = new S1Archive({ config, traceStore, controlPlane });

  for (let i = 0; i < 6; i += 1) {
    const packet = buildS1Packet({
      packetType: S1_PACKET_TYPES.AUDIT,
      clientId: "test-client",
      route: "route-a",
      model: "model-a",
      intent: `payload-${i}`
    });
    traceStore.addPacket(packet);
  }

  const compact = archive.compactFromTrace(6);
  assert.equal(compact.requested, 6);
  const pruned = archive.prune(3);
  assert.equal(pruned.keepLatest, 100);
  assert.equal(pruned.deleted >= 0, true);
});

test("S1Archive insights expose quantitative and qualitative summaries", () => {
  const { config, traceStore, controlPlane } = makeEnv();
  const archive = new S1Archive({ config, traceStore, controlPlane });

  const packets = [
    buildS1Packet({
      packetType: S1_PACKET_TYPES.INTENT,
      clientId: "client-a",
      actor: "operator",
      route: "lmstudio",
      model: "model-a",
      intent: "intent packet for qualitative archive view",
      stage: { name: "ING", detail: "ingest" },
      labels: ["intent", "alpha"],
      metadata: { response: "draft" }
    }),
    buildS1Packet({
      packetType: S1_PACKET_TYPES.EXECUTION,
      clientId: "client-a",
      actor: "operator",
      route: "lmstudio",
      model: "model-a",
      intent: "execution packet",
      stage: { name: "RUN", detail: "execute" },
      labels: ["execution"],
      proof: { routePlan: ["lmstudio"] }
    }),
    buildS1Packet({
      packetType: S1_PACKET_TYPES.PROOF,
      clientId: "client-b",
      actor: "auditor",
      route: "netracer",
      model: "model-b",
      stage: { name: "CMT", detail: "prove" },
      labels: ["proof", "beta"],
      metadata: { terminal: true }
    })
  ];

  for (const packet of packets) {
    traceStore.addPacket(packet);
  }

  const insight = archive.getInsights({ windowHours: 24, bucketCount: 12, sampleLimit: 3, decodeLimit: 10, topLimit: 5 });
  assert.equal(insight.quantitative.packetCount >= 3, true);
  assert.equal(insight.quantitative.byType.some((row) => row.packetType === "intent"), true);
  assert.equal(insight.quantitative.byRoute.some((row) => row.route === "lmstudio"), true);
  assert.equal(Array.isArray(insight.quantitative.timeline), true);
  assert.equal(insight.qualitative.cards.length, 3);
  assert.equal(insight.qualitative.stages.some((row) => row.label === "ING"), true);
  assert.equal(insight.qualitative.labels.some((row) => row.label === "proof"), true);
  assert.equal(insight.qualitative.motifs.length >= 1, true);
});
