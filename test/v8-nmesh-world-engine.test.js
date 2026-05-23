import test from "node:test";
import assert from "node:assert/strict";
import { buildV8NMeshWorldEngine } from "../src/v8-nmesh-world-engine.js";

test("V8 constructs n meshes of the V7 world engine", () => {
  const result = buildV8NMeshWorldEngine({
    meshCount: 6,
    traffic: [{ packetId: "p1", direction: "TO_SUBSTRATE", route: "cognition" }],
    topology: { nodes: [{ id: "netracer" }], edges: [] }
  });

  assert.equal(result.product, "netracer-v8-nmesh-world-engine");
  assert.equal(result.inherits, "netracer-v7-informational-cosmos-graph");
  assert.equal(result.n_mesh_engine.not_2d, true);
  assert.equal(result.n_mesh_engine.mesh_count, 6);
  assert.equal(result.meshes.length, 6);
  assert.ok(result.meshes.every((mesh) => mesh.nodes.some((node) => node.source_id === "seed-spinner-hand")));
  assert.ok(result.cross_mesh_bridges.some((bridge) => bridge.kind === "cross-mesh-sheaf-bridge"));
  assert.equal(result.spectator_semantics.n_mesh_consolidation, true);
});
