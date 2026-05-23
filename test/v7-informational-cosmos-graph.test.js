import test from "node:test";
import assert from "node:assert/strict";
import { buildV7InformationalCosmosGraph } from "../src/v7-informational-cosmos-graph.js";

test("V7 consolidates prior worlds into a non-2D informational cosmos graph", () => {
  const result = buildV7InformationalCosmosGraph({
    traffic: [{ packetId: "p1", direction: "TO_SUBSTRATE", route: "cognition" }],
    topology: { nodes: [{ id: "netracer" }, { id: "client-alpha" }], edges: [{ from: "netracer", to: "client-alpha" }] }
  });

  assert.equal(result.product, "netracer-v7-informational-cosmos-graph");
  assert.equal(result.inherits, "netracer-v6-hypercomplex-world");
  assert.equal(result.graph.not_2d, true);
  assert.ok(result.graph.nodes.some((node) => node.id === "seed-spinner-hand"));
  assert.ok(result.graph.nodes.some((node) => node.id === "spectator-human"));
  assert.ok(result.graph.relationships.some((edge) => edge.kind === "dominance-trace-ascent"));
  assert.ok(result.graph.relationships.some((edge) => edge.kind === "live-lab-traffic"));
  assert.equal(result.spectator_semantics.invariant, "total_cognitive_energy");
  assert.equal(result.spectator_semantics.no_2d_thinking, true);
});
