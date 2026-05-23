import test from "node:test";
import assert from "node:assert/strict";
import { buildV9NetworkGrowthCosmos } from "../src/v9-network-growth-cosmos.js";

test("V9 populates every n-mesh world with network information growth", () => {
  const result = buildV9NetworkGrowthCosmos({
    meshCount: 4,
    traffic: [{ packetId: "p1", direction: "TO_SUBSTRATE", route: "cognition" }],
    topology: {
      nodes: [{ id: "netracer", kind: "broker" }, { id: "client-alpha", kind: "client" }],
      edges: [{ from: "netracer", to: "client-alpha" }]
    }
  });

  assert.equal(result.product, "netracer-v9-network-growth-cosmos");
  assert.equal(result.inherits, "netracer-v8-nmesh-world-engine");
  assert.equal(result.growth_engine.not_2d, true);
  assert.equal(result.growth_engine.mesh_count, 4);
  assert.ok(result.growth_engine.information_seed_count >= 3);
  assert.equal(result.population.length, result.meshes.length * result.information_seeds.length);
  assert.ok(result.population.every((item) => typeof item.yaw_360 === "number" && typeof item.pitch_360 === "number"));
  assert.ok(result.growth_links.some((link) => link.kind === "world-growth-link"));
  assert.equal(result.spectator_semantics.network_populates_all_worlds, true);
});
