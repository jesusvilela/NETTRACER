import test from "node:test";
import assert from "node:assert/strict";
import { buildV13HypercomplexSemanticAnalysis } from "../src/v13-hypercomplex-semantic-analysis.js";

test("V13 builds a read-only hypercomplex semantic lens over .s1 archive signals", () => {
  const result = buildV13HypercomplexSemanticAnalysis({
    archiveStatus: { packetCount: 9, compressionRatio: 0.42, dbPath: "state/s1-archive.sqlite" },
    archiveInsights: {
      quantitative: {
        packetCount: 7,
        packetTypes: 3,
        routes: 2,
        models: 2,
        compressionRatio: 0.42
      },
      qualitative: {
        decodedWindow: 5,
        signedRatio: 0.8,
        proofRatio: 0.4,
        intentRatio: 0.6,
        stages: [{ label: "ING", count: 2 }, { label: "RUN", count: 1 }],
        labels: [{ label: "proof", count: 3 }, { label: "semantic", count: 2 }],
        motifs: [{ label: "proof | semantic | RUN", count: 4 }],
        cards: [{ id: "s1_a", packetType: "proof", route: "semantic", labels: ["proof"], summary: "proof card" }]
      }
    },
    recentPackets: [{ id: "s1_b", packetType: "intent", route: "semantic" }],
    topology: { nodes: [{ id: "netracer" }, { id: "node-a" }], edges: [{ from: "netracer", to: "node-a" }] },
    traffic: [{ id: "t1" }]
  });

  assert.equal(result.product, "netracer-v13-hypercomplex-semantic-analysis");
  assert.equal(result.non_destructive, true);
  assert.deepEqual(result.writes, []);
  assert.equal(result.substrate.read_only, true);
  assert.equal(result.substrate.archive_packets, 9);
  assert.equal(result.hypercomplex_semantics.strata.length, 5);
  assert.ok(result.hypercomplex_semantics.total_semantic_energy > 0);
  assert.ok(result.motifs.length >= 1);
  assert.ok(result.semantic_graph.summary.nodeCount > result.hypercomplex_semantics.strata.length);
  assert.ok(result.human_readout.some((line) => line.includes("active semantic carrier")));
  assert.equal(result.launch.view, "/v13/hypercomplex-semantic-analysis");
});
