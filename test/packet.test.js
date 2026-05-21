import test from "node:test";
import assert from "node:assert/strict";
import { buildS1Packet } from "../src/packet.js";

test("buildS1Packet creates section envelope and digest", () => {
  const packet = buildS1Packet({
    clientId: "android",
    intent: "§S{label=topos}",
    analysis: {
      promptType: "SEMANTIC",
      tags: ["S"],
      riskFlags: [],
      summary: "test",
      digest: "abcd1234efef5678"
    },
    route: "semantic",
    model: "substrate-broker-local",
    metadata: {}
  });

  assert.equal(packet.version, "s1");
  assert.match(packet.envelope, /^§S1\{/u);
  assert.equal(packet.payload.route, "semantic");
  assert.equal(packet.digest.length, 64);
});
