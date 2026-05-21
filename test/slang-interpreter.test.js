import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ControlPlane } from "../src/control-plane.js";
import { SlangInterpreter } from "../src/slang-interpreter.js";
import { buildS1Packet, S1_PACKET_TYPES } from "../src/packet.js";

function makeControlPlane() {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-slang-"));
  const config = { stateDir, appName: "netracer" };
  const traceStore = { addAudit() {}, events: { emit() {} } };
  const controlPlane = new ControlPlane(config, traceStore);
  controlPlane.updateTopology({
    upstreams: [{ id: "lmstudio", healthy: true, priority: 100 }],
    models: [{ id: "qwen", provider: "lmstudio", broker_default: false }]
  });
  return controlPlane;
}

test("SlangInterpreter derives frames and catalog from packets", () => {
  const packet = buildS1Packet({
    packetType: S1_PACKET_TYPES.EXECUTION,
    clientId: "tester",
    intent: "Map the sheaf and compact the route through metaphor.",
    route: "lmstudio",
    analysis: { routeHint: "semantic", tags: ["A7", "gluing"], summary: "compact the semantic stream" },
    sigma: { summary: "coherent", gluing: true },
    kappa: { loadPct: 0.18 },
    labels: ["§A7", "§GLUE"]
  });
  const traceStore = { getPackets: () => [packet] };
  const interpreter = new SlangInterpreter({ traceStore, controlPlane: makeControlPlane() });

  const catalog = interpreter.getCatalog();
  const frames = interpreter.getFramesForNode("lmstudio", 10);

  assert.equal(catalog.lang.version, "v1.2.0");
  assert.ok(catalog.nodes.some((node) => node.id === "lmstudio"));
  assert.equal(frames.length, 1);
  assert.match(frames[0].compacted, /§COMPACT/);
  assert.equal(frames[0].fiber, "semantic");
});

test("SlangInterpreter blocks relay on low coherence or high distortion", () => {
  const packet = buildS1Packet({
    packetType: S1_PACKET_TYPES.EXECUTION,
    clientId: "tester",
    intent: "Bare packet",
    route: "lmstudio",
    analysis: { routeHint: "", tags: [], summary: "" },
    sigma: null,
    kappa: { loadPct: 0.95 },
    labels: []
  });
  const traceStore = { getPackets: () => [packet] };
  const interpreter = new SlangInterpreter({ traceStore, controlPlane: makeControlPlane() });
  const frame = interpreter.getFramesForNode("lmstudio", 1)[0];
  const preview = interpreter.previewRelay("lmstudio", frame.id);

  assert.equal(preview.ok, true);
  assert.equal(preview.eligible, false);
  assert.match(preview.relayReason, /coherence|distortion/);
});
