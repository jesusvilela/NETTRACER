import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TraceStore } from "../src/trace-store.js";
import { ControlPlane } from "../src/control-plane.js";
import { S1Archive } from "../src/s1-archive.js";
import { buildS1Packet, S1_PACKET_TYPES } from "../src/packet.js";
import { findBestArchiveCandidate, readArchiveReadonly } from "../src/v13-s1-archive-source.js";

function makeEnv(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const config = {
    stateDir: path.join(root, "state"),
    packetDir: path.join(root, "packets"),
    traceDir: path.join(root, "traces"),
    trafficLimit: 20,
    traceLimit: 20,
    packetLimit: 20,
    alertLimit: 20,
    auditLimit: 20
  };
  fs.mkdirSync(config.stateDir, { recursive: true });
  fs.mkdirSync(config.packetDir, { recursive: true });
  fs.mkdirSync(config.traceDir, { recursive: true });
  const traceStore = new TraceStore(config);
  const controlPlane = new ControlPlane(config, traceStore);
  return { config, traceStore, controlPlane };
}

test("V13 discovers and reads populated .s1 sqlite archives read-only", () => {
  const envA = makeEnv("v13-archive-a-");
  const envB = makeEnv("v13-archive-b-");
  const archiveA = new S1Archive(envA);
  const archiveB = new S1Archive(envB);
  archiveA.insertPacket(buildS1Packet({ packetType: S1_PACKET_TYPES.INTENT, route: "a", intent: "one" }), archiveA.getPolicy(), false);
  for (let i = 0; i < 3; i += 1) {
    archiveB.insertPacket(buildS1Packet({ packetType: S1_PACKET_TYPES.PROOF, route: "semantic", intent: `packet ${i}` }), archiveB.getPolicy(), false);
  }

  const best = findBestArchiveCandidate({
    candidates: [archiveA.dbPath, archiveB.dbPath],
    cwd: envA.config.stateDir
  });
  assert.equal(best.path, archiveB.dbPath);
  assert.equal(best.count, 3);

  const read = readArchiveReadonly(best.path, { hours: 24 * 90 });
  assert.equal(read.archiveStatus.packetCount, 3);
  assert.equal(read.archiveStatus.readOnly, true);
  assert.equal(read.archiveInsights.quantitative.packetCount, 3);
  assert.ok(read.archiveInsights.qualitative.cards.length > 0);
  assert.equal(read.recentPackets.length, 3);
});
