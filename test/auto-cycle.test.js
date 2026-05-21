import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { AutoCycleManager } from "../src/auto-cycle.js";

test("AutoCycleManager runs one cycle and emits reroute alert", async () => {
  const events = new EventEmitter();
  const alerts = [];
  const broker = {
    async getStatusSummary(force) {
      assert.equal(force, true);
      return { upstreams: [{ id: "lmstudio", healthy: false, enabled: true, priority: 100 }, { id: "ollama", healthy: true, enabled: true, priority: 80 }] };
    },
    async listModels(force) {
      assert.equal(force, true);
      return [{ id: "ollama/model-b", raw_id: "model-b", provider: "ollama" }];
    }
  };
  const controlPlane = {
    getAutoCyclePolicy() {
      return { enabled: true, intervalMs: 15000, failoverChannels: true, failbackPreferred: true, forceModelRefresh: true };
    },
    getPolicies() {
      return { autoCycle: this.getAutoCyclePolicy() };
    },
    applyAutoCycleRuntime() {
      return {
        changed: true,
        actions: [{ channel: "a", reason: "failover", fromRuntimeId: "lmstudio", toRuntimeId: "ollama", modelReset: true }],
        policy: this.getAutoCyclePolicy()
      };
    }
  };
  const traceStore = {
    events,
    addAlert(alert) {
      alerts.push(alert);
    }
  };

  const manager = new AutoCycleManager({ broker, controlPlane, traceStore });
  const result = await manager.runOnce("test-run", "tester");

  assert.equal(result.changed, true);
  assert.equal(result.actions.length, 1);
  assert.equal(alerts.length, 1);
  const state = manager.getState();
  assert.equal(state.totalRuns, 1);
  assert.equal(state.totalActions, 1);
  manager.stop();
});

test("AutoCycleManager skips when disabled", async () => {
  const events = new EventEmitter();
  let called = false;
  const broker = {
    async getStatusSummary() {
      called = true;
      return { upstreams: [] };
    },
    async listModels() {
      called = true;
      return [];
    }
  };
  const controlPlane = {
    getAutoCyclePolicy() {
      return { enabled: false, intervalMs: 15000, failoverChannels: true, failbackPreferred: true, forceModelRefresh: true };
    },
    getPolicies() {
      return { autoCycle: this.getAutoCyclePolicy() };
    },
    applyAutoCycleRuntime() {
      return { changed: false, actions: [], policy: this.getAutoCyclePolicy() };
    }
  };
  const traceStore = { events, addAlert() {} };
  const manager = new AutoCycleManager({ broker, controlPlane, traceStore });
  const result = await manager.runOnce("test-disabled", "tester");

  assert.equal(result.skipped, "disabled");
  assert.equal(called, false);
  manager.stop();
});
