import test from "node:test";
import assert from "node:assert/strict";
import { buildV10SignStabilizedFibers } from "../src/v10-sign-stabilized-fibers.js";

test("V10 lifts network growth into sign-stabilized two-channel fibers", () => {
  const result = buildV10SignStabilizedFibers({
    meshCount: 4,
    traffic: [{ packetId: "p1", direction: "TO_SUBSTRATE", route: "cognition" }],
    topology: { nodes: [{ id: "netracer" }, { id: "client-alpha" }], edges: [] }
  });

  assert.equal(result.product, "netracer-v10-sign-stabilized-fibers");
  assert.equal(result.inherits, "netracer-v9-network-growth-cosmos");
  assert.equal(result.two_channel_geometry.not_2d, true);
  assert.equal(result.two_channel_geometry.invariant_object, "sign_stabilized_subspace_not_single_basis");
  assert.equal(result.output_highway.length, 4);
  assert.ok(result.behavioral_fibers.length > result.output_highway.length);
  assert.ok(result.behavioral_fibers.every((fiber) => fiber.sign === 1 || fiber.sign === -1));
  assert.ok(result.gauge_rotations.every((rotation) => rotation.preserves_subspace));
  assert.equal(result.inspiration.doi, "10.5281/zenodo.20102939");
});
