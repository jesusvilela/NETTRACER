import { spawn } from "node:child_process";
import { analyzePrompt } from "./analyzer.js";
import { buildProofBundle, buildS1Packet, S1_PACKET_TYPES, writeS1Packet } from "./packet.js";
import { getSmartRoutingHint } from "./nnn-bridge.js";

export class Broker {
  constructor(config, traceStore, telemetry, controlPlane) {
    this.config = config;
    this.traceStore = traceStore;
    this.telemetry = telemetry;
    this.controlPlane = controlPlane;
    this.probeCache = new Map();
    this.modelCache = new Map();
    this.modelListCache = { checkedAt: 0, models: [], policyKey: "" };
    this.statusCache = { checkedAt: 0, summary: null };
    this.statusRefreshPromise = null;
    this.clientRegistry = new Map();
  }

  async brokerChatCompletion(requestBody, clientMeta = {}) {
    const analysis = analyzePrompt({ messages: requestBody.messages || [] });
    const routing = this.resolveRoutingPreferences(requestBody, analysis);
    if (this.getProxyPolicy().mode === "transparent") {
      return this.transparentProxyCompletion(requestBody, clientMeta, analysis, routing);
    }
    const startedAt = Date.now();
    const actor = clientMeta.session?.username || clientMeta.clientId || this.config.androidClientId;
    const selection = await this.selectRuntime(requestBody, routing.routeHint || analysis.routeHint, routing);
    const promptTokens = estimateTokensFromMessages(requestBody.messages || []);
    const host = await this.telemetry.sample();

    const intentPacket = this.emitPacket({
      packetType: S1_PACKET_TYPES.INTENT,
      clientId: clientMeta.clientId || this.config.androidClientId,
      actor,
      intent: requestBody.messages?.at(-1)?.content || "",
      analysis,
      route: selection.route,
      model: selection.model,
      metadata: { source: "chat.completions", stream: Boolean(requestBody.stream), runtimePlan: selection.tried, sdr: pickSdrMeta(routing) },
      stage: { name: "ING", score: 1, detail: analysis.summary },
      sigma: sigmaSummary({ semanticPreservation: true, branchDeterminacy: true }),
      kappa: kappaSummary({ promptTokens, tokenBudget: this.controlPlane.getPolicies().admission.maxPromptTokens })
    });

    const routePlanPacket = this.emitPacket({
      packetType: S1_PACKET_TYPES.ROUTE_PLAN,
      clientId: clientMeta.clientId || this.config.androidClientId,
      actor,
      analysis,
      route: selection.route,
      model: selection.model,
      parents: [intentPacket.id],
      metadata: { tried: selection.tried, host }
    });

    const admitted = promptTokens <= this.controlPlane.getPolicies().admission.maxPromptTokens && (selection.engine || this.controlPlane.getPolicies().admission.allowLocalFallback);
    const admissionPacket = this.emitPacket({
      packetType: S1_PACKET_TYPES.ADMISSION,
      clientId: clientMeta.clientId || this.config.androidClientId,
      actor,
      analysis,
      route: selection.route,
      model: selection.model,
      parents: [routePlanPacket.id],
      metadata: { admitted, promptTokens, sdr: pickSdrMeta(routing) },
      stage: { name: "CHK", score: admitted ? 1 : 0, detail: admitted ? "admitted" : "rejected" },
      sigma: sigmaSummary({ semanticPreservation: admitted, branchDeterminacy: admitted, auditReplayReady: true }),
      kappa: kappaSummary({ promptTokens, tokenBudget: this.controlPlane.getPolicies().admission.maxPromptTokens })
    });

    if (!admitted) {
      const message = "Admission blocked by token budget or runtime policy.";
      const blocked = await this.localAnalysisCompletion(requestBody, analysis, selection, host, message);
      this.recordTraffic(analysis, requestBody, blocked, startedAt, intentPacket.id, selection.route);
      const proof = buildProofBundle({
        terminal: "BLK",
        routePlan: selection.tried,
        stageTrace: [intentPacket.payload.stage, admissionPacket.payload.stage].filter(Boolean),
        sigma: admissionPacket.payload.sigma,
        kappa: admissionPacket.payload.kappa,
        gluing: { holds: false, obstruction: "admission-budget" },
        notes: [message]
      });
      this.emitPacket({
        packetType: S1_PACKET_TYPES.PROOF,
        clientId: clientMeta.clientId || this.config.androidClientId,
        actor,
        analysis,
        route: selection.route,
        model: selection.model,
        parents: [admissionPacket.id],
        proof,
        metadata: { terminal: "BLK" }
      });
      return blocked;
    }

    let completion;
    let terminal = "CMT";
    let note = "forwarded";
    try {
      completion = selection.engine
        ? await this.forwardToUpstream(selection.engine, requestBody, selection.model)
        : await this.localAnalysisCompletion(requestBody, analysis, selection, host, null);
    } catch (error) {
      terminal = "RLB";
      note = error.message;
      completion = await this.localAnalysisCompletion(requestBody, analysis, { ...selection, route: "local-fallback", model: this.config.defaultModel }, host, `Runtime fallback: ${error.message}`);
      this.traceStore.addAlert({ id: `alert_${Date.now()}`, title: "Runtime failover", type: "runtime-failover", route: selection.route, detail: error.message, timestamp: Date.now() });
      this.emitPacket({
        packetType: S1_PACKET_TYPES.ALERT,
        clientId: clientMeta.clientId || this.config.androidClientId,
        actor,
        analysis,
        route: selection.route,
        model: selection.model,
        parents: [routePlanPacket.id],
        metadata: { title: "Runtime failover", detail: error.message }
      });
    }

    const executionPacket = this.emitPacket({
      packetType: S1_PACKET_TYPES.EXECUTION,
      clientId: clientMeta.clientId || this.config.androidClientId,
      actor,
      analysis,
      route: terminal === "RLB" ? "local-fallback" : selection.route,
      model: completion.model,
      parents: [admissionPacket.id],
      metadata: {
        latencyMs: Date.now() - startedAt,
        completionPreview: completion.choices?.[0]?.message?.content?.slice(0, 180) || "",
        runtime: selection.engine?.id || "local",
        sdr: pickSdrMeta(routing)
      },
      stage: { name: terminal === "CMT" ? "CMT" : terminal, score: 1, detail: note }
    });

    const proof = buildProofBundle({
      terminal,
      routePlan: selection.tried,
      stageTrace: [intentPacket.payload.stage, admissionPacket.payload.stage, executionPacket.payload.stage].filter(Boolean),
      sigma: sigmaSummary({ semanticPreservation: true, chartCoverComplete: true, branchDeterminacy: true, auditReplayReady: true }),
      kappa: kappaSummary({ promptTokens, tokenBudget: this.controlPlane.getPolicies().admission.maxPromptTokens, completionTokens: completion.usage?.completion_tokens || 0 }),
      gluing: { holds: true, obstruction: null },
      notes: [note]
    });

    this.emitPacket({
      packetType: S1_PACKET_TYPES.PROOF,
      clientId: clientMeta.clientId || this.config.androidClientId,
      actor,
      analysis,
      route: terminal === "RLB" ? "local-fallback" : selection.route,
      model: completion.model,
      parents: [executionPacket.id],
      proof,
      metadata: { terminal }
    });

    this.recordTraffic(analysis, requestBody, completion, startedAt, intentPacket.id, terminal === "RLB" ? "local-fallback" : selection.route);
    this.traceStore.addTrace({
      id: intentPacket.id,
      packet: intentPacket,
      outboxPath: pathSafe(intentPacket),
      broker: { routeHint: routing.routeHint || analysis.routeHint, upstream: selection.engine?.id || null, tried: selection.tried, latencyMs: Date.now() - startedAt, terminal, sdr: pickSdrMeta(routing) },
      completion
    });

    return completion;
  }

  async createIntentPack(body, clientMeta = {}) {
    const actor = clientMeta.session?.username || clientMeta.clientId || body.clientId || this.config.androidClientId;
    const analysis = analyzePrompt({ messages: body.messages || [], packet: body.packet || null });
    const routing = this.resolveRoutingPreferences(body, analysis);
    const selection = await this.selectRuntime(body, body.route || routing.routeHint || analysis.routeHint, routing);
    const packet = this.emitPacket({
      packetType: S1_PACKET_TYPES.INTENT,
      clientId: clientMeta.clientId || body.clientId || this.config.androidClientId,
      actor,
      intent: body.intent || body.packet?.payload?.intent || body.messages?.at(-1)?.content || "",
      analysis,
      route: body.route || selection.route,
      model: body.model || selection.model,
      metadata: { ...(body.metadata || {}), sdr: pickSdrMeta(routing) },
      labels: ["manual"]
    });
    return { packet, filePath: pathSafe(packet) };
  }

  emitPacket(packetInput) {
    const packet = buildS1Packet({ ...packetInput, security: { signingKey: this.config.signingKey } });
    let outboxPath = null;
    try {
      outboxPath = writeS1Packet(packet, this.config.outboxDir);
    } catch (error) {
      this.traceStore.addAlert?.({
        id: `alert_outbox_${Date.now()}`,
        title: "Outbox persistence degraded",
        type: "outbox-persist-failed",
        detail: error.message,
        packetId: packet.id,
        timestamp: Date.now()
      });
    }
    this.traceStore.addPacket({ ...packet, outboxPath });
    return { ...packet, outboxPath };
  }

  async replayPacket(packetId, actor = "operator") {
    const packet = this.traceStore.getPacket(packetId);
    if (!packet) {
      throw new Error("Packet not found");
    }
    const replay = this.emitPacket({
      packetType: S1_PACKET_TYPES.AUDIT,
      clientId: packet.clientId,
      actor,
      route: packet.payload.route,
      model: packet.payload.model,
      parents: [packet.id],
      metadata: { action: "replay", lineage: this.traceStore.getPacketLineage(packetId).map((item) => item.id) }
    });
    return replay;
  }

  async getStatusSummary(force = false, options = {}) {
    const now = Date.now();
    const allowStale = options.allowStale !== false;
    if (force) {
      return this.refreshStatusSummary(true);
    }
    if (this.statusCache.summary && now - this.statusCache.checkedAt < this.config.statusSummaryTtlMs) {
      return this.statusCache.summary;
    }
    if (this.statusCache.summary && allowStale) {
      this.scheduleStatusRefresh(false);
      return {
        ...this.statusCache.summary,
        degraded: true,
        recovery: {
          ...(this.statusCache.summary.recovery || {}),
          source: "stale-status-cache",
          checkedAt: this.statusCache.checkedAt,
          refreshing: true
        }
      };
    }
    if (this.statusRefreshPromise) {
      return this.statusRefreshPromise;
    }
    return this.refreshStatusSummary(false);
  }

  scheduleStatusRefresh(force = false) {
    if (force) {
      return this.refreshStatusSummary(true);
    }
    if (this.statusRefreshPromise) {
      return this.statusRefreshPromise;
    }
    const refreshPromise = this.refreshStatusSummary(false)
      .catch(() => this.statusCache.summary)
      .finally(() => {
        if (this.statusRefreshPromise === refreshPromise) {
          this.statusRefreshPromise = null;
        }
      });
    this.statusRefreshPromise = refreshPromise;
    return refreshPromise;
  }

  async refreshStatusSummary(force = false) {
    const now = Date.now();
    try {
      const proxy = this.getProxyPolicy();
      const forceDiscovery = force || proxy.modelDiscovery === "active";
      const telemetry = await this.safeTelemetrySample();
      const discoveries = await this.discoverUpstreams(forceDiscovery);
      const clients = this.listObservedClients(now);
      const upstreams = discoveries.map(({ engine, probe, models }) => ({
        id: engine.id,
        baseUrl: engine.baseUrl,
        model: engine.model,
        priority: engine.priority,
        healthy: probe.healthy,
        checkedAt: probe.checkedAt,
        error: probe.error || null,
        modelCount: models.length,
        enabled: this.controlPlane.isRuntimeEnabled(engine.id)
      }));
      const models = await this.listModels(forceDiscovery, discoveries);
      const topology = this.controlPlane.updateTopology({ upstreams, models, clients });
      const summary = {
        defaultModel: this.config.defaultModel,
        hostHints: this.config.hostHints,
        telemetry,
        policies: this.controlPlane.getPolicies(),
        topology,
        upstreams,
        clients,
        commandEngines: this.config.commandEngines.map((item) => ({ id: item.id, command: item.command })),
        degraded: upstreams.some((item) => !item.healthy)
      };
      this.statusCache = { checkedAt: Date.now(), summary };
      return summary;
    } catch (error) {
      if (this.statusCache.summary) {
        return {
          ...this.statusCache.summary,
          degraded: true,
          recovery: {
            source: "stale-status-cache",
            error: error.message,
            checkedAt: this.statusCache.checkedAt
          }
        };
      }
      const fallback = {
        defaultModel: this.config.defaultModel,
        hostHints: this.config.hostHints,
        telemetry: await this.safeTelemetrySample(),
        policies: this.controlPlane.getPolicies(),
        topology: this.controlPlane.getTopology(),
        upstreams: [],
        clients: this.listObservedClients(now),
        commandEngines: this.config.commandEngines.map((item) => ({ id: item.id, command: item.command })),
        degraded: true,
        recovery: {
          source: "bootstrap-fallback",
          error: error.message
        }
      };
      this.statusCache = { checkedAt: Date.now(), summary: fallback };
      return fallback;
    }
  }

  observeClient(clientMeta = {}, requestMeta = {}) {
    let clientId = String(clientMeta.clientId || "").trim();
    const userAgent = String(requestMeta.userAgent || clientMeta.userAgent || "");
    const label = String(clientMeta.label || "");

    // Linking heuristic for topostrago Android app nodes
    // clientId might be an auto-generated fingerprint (e.g. "chat:123456"). Override it if userAgent matches.
    if ((userAgent.includes("topostrago") || label.includes("BabyToposAI")) && (!clientId || clientId.includes(":"))) {
      clientId = "topostrago:agent";
    }

    if (!clientId) return null;
    const now = Date.now();
    const existing = this.clientRegistry.get(clientId);
    const record = {
      id: clientId,
      label: String(clientMeta.label || existing?.label || clientId),
      transport: String(requestMeta.transport || existing?.transport || "http"),
      remoteAddress: String(requestMeta.remoteAddress || existing?.remoteAddress || ""),
      userAgent: userAgent || existing?.userAgent || "",
      sessionUser: String(clientMeta.session?.username || existing?.sessionUser || ""),
      scope: String(requestMeta.scope || existing?.scope || ""),
      methods: mergeStringList(existing?.methods, [requestMeta.method]),
      paths: mergeStringList(existing?.paths, [requestMeta.path]),
      subscriptions: mergeStringList(existing?.subscriptions, requestMeta.subscriptions),
      firstSeenAt: existing?.firstSeenAt || new Date(now).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      lastSeenAtMs: now,
      healthy: true
    };
    const changed = !existing || clientRecordSignature(existing) !== clientRecordSignature(record);
    this.clientRegistry.set(clientId, record);
    const pruned = this.pruneObservedClients(now);
    if (changed || pruned) {
      this.refreshTopologyFromCache(now);
    }
    return structuredClone(record);
  }

  listObservedClients(now = Date.now()) {
    this.pruneObservedClients(now);
    return [...this.clientRegistry.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => structuredClone(item));
  }

  pruneObservedClients(now = Date.now()) {
    let changed = false;
    for (const [clientId, record] of this.clientRegistry.entries()) {
      if (now - Number(record?.lastSeenAtMs || 0) <= this.config.clientPresenceTtlMs) continue;
      this.clientRegistry.delete(clientId);
      changed = true;
    }
    return changed;
  }

  refreshTopologyFromCache(now = Date.now()) {
    const cachedSummary = this.statusCache.summary;
    if (!cachedSummary) return;
    const models = Array.isArray(this.modelListCache.models) ? this.modelListCache.models : [];
    const clients = this.listObservedClients(now);
    const topology = this.controlPlane.updateTopology({
      upstreams: cachedSummary.upstreams || [],
      models,
      clients
    });
    this.statusCache.summary = {
      ...cachedSummary,
      clients,
      topology
    };
  }

  buildRoutePlan(routeHint, preferredRuntimeId = null) {
    const plan = [];
    if (this.config.commandEngines.length > 0 && routeHint === "strict") {
      for (const engine of this.config.commandEngines) {
        plan.push({ ...engine, type: "command", priority: 1000 });
      }
    }
    for (const upstream of this.config.upstreams) {
      plan.push({ ...upstream, type: "upstream" });
    }
    const filtered = this.controlPlane.applyRoutePolicy(plan.sort((a, b) => (b.priority || 0) - (a.priority || 0)));
    if (preferredRuntimeId) {
      const preferred = filtered.find((item) => item.id === preferredRuntimeId);
      if (preferred) {
        return [preferred, ...filtered.filter((item) => item.id !== preferredRuntimeId)];
      }
    }
    return filtered;
  }

  async selectRuntime(requestBody, routeHint, routing = {}) {
    const plan = this.buildRoutePlan(routeHint, routing.preferredRuntimeId || null);
    const tried = [];
    const requestedModel = routing.preferredModel || requestBody.model;

    // Hyperbolic Smart Routing Integration
    const clientId = requestBody.clientId || routing.clientId;
    if (clientId && (clientId.startsWith("topostrago:") || clientId.startsWith("nodemsg_"))) {
      const availableSubstrates = plan.filter(p => p.type === "upstream").map(p => p.id);
      const hint = await getSmartRoutingHint(clientId, availableSubstrates);
      if (hint && hint.best_substrate) {
        const preferred = plan.find(p => p.id === hint.best_substrate);
        if (preferred) {
          const others = plan.filter(p => p.id !== hint.best_substrate);
          plan.length = 0;
          plan.push(preferred, ...others);
        }
      }
    }

    for (const candidate of plan) {
      if (candidate.type === "command") {
        tried.push({ id: candidate.id, kind: "command", healthy: true, reason: "selected" });
        return { engine: candidate, route: candidate.id, model: candidate.id, tried };
      }
      const probe = await this.probeUpstream(candidate);
      tried.push({ id: candidate.id, kind: candidate.kind || "openai", healthy: probe.healthy, reason: probe.error || "ok" });
      if (probe.healthy) {
        const model = await this.resolveModelForUpstream(candidate, requestedModel);
        return { engine: candidate, route: candidate.id, model, tried };
      }
    }
    return { engine: null, route: "local-fallback", model: requestedModel || this.config.defaultModel, tried };
  }

  async listModels(force = false, discoveries = null) {
    const proxy = this.getProxyPolicy();
    const sdr = this.getSdrPolicy();
    const channelFingerprint = JSON.stringify(Object.entries(sdr.channels || {}).sort((a, b) => a[0].localeCompare(b[0])));
    const policyKey = `${proxy.mode}|${proxy.runtimeId || ""}|${proxy.modelLimit}|${proxy.modelDiscovery}|${proxy.exposeIdMode}|${sdr.enabled}|${sdr.defaultChannel || ""}|${channelFingerprint}`;
    const now = Date.now();
    if (!force && this.modelListCache.policyKey === policyKey && this.modelListCache.models.length > 0 && now - this.modelListCache.checkedAt < this.config.modelListTtlMs) {
      return this.modelListCache.models;
    }
    const aggregate = new Map();
    if (proxy.mode !== "transparent") {
      aggregate.set(this.config.defaultModel, { id: this.config.defaultModel, object: "model", owned_by: "netracer", provider: "broker", context_length: 8192, broker_default: true });
    }

    const forceDiscovery = force || proxy.modelDiscovery === "active";
    const discovered = Array.isArray(discoveries)
      ? discoveries
      : await this.discoverUpstreams(forceDiscovery);
    for (const item of discovered) {
      const upstream = item.engine;
      if (!this.controlPlane.isRuntimeEnabled(upstream.id)) continue;
      if (proxy.runtimeId && upstream.id !== proxy.runtimeId) continue;
      if (!item.probe.healthy) continue;
      const models = item.models;
      for (const model of models) {
        const aliasedId = proxy.exposeIdMode === "native" ? model.id : `${upstream.id}/${model.id}`;
        aggregate.set(aliasedId, {
          ...model,
          id: aliasedId,
          raw_id: model.id,
          provider: upstream.id,
          base_url: upstream.baseUrl,
          broker_default: false,
          transparent_proxy: proxy.mode === "transparent"
        });
      }
    }
    if (sdr.enabled) {
      for (const [name, channel] of Object.entries(sdr.channels || {})) {
        if (channel?.enabled === false) continue;
        aggregate.set(name, {
          id: name,
          object: "model",
          owned_by: "netracer",
          provider: "sdr",
          context_length: 8192,
          broker_default: false,
          channel: name,
          channel_runtime: channel.runtimeId,
          channel_model: channel.model || null,
          channel_op: channel.op || "semantic"
        });
      }
    }
    const models = [...aggregate.values()].slice(0, proxy.modelLimit || 64);
    this.modelListCache = { checkedAt: now, models, policyKey };
    return models;
  }

  async resolveModelForUpstream(upstream, requestedModel) {
    if (requestedModel && requestedModel !== this.config.defaultModel) {
      const value = String(requestedModel);
      if (value.startsWith(`${upstream.id}/`)) {
        return value.slice(upstream.id.length + 1);
      }
      return value;
    }
    if (upstream.model) return upstream.model;
    const models = await this.fetchUpstreamModels(upstream, false);
    return models[0]?.id || requestedModel || this.config.defaultModel;
  }

  async fetchUpstreamModels(upstream, force = false) {
    const cached = this.modelCache.get(upstream.id);
    const now = Date.now();
    if (!force && cached && now - cached.checkedAt < this.config.probeTtlMs) return cached.models;
    const models = [];
    try {
      const response = await this.fetchWithTimeout(new URL("/v1/models", upstream.baseUrl), { method: "GET" }, this.config.upstreamModelTimeoutMs);
      if (response.ok) {
        const payload = await response.json();
        for (const item of payload.data || []) {
          models.push({ id: item.id, object: item.object || "model", owned_by: item.owned_by || upstream.id, context_length: item.context_length || 8192 });
        }
      }
    } catch {
    }
    if (models.length === 0 && upstream.kind === "ollama") {
      try {
        const response = await this.fetchWithTimeout(new URL("/api/tags", upstream.baseUrl), { method: "GET" }, this.config.upstreamModelTimeoutMs);
        if (response.ok) {
          const payload = await response.json();
          for (const model of payload.models || []) {
            models.push({ id: model.name, object: "model", owned_by: upstream.id, context_length: 8192 });
          }
        }
      } catch {
      }
    }
    if (models.length === 0 && cached?.models?.length) {
      return cached.models;
    }
    if (models.length === 0 && upstream.model) {
      models.push({ id: upstream.model, object: "model", owned_by: upstream.id, context_length: 8192 });
    }
    this.modelCache.set(upstream.id, { checkedAt: now, models });
    return models;
  }

  async probeUpstream(upstream, force = false) {
    const cached = this.probeCache.get(upstream.id);
    const now = Date.now();
    if (!force && cached && now - cached.checkedAt < this.config.probeTtlMs) return cached;
    try {
      const response = await this.fetchWithTimeout(
        new URL(upstream.healthPath || "/v1/models", upstream.baseUrl),
        { method: "GET", headers: { "content-type": "application/json" } },
        this.config.upstreamProbeTimeoutMs
      );
      const result = { healthy: response.ok, checkedAt: now, error: response.ok ? null : `HTTP ${response.status}` };
      this.probeCache.set(upstream.id, result);
      return result;
    } catch (error) {
      const result = { healthy: false, checkedAt: now, error: normalizeFetchError(error, this.config.upstreamProbeTimeoutMs) };
      this.probeCache.set(upstream.id, result);
      return result;
    }
  }

  async forwardToUpstream(upstream, requestBody, resolvedModel) {
    if (upstream.command) return this.runCommandEngine(upstream, requestBody);
    const upstreamBody = {
      ...requestBody,
      stream: false,
      model: resolvedModel || upstream.model || requestBody.model || this.config.defaultModel
    };
    const response = await this.fetchWithTimeout(new URL("/v1/chat/completions", upstream.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(upstreamBody)
    }, this.config.upstreamCompletionTimeoutMs);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upstream ${upstream.id} failed: ${response.status} ${text}`);
    }
    return response.json();
  }

  getProxyPolicy() {
    return this.controlPlane.getPolicies().proxy || {
      mode: "orchestrated",
      runtimeId: null,
      modelLimit: 64,
      modelDiscovery: "cached",
      exposeIdMode: "prefixed"
    };
  }

  getSdrPolicy() {
    return this.controlPlane.getPolicies().sdr || {
      enabled: false,
      defaultChannel: null,
      channels: {},
      sectionOps: {
        enabled: false,
        allowPromptDirective: false
      }
    };
  }

  resolveRoutingPreferences(requestBody = {}, analysis = null) {
    const sdr = this.getSdrPolicy();
    const result = {
      channel: null,
      op: null,
      preferredRuntimeId: null,
      preferredModel: null,
      routeHint: null,
      source: null
    };

    if (!sdr.enabled) {
      return result;
    }

    const rawModel = String(requestBody.model || "").trim();
    const directive = parseSectionRoutingDirective(requestBody.messages || [], sdr.sectionOps?.allowPromptDirective !== false);

    let channelName = normalizeChannelAlias(requestBody.channel || "");
    if (!channelName && rawModel && sdr.channels?.[rawModel]) channelName = rawModel;
    if (!channelName && rawModel.startsWith("channel/")) channelName = normalizeChannelAlias(rawModel.slice("channel/".length));
    if (!channelName && directive.channel) channelName = directive.channel;
    if (!channelName && sdr.defaultChannel) channelName = sdr.defaultChannel;

    if (channelName && sdr.channels?.[channelName]) {
      const channel = sdr.channels[channelName];
      if (channel?.enabled !== false) {
        result.channel = channelName;
        result.preferredRuntimeId = channel.runtimeId || null;
        result.preferredModel = channel.model || null;
        result.source = rawModel === channelName ? "model-alias" : requestBody.channel ? "request-channel" : directive.channel ? "section-directive" : "default-channel";
        result.op = normalizeSectionOp(directive.op || channel.op || null);
      }
    }

    if (!result.op && directive.op) {
      result.op = normalizeSectionOp(directive.op);
      result.source = result.source || "section-directive";
    }

    if (!result.preferredModel && rawModel && !sdr.channels?.[rawModel]) {
      result.preferredModel = rawModel;
    }

    if (result.op) {
      result.routeHint = mapSectionOpToRouteHint(result.op);
    } else if (analysis?.routeHint) {
      result.routeHint = analysis.routeHint;
    }

    return result;
  }

  async transparentProxyCompletion(requestBody, clientMeta = {}, analysis = null, routing = null) {
    const startedAt = Date.now();
    const actor = clientMeta.session?.username || clientMeta.clientId || this.config.androidClientId;
    const resolvedAnalysis = analysis || analyzePrompt({ messages: requestBody.messages || [] });
    const resolvedRouting = routing || this.resolveRoutingPreferences(requestBody, resolvedAnalysis);
    const target = await this.resolveTransparentTarget(requestBody.model, resolvedRouting);
    const promptTokens = estimateTokensFromMessages(requestBody.messages || []);

    const intentPacket = this.emitPacket({
      packetType: S1_PACKET_TYPES.INTENT,
      clientId: clientMeta.clientId || this.config.androidClientId,
      actor,
      intent: requestBody.messages?.at(-1)?.content || "",
      analysis: resolvedAnalysis,
      route: target.route,
      model: target.model,
      metadata: {
        source: "chat.completions",
        stream: Boolean(requestBody.stream),
        mode: "transparent-proxy",
        sdr: pickSdrMeta(resolvedRouting)
      },
      stage: { name: "ING", score: 1, detail: "transparent-proxy" }
    });

    let completion;
    try {
      completion = await this.forwardToUpstream(target.engine, requestBody, target.model);
    } catch (error) {
      this.emitPacket({
        packetType: S1_PACKET_TYPES.ALERT,
        clientId: clientMeta.clientId || this.config.androidClientId,
        actor,
        analysis: resolvedAnalysis,
        route: target.route,
        model: target.model,
        parents: [intentPacket.id],
        metadata: {
          mode: "transparent-proxy",
          title: "Transparent proxy upstream failure",
          detail: error.message
        },
        stage: { name: "RLB", score: 0, detail: "upstream-failed" }
      });
      throw error;
    }

    const executionPacket = this.emitPacket({
      packetType: S1_PACKET_TYPES.EXECUTION,
      clientId: clientMeta.clientId || this.config.androidClientId,
      actor,
      analysis: resolvedAnalysis,
      route: target.route,
      model: completion.model || target.model,
      parents: [intentPacket.id],
      metadata: {
        mode: "transparent-proxy",
        latencyMs: Date.now() - startedAt,
        runtime: target.engine.id,
        sdr: pickSdrMeta(resolvedRouting)
      },
      stage: { name: "CMT", score: 1, detail: "transparent-forwarded" },
      kappa: kappaSummary({ promptTokens, tokenBudget: this.controlPlane.getPolicies().admission.maxPromptTokens, completionTokens: completion.usage?.completion_tokens || 0 })
    });

    this.emitPacket({
      packetType: S1_PACKET_TYPES.PROOF,
      clientId: clientMeta.clientId || this.config.androidClientId,
      actor,
      analysis: resolvedAnalysis,
      route: target.route,
      model: completion.model || target.model,
      parents: [executionPacket.id],
      metadata: {
        mode: "transparent-proxy",
        terminal: "CMT"
      }
    });

    this.recordTraffic(resolvedAnalysis, requestBody, completion, startedAt, intentPacket.id, target.route);
    return completion;
  }

  async resolveTransparentTarget(requestedModel, routing = {}) {
    const proxy = this.getProxyPolicy();
    const enabledUpstreams = this.config.upstreams.filter((item) => this.controlPlane.isRuntimeEnabled(item.id));
    const byId = new Map(enabledUpstreams.map((item) => [item.id, item]));
    let runtimeId = routing.preferredRuntimeId || null;
    let nativeModel = routing.preferredModel || (requestedModel ? String(requestedModel) : "");

    if (nativeModel.includes("/")) {
      const parts = nativeModel.split("/");
      if (parts.length > 1 && byId.has(parts[0])) {
        runtimeId = parts[0];
        nativeModel = parts.slice(1).join("/");
      }
    }

    if (!runtimeId && proxy.runtimeId && byId.has(proxy.runtimeId)) {
      runtimeId = proxy.runtimeId;
    }

    if (!runtimeId && nativeModel) {
      const known = await this.listModels(false);
      const match = known.find((item) => item.id === nativeModel);
      if (match?.provider && byId.has(match.provider)) {
        runtimeId = match.provider;
        nativeModel = match.raw_id || nativeModel;
      }
    }

    let engine = runtimeId ? byId.get(runtimeId) : null;
    if (!engine) {
      for (const candidate of enabledUpstreams.sort((a, b) => (b.priority || 0) - (a.priority || 0))) {
        const probe = await this.probeUpstream(candidate);
        if (probe.healthy) {
          engine = candidate;
          break;
        }
      }
    }

    if (!engine) {
      throw new Error("transparent_proxy_no_healthy_runtime");
    }

    if (!nativeModel || nativeModel === this.config.defaultModel) {
      nativeModel = await this.resolveModelForUpstream(engine, "");
    }

    return { engine, route: engine.id, model: nativeModel };
  }

  async localAnalysisCompletion(requestBody, analysis, selection, host, extraNote) {
    const userPrompt = requestBody.messages?.at(-1)?.content || "";
    const content = [
      `§BROKER{route=${analysis.routeHint},runtime=${selection.route},promptType=${analysis.promptType},digest=${analysis.digest}}`,
      `tags=${analysis.tags.join("|") || "none"}`,
      `risk=${analysis.riskFlags.join("|") || "none"}`,
      `summary=${analysis.summary || "empty"}`,
      `host=gpu:${host.gpu.name}|freeMb:${host.gpu.freeMb}|ramFreeMb:${host.memory.freeMb}`,
      extraNote ? `note=${extraNote}` : null,
      `intent=${userPrompt.slice(0, 800)}`
    ].filter(Boolean).join("\n");
    return {
      id: `chatcmpl_local_${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: selection.model || this.config.defaultModel,
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
      usage: { prompt_tokens: estimateTokensFromMessages(requestBody.messages || []), completion_tokens: estimateTokens(content), total_tokens: estimateTokensFromMessages(requestBody.messages || []) + estimateTokens(content) }
    };
  }

  async validateLogicalConsistency({ entities = {}, relations = [], preview = "", actor = "operator" } = {}) {
    if (!Array.isArray(relations) || relations.length === 0) {
      return { mode: "heuristic", status: "uncertain", score: 0.5, reason: "no_relations" };
    }

    const localHint = inferLogicalStatus(relations);
    const requestBody = {
      model: this.config.defaultModel,
      stream: false,
      messages: [
        {
          role: "system",
          content: "Return one line as STATUS:<consistent|uncertain|conflict>;SCORE:<0..1>;REASON:<short>. Evaluate relation consistency."
        },
        {
          role: "user",
          content: [
            `actor=${actor}`,
            `entity_count=${Object.keys(entities).length}`,
            `relation_count=${relations.length}`,
            `preview=${preview || ""}`,
            `relations=${relations.slice(0, 80).join(" | ")}`
          ].join("\n")
        }
      ]
    };

    try {
      const selection = await this.selectRuntime(requestBody, "semantic", {});
      if (!selection.engine) {
        return { ...localHint, mode: "heuristic", reason: "local_runtime_unavailable" };
      }
      const completion = await this.forwardToUpstream(selection.engine, requestBody, selection.model);
      const content = completion.choices?.[0]?.message?.content || "";
      const parsed = parseValidationResponse(content);
      return {
        mode: "ai-runtime",
        runtime: selection.route,
        status: parsed.status || localHint.status,
        score: parsed.score ?? localHint.score,
        reason: parsed.reason || "runtime_evaluation"
      };
    } catch (error) {
      return {
        ...localHint,
        mode: "heuristic",
        reason: `runtime_error:${error.message}`
      };
    }
  }

  recordTraffic(analysis, requestBody, completion, startedAt, packetId, route) {
    this.traceStore.addTraffic({
      timestamp: startedAt,
      direction: "TO_SUBSTRATE",
      promptType: analysis.promptType,
      systemPromptSummary: summarizeSystemPrompt(requestBody.messages || []),
      userPrompt: requestBody.messages?.at(-1)?.content || "",
      response: "",
      promptTokens: estimateTokensFromMessages(requestBody.messages || []),
      completionTokens: 0,
      latencyMs: 0,
      model: completion.model,
      packetId,
      route,
      routeHint: analysis.routeHint
    });
    this.traceStore.addTraffic({
      timestamp: Date.now(),
      direction: "FROM_SUBSTRATE",
      promptType: analysis.promptType,
      systemPromptSummary: "",
      userPrompt: requestBody.messages?.at(-1)?.content || "",
      response: completion.choices?.[0]?.message?.content || "",
      promptTokens: completion.usage?.prompt_tokens || 0,
      completionTokens: completion.usage?.completion_tokens || 0,
      latencyMs: Date.now() - startedAt,
      model: completion.model,
      packetId,
      route,
      routeHint: analysis.routeHint
    });
  }

  runCommandEngine(engine, requestBody) {
    return new Promise((resolve, reject) => {
      const child = spawn(engine.command, engine.args || [], { stdio: ["pipe", "pipe", "pipe"], shell: false });
      const chunks = [];
      const errors = [];
      const timeoutMs = Math.max(1000, Number(this.config.commandEngineTimeoutMs || 120000));
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Command engine ${engine.id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      child.stdout.on("data", (chunk) => chunks.push(chunk));
      child.stderr.on("data", (chunk) => errors.push(chunk));
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(Buffer.concat(errors).toString("utf8") || `Command engine exited with ${code}`));
          return;
        }
        const output = Buffer.concat(chunks).toString("utf8").trim();
        resolve({ id: `chatcmpl_cmd_${Date.now()}`, object: "chat.completion", created: Math.floor(Date.now() / 1000), model: engine.id, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: output } }], usage: { prompt_tokens: estimateTokensFromMessages(requestBody.messages || []), completion_tokens: estimateTokens(output), total_tokens: estimateTokensFromMessages(requestBody.messages || []) + estimateTokens(output) } });
      });
      child.stdin.write(JSON.stringify(requestBody));
      child.stdin.end();
    });
  }

  async discoverUpstreams(force = false) {
    return Promise.all(this.config.upstreams.map(async (engine) => {
      const [probe, models] = await Promise.all([
        this.probeUpstream(engine, force),
        this.fetchUpstreamModels(engine, force)
      ]);
      return { engine, probe, models };
    }));
  }

  async safeTelemetrySample() {
    try {
      return await this.telemetry.sample();
    } catch (error) {
      return {
        gpu: { name: "unknown", freeMb: 0 },
        memory: { freeMb: 0 },
        degraded: true,
        error: error.message
      };
    }
  }

  fetchWithTimeout(url, options = {}, timeoutMs = 1500) {
    const controller = new AbortController();
    const onAbort = () => controller.abort(options.signal?.reason);
    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort(options.signal.reason);
      } else {
        options.signal.addEventListener("abort", onAbort, { once: true });
      }
    }
    const timer = setTimeout(() => controller.abort(Object.assign(new Error(`timeout_after_${timeoutMs}ms`), { name: "AbortError" })), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
    });
  }
}

function summarizeSystemPrompt(messages) {
  const system = messages.find((message) => message.role === "system");
  return (system?.content || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function estimateTokensFromMessages(messages) {
  return messages.reduce((sum, message) => sum + estimateTokens(message.content || ""), 0);
}

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}

function sigmaSummary(flags = {}) {
  const merged = {
    semanticPreservation: false,
    chartCoverComplete: false,
    branchDeterminacy: false,
    auditReplayReady: false,
    ...flags
  };
  const closed = Object.values(merged).filter(Boolean).length;
  return { ...merged, summary: `σ[${closed}/${Object.keys(merged).length}]` };
}

function kappaSummary({ promptTokens = 0, completionTokens = 0, tokenBudget = 4096 }) {
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    tokenBudget,
    withinBound: promptTokens + completionTokens <= tokenBudget,
    summary: `κ[T=${promptTokens + completionTokens}/${tokenBudget}]`
  };
}

function pathSafe(packet) {
  return packet.outboxPath || null;
}

function inferLogicalStatus(relations) {
  let contradictions = 0;
  const seen = new Set();
  for (const relation of relations) {
    if (/:contradicts$/i.test(relation)) {
      contradictions += 1;
    }
    const [pair, rel] = relation.split(":");
    if (!pair || !rel) continue;
    if (rel === "supports" && seen.has(`${pair}:contrasts`)) contradictions += 1;
    if (rel === "contrasts" && seen.has(`${pair}:supports`)) contradictions += 1;
    seen.add(relation);
  }
  if (contradictions > 0) {
    return { status: "conflict", score: Number(Math.max(0.05, 1 - contradictions / Math.max(1, relations.length)).toFixed(3)) };
  }
  return { status: "consistent", score: 0.82 };
}

function parseValidationResponse(text) {
  const statusMatch = String(text || "").match(/STATUS\s*:\s*(consistent|uncertain|conflict)/i);
  const scoreMatch = String(text || "").match(/SCORE\s*:\s*([01](?:\.\d+)?)/i);
  const reasonMatch = String(text || "").match(/REASON\s*:\s*(.+)$/im);
  return {
    status: statusMatch ? statusMatch[1].toLowerCase() : null,
    score: scoreMatch ? Number.parseFloat(scoreMatch[1]) : null,
    reason: reasonMatch ? reasonMatch[1].trim().slice(0, 220) : null
  };
}

function pickSdrMeta(routing = {}) {
  if (!routing || (!routing.channel && !routing.op && !routing.preferredRuntimeId)) {
    return null;
  }
  return {
    channel: routing.channel || null,
    op: routing.op || null,
    runtimeId: routing.preferredRuntimeId || null,
    model: routing.preferredModel || null,
    source: routing.source || null
  };
}

function normalizeFetchError(error, timeoutMs) {
  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    return `timeout_after_${timeoutMs}ms`;
  }
  return error?.message || "request_failed";
}

function mergeStringList(existing = [], incoming = []) {
  return [...new Set([...(existing || []), ...(incoming || [])].map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12);
}

function clientRecordSignature(record) {
  return JSON.stringify({
    id: String(record?.id || ""),
    label: String(record?.label || ""),
    transport: String(record?.transport || ""),
    remoteAddress: String(record?.remoteAddress || ""),
    userAgent: String(record?.userAgent || ""),
    sessionUser: String(record?.sessionUser || ""),
    scope: String(record?.scope || ""),
    methods: mergeStringList(record?.methods),
    paths: mergeStringList(record?.paths),
    subscriptions: mergeStringList(record?.subscriptions)
  });
}

function normalizeChannelAlias(value) {
  const channel = String(value || "").trim().toLowerCase();
  if (!channel) return "";
  if (!/^[a-z0-9_-]{1,40}$/i.test(channel)) return "";
  return channel;
}

function normalizeSectionOp(value) {
  const op = String(value || "").trim().toLowerCase();
  if (["strict", "semantic", "lightweight", "reflective", "embedding"].includes(op)) {
    return op;
  }
  return null;
}

function mapSectionOpToRouteHint(op) {
  if (op === "strict") return "strict";
  if (op === "lightweight") return "lightweight";
  if (op === "reflective") return "reflective";
  if (op === "embedding") return "embedding";
  return "semantic";
}

function parseSectionRoutingDirective(messages = [], allowPromptDirective = true) {
  if (!allowPromptDirective) {
    return { channel: null, op: null };
  }
  const lastMessage = [...messages].reverse().find((item) => item?.content);
  const text = String(lastMessage?.content || "");
  if (!text) {
    return { channel: null, op: null };
  }

  let channel = null;
  let op = null;

  const chShort = text.match(/§CH\{([a-z0-9_-]{1,40})\}/i);
  if (chShort) channel = normalizeChannelAlias(chShort[1]);

  const opShort = text.match(/§OP\{([a-z0-9_-]{1,40})\}/i);
  if (opShort) op = normalizeSectionOp(opShort[1]);

  const route = text.match(/§ROUTE\{([^}]*)\}/i);
  if (route) {
    const body = route[1];
    for (const rawPair of body.split(/[;,]/g)) {
      const pair = rawPair.trim();
      if (!pair.includes("=")) continue;
      const [kRaw, vRaw] = pair.split("=");
      const key = kRaw.trim().toLowerCase();
      const value = vRaw.trim();
      if ((key === "channel" || key === "ch") && !channel) channel = normalizeChannelAlias(value);
      if ((key === "op" || key === "mode") && !op) op = normalizeSectionOp(value);
    }
  }

  return { channel, op };
}
