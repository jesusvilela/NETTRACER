import test from "node:test";
import assert from "node:assert/strict";
import { buildV12AaaWorldGenerator } from "../src/v12-aaa-world-generator.js";

test("V12 generates a first-person world from the V11 meaning field", () => {
  const result = buildV12AaaWorldGenerator({
    meshCount: 5,
    seed: "test-world",
    traffic: [{ packetId: "p1", direction: "TO_SUBSTRATE", route: "world" }],
    topology: { nodes: [{ id: "netracer" }, { id: "client-alpha" }], edges: [] }
  });

  assert.equal(result.product, "netracer-v12-aaa-world-generator");
  assert.equal(result.inherits, "netracer-v11-active-cognition-instrument");
  assert.equal(result.generator_geometry.not_2d, true);
  assert.equal(result.generator_geometry.first_person_walker, true);
  assert.equal(result.terrain.points.length, result.terrain.grid_size * result.terrain.grid_size);
  assert.ok(result.life.count >= 140);
  assert.equal(result.life.entities.length, result.life.count);
  assert.ok(result.culture.count > 0);
  assert.ok(result.cosmos_towers.length > 0);
  assert.ok(result.narrator.beats.some((beat) => beat.includes("World-weaver axiom")));
  assert.equal(result.launch.view, "/v12/aaa-world-generator");
});
