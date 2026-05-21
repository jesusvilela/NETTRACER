import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { IngressOrchestrator } from "../src/ingress-orchestrator.js";

function makeOrchestrator() {
  const emitted = [];
  const broker = {
    emitPacket(input) {
      const packet = {
        id: `pkt_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
        outboxPath: null,
        payload: { route: input.route }
      };
      emitted.push(input);
      return packet;
    },
    async validateLogicalConsistency() {
      return { mode: "test", status: "consistent", score: 1, reason: "stub" };
    }
  };

  const traceStore = { addAudit() {} };
  const config = {
    ingress: {
      localEndpoint: "ws://127.0.0.1:8765",
      notebookEndpoint: "",
      heartbeatMs: 1000,
      reconnectBaseMs: 1000,
      maxReconnectMs: 4000,
      connectTimeoutMs: 500,
      maxScanFiles: 20,
      maxScanFileBytes: 1024 * 1024
    }
  };

  return { orchestrator: new IngressOrchestrator({ config, traceStore, broker }), emitted };
}

test("IngressOrchestrator processes queued scan jobs", async () => {
  const { orchestrator, emitted } = makeOrchestrator();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-orch-"));
  const filePath = path.join(root, "sample.txt");
  fs.writeFileSync(filePath, "alpha beta gamma\nnext clause", "utf8");

  const completion = new Promise((resolve) => {
    orchestrator.events.once("ingress-job-complete", resolve);
  });

  const queued = await orchestrator.enqueueScan({
    path: root,
    recursive: true,
    include: [".txt"],
    hyperbolize: true,
    validateLogic: true
  }, "tester");

  assert.equal(queued.queued, true);
  const summary = await completion;
  assert.equal(summary.processed, 1);
  assert.equal(summary.failed, 0);
  assert.equal(summary.total, 1);
  assert.ok(emitted.length >= 3);
});
