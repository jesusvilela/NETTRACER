import test from "node:test";
import assert from "node:assert/strict";
import { buildSubstrateFoundation } from "../src/substrate-foundation.js";

test("substrate foundation exposes non-destructive V1-to-latest traffic basis", () => {
  const result = buildSubstrateFoundation({
    selectedVersion: "V11",
    traffic: [
      { id: "t1", direction: "TO_SUBSTRATE", path: "/api/v2/cognition", timestamp: "2026-05-24T10:00:00.000Z" },
      { id: "t2", direction: "FROM_SUBSTRATE", path: "/api/archive/status", timestamp: "2026-05-24T10:00:01.000Z" }
    ],
    topology: {
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [{ from: "a", to: "b" }]
    },
    archiveSource: {
      source: "fallback-readonly",
      fallbackPath: "H:\\TRASGONET\\netracer\\data\\state\\s1-archive.sqlite",
      archiveStatus: {
        dbPath: "H:\\TRASGONET\\netracer\\data\\state\\s1-archive.sqlite",
        packetCount: 134000,
        compressionRatio: 0.5
      }
    }
  });

  assert.equal(result.product, "netracer-substrate-foundation");
  assert.deepEqual(result.writes, []);
  assert.equal(result.selected_version.id, "V11");
  assert.equal(result.version_ladder[0].id, "V1");
  assert.equal(result.version_ladder.at(-1).id, "V13");
  assert.equal(result.version_ladder.length, 13);
  assert.equal(result.invariants.non_destructive, true);
  assert.equal(result.invariants.v1_to_latest_reachable, true);
  assert.equal(result.invariants.lower_and_higher_navigation_declared, true);
  assert.equal(result.traffic_basis.archive.read_only, true);
  assert.equal(result.traffic_basis.archive.packet_count, 134000);
  assert.equal(result.traffic_basis.traffic_events_window, 2);
  assert.equal(result.traffic_basis.topology_nodes, 2);
  assert.ok(result.bridges.every((bridge) => bridge.preserves.includes("packet identity")));
  assert.equal(result.launch.view, "/substrate/foundation");
});
