import test from "node:test";
import assert from "node:assert/strict";
import { buildV4VersionCage } from "../src/v4-version-cage.js";

test("V4 version cage consolidates prior versions without flattening them", () => {
  const result = buildV4VersionCage();

  assert.equal(result.product, "netracer-v4-version-cage");
  assert.equal(result.mode, "smooth_pliable_visual_consolidation");
  assert.deepEqual(result.writes, []);
  assert.equal(result.cage.kind, "hypercomplex_hyperdim_n_caged_version_manifold");
  assert.equal(result.principle.operator, "hypercomplex_inside_hypercomplex");
  assert.equal(result.versions.length, 3);
  assert.deepEqual(result.versions.map((node) => node.id), ["V1", "V2", "V3"]);
  assert.equal(result.bridges.length, 3);
  assert.ok(result.bridges.every((bridge) => bridge.crossing === "geometric_interbridge"));
  assert.equal(result.invariants.non_destructive, true);
  assert.equal(result.invariants.all_prior_versions_reachable, true);
  assert.equal(result.invariants.no_flattening_to_single_version, true);
  assert.equal(result.launch.port, 8790);
});
