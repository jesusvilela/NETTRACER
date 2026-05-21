import test from "node:test";
import assert from "node:assert/strict";
import { analyzePrompt } from "../src/analyzer.js";

test("analyzePrompt extracts tags and route hint", () => {
  const analysis = analyzePrompt({
    messages: [{ role: "user", content: "§9|HYPERVISOR §.(§S{label=test})" }]
  });

  assert.equal(analysis.promptType, "HYPERVISOR");
  assert.ok(analysis.tags.includes("9|HYPERVISOR"));
  assert.equal(analysis.routeHint, "strict");
});
