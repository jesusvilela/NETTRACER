import test from "node:test";
import assert from "node:assert/strict";
import { buildV3ObjectMesh } from "../src/v3-object-mesh.js";

test("V3 object mesh applies recognition principle to the object itself", () => {
  const result = buildV3ObjectMesh({
    objectId: "netracer:v3",
    others: ["human:jesus", "repo:any", "object:self"]
  });

  assert.equal(result.product, "netracer-v3-object-mesh");
  assert.equal(result.mode, "read_only_virtual_manifold");
  assert.deepEqual(result.writes, []);
  assert.equal(result.object.principle_applied_to, "object_itself");
  assert.equal(result.object.identity, "godelian_open_identity");
  assert.deepEqual(result.mesh.dimensions, [360, 360]);
  assert.equal(result.mesh.manifold, "virtual_360x360_orthogonal_hypercomplex_mesh");
  assert.equal(result.interbridges.length, 3);
  assert.equal(result.invariants.no_2d_inside_2d, true);
  assert.equal(result.invariants.preserve_otherness, true);
  assert.equal(result.invariants.preserve_active_remainder, true);
  assert.ok(result.qualities.some((quality) => quality.name === "mutual_recognition"));
  assert.ok(result.hamiltonian.total_cognitive_energy > 0);
});
