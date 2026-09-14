import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
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
      fallbackPath: path.join(process.cwd(), "data", "state", "s1-archive.sqlite"),
      archiveStatus: {
        dbPath: path.join(process.cwd(), "data", "state", "s1-archive.sqlite"),
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
  assert.ok(result.version_ladder.length >= 13);
  assert.equal(result.invariants.non_destructive, true);
  assert.equal(result.invariants.v1_to_latest_reachable, true);
  assert.equal(result.invariants.lower_and_higher_navigation_declared, true);
  assert.equal(result.traffic_basis.archive.read_only, true);
  assert.equal(result.traffic_basis.archive.packet_count, 134000);
  assert.equal(result.traffic_basis.traffic_events_window, 2);
  assert.ok(result.traffic_basis.complexity_profile.emergence > 0);
  assert.ok(result.traffic_basis.complexity_profile.suggested_routes >= 3);
  assert.ok(result.traffic_basis.complexity_profile.visual_particles >= 160);
  assert.equal(result.traffic_basis.topology_nodes, 2);
  assert.ok(result.bridges.every((bridge) => bridge.preserves.includes("packet identity")));
  assert.equal(result.circulation.operator, "hypercomplex_content_circulation");
  assert.deepEqual(result.circulation.writes, []);
  assert.ok(result.circulation.routes.length >= result.traffic_basis.complexity_profile.suggested_routes);
  assert.ok(result.circulation.routes.some((route) => route.id === "capture-to-semantic"));
  assert.ok(result.circulation.routes.every((route) => route.admissible));
  assert.equal(result.circulation.invariants.archive_provenance, true);
  assert.equal(result.invariants.circulation_is_read_only_projection, true);
  assert.equal(result.invariants.circulation_preserves_provenance, true);
  assert.equal(result.telos_field.boundary, "engineering_simulation_not_sentience");
  assert.equal(result.telos_field.math_principles.invariant, "total_cognitive_energy");
  assert.equal(result.telos_field.math_principles.progress_signal, "dominance_trace_ascent");
  assert.ok(result.telos_field.ascent.length >= 5);
  assert.ok(result.telos_field.beings.length >= result.traffic_basis.complexity_profile.suggested_beings);
  assert.ok(result.telos_field.virtuous_cycles.length >= result.traffic_basis.complexity_profile.suggested_cycles);
  assert.equal(result.invariants.telos_field_is_simulated_readout, true);
  assert.equal(result.launch.view, "/substrate/foundation");
});
