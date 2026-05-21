import { EventEmitter } from "node:events";
import path from "node:path";
import { collectScanTargets, expandFileToS1 } from "./ingress-expander.js";
import { S1_PACKET_TYPES } from "./packet.js";

const WS_OPEN = 1;

export class IngressOrchestrator {
  constructor({ config, traceStore, broker }) {
    this.config = config;
    this.traceStore = traceStore;
    this.broker = broker;
    this.events = new EventEmitter();

    this.queue = [];
    this.processing = false;
    this.socket = null;
    this.connecting = false;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;

    this.state = {
      status: "idle",
      localEndpoint: config.ingress?.localEndpoint || "",
      activeEndpoint: null,
      fallbackEndpoint: config.ingress?.notebookEndpoint || "",
      backend: "webgpu",
      validateLogic: false,
      reconnectAttempt: 0,
      queueDepth: 0,
      lastHeartbeatAt: null,
      lastError: null,
      lastJob: null,
      notebookUrl: ""
    };
  }

  getState() {
    return structuredClone(this.state);
  }

  async startSession(options = {}, actor = "operator") {
    this.state.localEndpoint = normalizeEndpoint(options.localEndpoint || this.state.localEndpoint || this.config.ingress.localEndpoint);
    this.state.fallbackEndpoint = normalizeEndpoint(options.notebookEndpoint || this.state.fallbackEndpoint || this.config.ingress.notebookEndpoint);
    this.state.notebookUrl = String(options.notebookUrl || this.state.notebookUrl || "").trim();
    this.state.backend = normalizeBackend(options.backend || this.state.backend || "webgpu");
    this.state.validateLogic = Boolean(options.validateLogic);
    this.state.status = "connecting";
    this.state.lastError = null;
    this.state.reconnectAttempt = 0;

    this.traceStore.addAudit({ type: "ingress-session-start", actor, state: this.getState(), timestamp: Date.now() });
    this.emitEvent("ingress-status", this.getState());

    await this.connectNow();
    return this.getState();
  }

  stopSession(actor = "operator") {
    this.clearReconnectTimer();
    this.clearHeartbeatTimer();
    this.closeSocket();
    this.state.status = "stopped";
    this.state.activeEndpoint = null;
    this.state.reconnectAttempt = 0;
    this.state.lastHeartbeatAt = null;
    this.traceStore.addAudit({ type: "ingress-session-stop", actor, timestamp: Date.now() });
    this.emitEvent("ingress-status", this.getState());
    return this.getState();
  }

  async enqueueScan(payload = {}, actor = "operator") {
    const include = normalizeInclude(payload.include);
    const job = {
      id: `ing_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      actor,
      createdAt: Date.now(),
      path: String(payload.path || "").trim(),
      recursive: payload.recursive !== false,
      include,
      hyperbolize: payload.hyperbolize !== false,
      validateLogic: payload.validateLogic == null ? this.state.validateLogic : Boolean(payload.validateLogic)
    };

    if (!job.path) {
      throw new Error("scan_path_required");
    }

    this.queue.push(job);
    this.state.queueDepth = this.queue.length;
    this.emitEvent("ingress-job-progress", { jobId: job.id, stage: "queued", queueDepth: this.state.queueDepth });

    if (!this.processing) {
      void this.processQueue();
    }

    return { jobId: job.id, queued: true, queueDepth: this.state.queueDepth, state: this.getState() };
  }

  async connectNow() {
    if (this.connecting || this.state.status === "stopped") {
      return;
    }
    this.connecting = true;

    try {
      const localEndpoint = normalizeEndpoint(this.state.localEndpoint);
      const fallbackEndpoint = normalizeEndpoint(this.state.fallbackEndpoint);
      const tried = [];

      const candidates = [
        { url: localEndpoint, label: "local" },
        { url: fallbackEndpoint, label: "fallback" }
      ].filter((item, index, all) => item.url && all.findIndex((other) => other.url === item.url) === index);

      for (const candidate of candidates) {
        tried.push(candidate.url);
        try {
          await this.connectWebSocket(candidate.url);
          this.state.status = "connected";
          this.state.activeEndpoint = candidate.url;
          this.state.reconnectAttempt = 0;
          this.state.lastError = null;
          this.state.lastHeartbeatAt = Date.now();
          this.emitEvent("ingress-status", this.getState());
          this.startHeartbeat();
          return;
        } catch (error) {
          this.state.lastError = error.message;
          this.emitEvent("ingress-error", { type: "connect-failed", endpoint: candidate.url, error: error.message, tried });
        }
      }

      this.state.status = "degraded";
      this.emitEvent("ingress-status", this.getState());
      this.scheduleReconnect(this.state.lastError || "connect_failed");
    } finally {
      this.connecting = false;
    }
  }

  async processQueue() {
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        this.state.queueDepth = this.queue.length;
        this.emitEvent("ingress-job-progress", { jobId: job.id, stage: "starting", queueDepth: this.state.queueDepth });
        try {
          const summary = await this.processJob(job);
          this.state.lastJob = summary;
          this.emitEvent("ingress-job-complete", summary);
        } catch (error) {
          const failure = {
            jobId: job.id,
            actor: job.actor,
            startedAt: Date.now(),
            completedAt: Date.now(),
            durationMs: 0,
            processed: 0,
            failed: 1,
            total: 0,
            skipped: [],
            path: path.resolve(job.path),
            hyperbolize: job.hyperbolize,
            validateLogic: job.validateLogic,
            error: error.message
          };
          this.state.lastJob = failure;
          this.emitEvent("ingress-error", { type: "job-failed", jobId: job.id, error: error.message });
          this.emitEvent("ingress-job-complete", failure);
        }
      }
    } finally {
      this.processing = false;
      this.state.queueDepth = this.queue.length;
    }
  }

  async processJob(job) {
    const startedAt = Date.now();
    const route = this.state.activeEndpoint ? `ingress:${safeRoute(this.state.activeEndpoint)}` : "ingress:local";

    const targets = collectScanTargets(job.path, {
      recursive: job.recursive,
      include: job.include,
      maxFiles: this.config.ingress.maxScanFiles,
      maxFileBytes: this.config.ingress.maxScanFileBytes
    });

    const intentPacket = this.broker.emitPacket({
      packetType: S1_PACKET_TYPES.INTENT,
      clientId: "ingress-operator",
      actor: job.actor,
      intent: `ingress-scan:${job.path}`,
      analysis: {
        promptType: "INGRESS_SCAN",
        tags: ["1|INGRESS", `mode|${job.hyperbolize ? "hyper" : "plain"}`],
        riskFlags: [],
        summary: `scan ${targets.files.length} file(s)`,
        digest: hashText(`${job.path}:${targets.files.length}`).slice(0, 16),
        routeHint: "semantic"
      },
      route,
      model: `ingress-${this.state.backend}`,
      metadata: {
        path: path.resolve(job.path),
        recursive: job.recursive,
        include: job.include,
        skipped: targets.skipped,
        fileCount: targets.files.length
      },
      stage: { name: "ING", score: 1, detail: "scan-start" }
    });

    let processed = 0;
    let failed = 0;
    const results = [];

    for (let index = 0; index < targets.files.length; index += 1) {
      const target = targets.files[index];
      try {
        const expanded = expandFileToS1({ filePath: target.path, hyperbolize: job.hyperbolize, backend: this.state.backend });
        if (job.validateLogic) {
          expanded.meta.logicValidation = await this.runLogicalValidation(expanded, job.actor);
        }
        const hyperbolicGraph = expanded.meta.hyperbolic
          ? {
              nodes: Object.entries(expanded.entities).map(([id, value]) => ({
                id,
                label: Array.isArray(value) ? String(value[0] || id) : String(id),
                kind: Array.isArray(value) ? String(value[1] || "node") : "node"
              })),
              edges: expanded.relations.map((relation) => {
                const [leftRight, kindPart] = String(relation).split(":");
                const [from, to] = leftRight.split("→").map((item) => String(item || "").trim());
                return { from, to, kind: String(kindPart || "related").trim() || "related" };
              }).filter((edge) => edge.from && edge.to),
              embedding: expanded.meta.hyperbolic
            }
          : null;

        const executionPacket = this.broker.emitPacket({
          packetType: S1_PACKET_TYPES.EXECUTION,
          clientId: "ingress-operator",
          actor: job.actor,
          intent: expanded.preview,
          analysis: {
            promptType: "INGRESS_FILE",
            tags: ["1|INGRESS", `kind|${expanded.kind}`],
            riskFlags: [],
            summary: expanded.preview,
            digest: expanded.meta.sha256.slice(0, 16),
            routeHint: "semantic"
          },
          route,
          model: `ingress-${this.state.backend}`,
          parents: [intentPacket.id],
          metadata: {
            jobId: job.id,
            index,
            total: targets.files.length,
            ...expanded.meta,
            hyperbolicGraph,
            graph: {
              entityCount: Object.keys(expanded.entities).length,
              relationCount: expanded.relations.length
            }
          },
          stage: { name: job.hyperbolize ? "GLU" : "INF", score: 1, detail: target.ext }
        });

        await this.pushPacketToEngine(executionPacket);
        results.push({ path: target.path, packetId: executionPacket.id, status: "ok" });
        processed += 1;
      } catch (error) {
        failed += 1;
        this.broker.emitPacket({
          packetType: S1_PACKET_TYPES.ALERT,
          clientId: "ingress-operator",
          actor: job.actor,
          route,
          model: `ingress-${this.state.backend}`,
          parents: [intentPacket.id],
          metadata: {
            jobId: job.id,
            path: target.path,
            error: error.message
          },
          stage: { name: "BLK", score: 0, detail: "scan-error" }
        });
        this.emitEvent("ingress-error", { type: "scan-error", jobId: job.id, path: target.path, error: error.message });
      }

      this.emitEvent("ingress-job-progress", {
        jobId: job.id,
        stage: "processing",
        processed,
        failed,
        total: targets.files.length,
        currentPath: target.path
      });
    }

    const proofPacket = this.broker.emitPacket({
      packetType: S1_PACKET_TYPES.PROOF,
      clientId: "ingress-operator",
      actor: job.actor,
      route,
      model: `ingress-${this.state.backend}`,
      parents: [intentPacket.id],
      metadata: {
        jobId: job.id,
        processed,
        failed,
        total: targets.files.length,
        durationMs: Date.now() - startedAt
      },
      stage: { name: failed > 0 ? "RLB" : "CMT", score: failed > 0 ? 0.7 : 1, detail: "scan-finish" }
    });

    this.broker.emitPacket({
      packetType: S1_PACKET_TYPES.SNAPSHOT,
      clientId: "ingress-operator",
      actor: job.actor,
      route,
      model: `ingress-${this.state.backend}`,
      parents: [proofPacket.id],
      metadata: {
        jobId: job.id,
        include: job.include,
        skipped: targets.skipped,
        resultPreview: results.slice(0, 20)
      }
    });

    return {
      jobId: job.id,
      actor: job.actor,
      startedAt,
      completedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      processed,
      failed,
      total: targets.files.length,
      skipped: targets.skipped,
      path: path.resolve(job.path),
      hyperbolize: job.hyperbolize,
      validateLogic: job.validateLogic,
      proofPacketId: proofPacket.id
    };
  }

  async pushPacketToEngine(packet) {
    const socket = this.socket;
    if (!socket || socket.readyState !== WS_OPEN) {
      return;
    }
    const envelope = JSON.stringify({ type: "s1_packet", packet });
    await new Promise((resolve, reject) => {
      try {
        socket.send(envelope);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async runLogicalValidation(expanded, actor) {
    if (!this.broker?.validateLogicalConsistency) {
      return inferLocalValidation(expanded.relations);
    }
    try {
      return await this.broker.validateLogicalConsistency({
        entities: expanded.entities,
        relations: expanded.relations,
        preview: expanded.preview,
        actor
      });
    } catch (error) {
      return { ...inferLocalValidation(expanded.relations), error: error.message, mode: "fallback-heuristic" };
    }
  }

  startHeartbeat() {
    this.clearHeartbeatTimer();
    this.heartbeatTimer = setInterval(() => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WS_OPEN) {
        this.handleSocketLoss("socket_not_open");
        return;
      }
      try {
        socket.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        this.state.lastHeartbeatAt = Date.now();
        this.emitEvent("ingress-heartbeat", {
          endpoint: this.state.activeEndpoint,
          at: this.state.lastHeartbeatAt,
          status: this.state.status
        });

        if (this.state.activeEndpoint && this.state.fallbackEndpoint && this.state.activeEndpoint === this.state.fallbackEndpoint && this.state.localEndpoint) {
          void this.tryPromoteToLocal();
        }
      } catch (error) {
        this.handleSocketLoss(error.message);
      }
    }, this.config.ingress.heartbeatMs);
  }

  async tryPromoteToLocal() {
    if (!this.state.localEndpoint || this.state.localEndpoint === this.state.activeEndpoint || this.connecting) {
      return;
    }
    try {
      await this.connectWebSocket(this.state.localEndpoint);
      this.state.activeEndpoint = this.state.localEndpoint;
      this.state.status = "connected";
      this.state.lastError = null;
      this.state.reconnectAttempt = 0;
      this.emitEvent("ingress-reconnect", {
        status: "promoted",
        endpoint: this.state.localEndpoint,
        reason: "local_recovered",
        at: Date.now()
      });
      this.emitEvent("ingress-status", this.getState());
    } catch {
      // Keep fallback session active.
    }
  }

  async connectWebSocket(endpoint) {
    if (typeof WebSocket === "undefined") {
      throw new Error("websocket_not_supported");
    }

    const url = normalizeEndpoint(endpoint);
    if (!url) {
      throw new Error("missing_endpoint");
    }

    const timeoutMs = this.config.ingress.connectTimeoutMs;

    const socket = await new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      let candidate;

      try {
        candidate = new WebSocket(url);
      } catch (error) {
        reject(error);
        return;
      }

      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        candidate.removeEventListener("open", onOpen);
        candidate.removeEventListener("error", onError);
        fn(value);
      };

      const onOpen = () => done(resolve, candidate);
      const onError = () => done(reject, new Error(`websocket_connect_failed:${url}`));

      candidate.addEventListener("open", onOpen);
      candidate.addEventListener("error", onError);

      timer = setTimeout(() => {
        done(reject, new Error(`websocket_connect_timeout:${url}`));
      }, timeoutMs);
    });

    this.closeSocket();
    this.socket = socket;

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data || "{}"));
        if (payload.type === "pong") {
          this.state.lastHeartbeatAt = Date.now();
          this.emitEvent("ingress-heartbeat", { endpoint: this.state.activeEndpoint, at: this.state.lastHeartbeatAt, status: "pong" });
        }
      } catch {
      }
    });

    socket.addEventListener("close", () => this.handleSocketLoss("socket_closed"));
    socket.addEventListener("error", () => this.handleSocketLoss("socket_error"));

    return socket;
  }

  handleSocketLoss(reason) {
    if (this.state.status === "stopped" || this.connecting) {
      return;
    }
    this.state.status = "degraded";
    this.state.lastError = reason;
    this.emitEvent("ingress-status", this.getState());
    this.scheduleReconnect(reason);
  }

  scheduleReconnect(reason) {
    if (this.reconnectTimer || this.state.status === "stopped") {
      return;
    }
    this.state.reconnectAttempt += 1;
    const delay = Math.min(
      this.config.ingress.maxReconnectMs,
      this.config.ingress.reconnectBaseMs * Math.pow(2, Math.max(0, this.state.reconnectAttempt - 1))
    );

    this.emitEvent("ingress-reconnect", {
      status: "scheduled",
      attempt: this.state.reconnectAttempt,
      delayMs: delay,
      reason,
      at: Date.now()
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectNow();
    }, delay);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  clearHeartbeatTimer() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  closeSocket() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
      }
      this.socket = null;
    }
  }

  emitEvent(type, payload) {
    this.events.emit(type, payload);
  }
}

function normalizeEndpoint(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  if (/^wss?:\/\//i.test(input)) return input;
  if (/^https?:\/\//i.test(input)) {
    return input.replace(/^http/i, "ws");
  }
  return `ws://${input}`;
}

function normalizeInclude(include) {
  if (Array.isArray(include)) {
    return include;
  }
  if (typeof include === "string") {
    return include.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeBackend(value) {
  const input = String(value || "").toLowerCase();
  if (["webgpu", "tpu", "tyngpu"].includes(input)) {
    return input;
  }
  return "webgpu";
}

function safeRoute(endpoint) {
  return String(endpoint || "local").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function hashText(text) {
  return Buffer.from(String(text || "")).toString("hex");
}

function inferLocalValidation(relations = []) {
  const contradictions = relations.filter((item) => /:contradicts$/.test(item)).length;
  if (relations.length === 0) {
    return { mode: "heuristic", status: "uncertain", score: 0.5, reason: "no_relations" };
  }
  if (contradictions > 0) {
    return { mode: "heuristic", status: "conflict", score: Number(Math.max(0.05, 1 - contradictions / Math.max(1, relations.length)).toFixed(3)), reason: "explicit_contradiction_edges" };
  }
  return { mode: "heuristic", status: "consistent", score: 0.81, reason: "no_contradictions_detected" };
}
