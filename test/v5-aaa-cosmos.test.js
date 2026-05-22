import test from "node:test";
import assert from "node:assert/strict";
import { buildV5AaaCosmos } from "../src/v5-aaa-cosmos.js";

test("V5 AAA cosmos projects V4 into a GPU 3D navigable manifold", () => {
  const result = buildV5AaaCosmos({
    traffic: [
      { packetId: "p1", direction: "TO_SUBSTRATE", route: "cognition" },
      { packetId: "p2", direction: "FROM_SUBSTRATE", route: "object" }
    ],
    topology: {
      nodes: [{ id: "netracer" }, { id: "client-alpha" }],
      edges: [{ from: "netracer", to: "client-alpha" }]
    }
  });

  assert.equal(result.product, "netracer-v5-aaa-cosmos");
  assert.equal(result.mode, "aaa_webgl_hypercomplex_hyperbolic_projection");
  assert.deepEqual(result.writes, []);
  assert.equal(result.projection.not_2d, true);
  assert.equal(result.target_hardware.gpu_class, "NVIDIA RTX 3060 Ti 8GB");
  assert.equal(result.substrate_codecs.ramdisk.repository, "jesusvilela/nnn-hyperbolic-ramdisk_v2");
  assert.equal(result.substrate_codecs.slang.repository, "jesusvilela/-lang.s1");
  assert.deepEqual(result.worlds.map((world) => world.id), ["V1", "V2", "V3"]);
  assert.equal(result.bridges.length, 3);
  assert.ok(result.bridges.every((bridge) => bridge.tunnel === "volumetric_crossable_bridge"));
  assert.equal(result.navigator_ship.mode, "inside_network_flight");
  assert.deepEqual(result.navigator_ship.default_route, ["V1", "V2", "V3", "V1"]);
  assert.equal(result.sim_levels.length, 3);
  assert.equal(result.sim_levels[0].bridge, "V1->V2");
  assert.equal(result.cognition_ascent.invariant, "total_cognitive_energy");
  assert.equal(result.cognition_ascent.progress_signal, "dominance_trace_ascent");
  assert.equal(result.seed_object.representation, "first_person_navigable_mesh_not_2d_diagram");
  assert.equal(result.lab_traffic.traffic_count, 2);
  assert.equal(result.lab_traffic.topology_nodes, 2);
  assert.equal(result.lab_traffic.pulses.length, 2);
  assert.equal(result.invariants.no_flat_canvas_final, true);
});
