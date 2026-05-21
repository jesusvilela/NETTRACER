export class AutoCycleManager {
  constructor({ broker, controlPlane, traceStore }) {
    this.broker = broker;
    this.controlPlane = controlPlane;
    this.traceStore = traceStore;

    this.timer = null;
    this.intervalMs = 0;
    this.nextRunAt = 0;
    this.inFlight = null;
    this.state = {
      running: false,
      lastRunAt: 0,
      lastDurationMs: 0,
      lastError: null,
      lastReason: null,
      lastActions: [],
      totalRuns: 0,
      totalActions: 0
    };

    this.traceStore.events.on("policy", () => this.refreshFromPolicy());
  }

  start() {
    const next = this.refreshFromPolicy();
    if (next.running) {
      void this.runOnce("startup", "autocycle");
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.intervalMs = 0;
    this.nextRunAt = 0;
    this.state.running = false;
  }

  refreshFromPolicy() {
    const policy = this.controlPlane.getAutoCyclePolicy
      ? this.controlPlane.getAutoCyclePolicy()
      : (this.controlPlane.getPolicies().autoCycle || {});
    const enabled = policy.enabled !== false;
    const intervalMs = Number(policy.intervalMs || 15000);

    if (!enabled) {
      this.stop();
      return this.getState();
    }

    const normalizedInterval = Math.max(3000, Math.min(10 * 60 * 1000, Math.floor(intervalMs)));
    if (this.timer && this.intervalMs === normalizedInterval) {
      this.state.running = true;
      return this.getState();
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.intervalMs = normalizedInterval;
    this.nextRunAt = Date.now() + this.intervalMs;
    this.timer = setInterval(() => {
      this.nextRunAt = Date.now() + this.intervalMs;
      void this.runOnce("interval", "autocycle");
    }, this.intervalMs);
    this.state.running = true;

    return this.getState();
  }

  async runOnce(reason = "manual", actor = "operator") {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.executeCycle(reason, actor).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async executeCycle(reason, actor) {
    const startedAt = Date.now();
    const policy = this.controlPlane.getAutoCyclePolicy
      ? this.controlPlane.getAutoCyclePolicy()
      : (this.controlPlane.getPolicies().autoCycle || {});
    const forceRefresh = policy.forceModelRefresh !== false;

    if (policy.enabled === false) {
      const payload = {
        at: startedAt,
        reason,
        changed: false,
        actions: [],
        skipped: "disabled",
        policy
      };
      this.state.lastRunAt = startedAt;
      this.state.lastDurationMs = 0;
      this.state.lastReason = reason;
      this.state.lastError = null;
      this.state.lastActions = [];
      this.state.totalRuns += 1;
      this.traceStore.events.emit("autocycle", payload);
      return payload;
    }

    try {
      const summary = await this.broker.getStatusSummary(forceRefresh);
      const models = await this.broker.listModels(forceRefresh);
      const result = this.controlPlane.applyAutoCycleRuntime(
        { upstreams: summary.upstreams || [], models: models || [] },
        actor
      );
      const durationMs = Date.now() - startedAt;
      const payload = {
        at: startedAt,
        reason,
        changed: result.changed === true,
        actions: result.actions || [],
        policy: result.policy || policy,
        durationMs
      };

      this.state.lastRunAt = startedAt;
      this.state.lastDurationMs = durationMs;
      this.state.lastReason = reason;
      this.state.lastError = null;
      this.state.lastActions = payload.actions;
      this.state.totalRuns += 1;
      this.state.totalActions += payload.actions.length;

      if (payload.actions.length > 0) {
        this.traceStore.addAlert({
          id: `alert_autocycle_${Date.now()}`,
          title: "Auto-cycle channel reroute",
          type: "autocycle-reroute",
          detail: `${payload.actions.length} channel updates`,
          actions: payload.actions,
          timestamp: Date.now()
        });
      }
      this.traceStore.events.emit("autocycle", payload);
      return payload;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      const payload = {
        at: startedAt,
        reason,
        changed: false,
        actions: [],
        error: message,
        durationMs,
        policy
      };
      this.state.lastRunAt = startedAt;
      this.state.lastDurationMs = durationMs;
      this.state.lastReason = reason;
      this.state.lastError = message;
      this.state.lastActions = [];
      this.state.totalRuns += 1;
      this.traceStore.events.emit("autocycle", payload);
      throw error;
    }
  }

  getState() {
    const policy = this.controlPlane.getAutoCyclePolicy
      ? this.controlPlane.getAutoCyclePolicy()
      : (this.controlPlane.getPolicies().autoCycle || {});
    return {
      ...this.state,
      running: Boolean(this.timer) && policy.enabled !== false,
      policy,
      intervalMs: this.intervalMs || Number(policy.intervalMs || 0),
      nextRunAt: this.nextRunAt
    };
  }
}
