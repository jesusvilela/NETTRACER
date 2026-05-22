import test from "node:test";
import assert from "node:assert/strict";
import { buildV6HypercomplexWorld } from "../src/v6-hypercomplex-world.js";

test("V6 projects V5 into a first-person hypercomplex world runtime", () => {
  const result = buildV6HypercomplexWorld({
    traffic: [{ packetId: "p1", direction: "TO_SUBSTRATE", route: "cognition" }],
    topology: { nodes: [{ id: "netracer" }], edges: [] }
  });

  assert.equal(result.product, "netracer-v6-hypercomplex-world");
  assert.equal(result.inherits, "netracer-v5-aaa-cosmos");
  assert.equal(result.world_runtime.not_2d, true);
  assert.equal(result.invariants.first_person_primary, true);
  assert.equal(result.target_hardware.target_resolution, "3840x2160");
  assert.equal(result.seed_object.runtime_body, "spinner_hand_weaving_live_ncosmo_fibers");
  assert.equal(result.portals.length, 3);
  assert.equal(result.lab_traffic.traffic_count, 1);
  assert.equal(result.cognition_ascent.invariant, "total_cognitive_energy");
});
