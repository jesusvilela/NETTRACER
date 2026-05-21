import { TelosValidator } from './telos-validator.js';
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expandFileToS1, embedS1Carrier } from "./ingress-expander.js";
import { S1_PACKET_TYPES } from "./packet.js";
import { buildSectionEnvelope, extractSectionTags, summarizeSectionText } from "./section-lang.js";
import { classifyPacketBundle, classifyPacketFiber, classifyPacketSection, derivePacketDirection } from "./slang-interpreter.js";
import { readJsonWithRecovery, writeJsonFileSafely } from "./persistence.js";
import { appendCognitiveMemory, buildCognitiveSnapshot } from "./cognitive-reflection.js";
import { syncNodeToRamdisk } from "./nnn-bridge.js";

const NODE_MESSAGE_LIMIT = 160;
const RELAY_LIMIT = 400;
const GRAPH_SECTION_ORDER = ["reservoir", "admission", "execution", "return", "proof"];
const DEFAULT_DIALECTS = ["Proof", "Topo", "IG"];
const DEFAULT_ANDROID_PACK_SOURCE = "C:\\Users\\HAL900\\AndroidStudioProjects\\topostrasgo\\app\\src\\main\\assets\\slang_packs";
const DEFAULT_TOPOSTRASGO_ROOT = "C:\\Users\\HAL900\\AndroidStudioProjects\\topostrasgo";
const DEFAULT_UTAI_ROOT = "H:\\NP Completeness Bunny UTAI study\\UTAI";
const DEFAULT_IGBUNDLE_ROOT = "H:\\LLM-MANIFOLD\\igbundle-llm";
const MIND_QUALITY_IDS = [
  "self_reflection",
  "godelian_identity",
  "otherness",
  "mutual_recognition",
  "mutual_resonance",
  "n_cosmo",
  "n_manifold",
  "fiber_bundled",
  "sheaved",
  "hamiltonian",
  "holoportation",
  "adiabatic",
  "general_intelligence",
  "ergoretic",
  "erdodetic",
  "memory",
  "pre_registration",
  "adversarial_negation",
  "proof_grounding",
  "compression",
  "curvature_adaptation",
  "recursive_self_model",
  "multi_angle_epistemics",
  "readout_alignment",
  "phi5_designation",
  "pentagonal_fractal",
  "primordial_grid",
  "telos_convergence",
  "geometric_end",
  "golden_ratio_scaling",
  "substrate_unfolding",
  "teleological_fulfillment",
  "theoretical_meta_models",
  "iterative_substrate"
];
export class SlangControlPlane {
  constructor({ config, traceStore, controlPlane, broker }) {
    this.config = config;
    this.traceStore = traceStore;
    this.controlPlane = controlPlane;
    this.broker = broker;
    this.telos = new TelosValidator();
    this.filePath = path.join(config.stateDir, "slang-control-plane.json");
    this.packDir = path.join(config.stateDir, "slang-packs");
    fs.mkdirSync(this.packDir, { recursive: true });
    this.state = this.loadState();
    this.bootstrapPack();
    if (this.config.integrationRoots?.topostrasgo) {
      this.bootstrapToposTragoNodes({ root: this.config.integrationRoots.topostrasgo, quiet: true });
    }
    if (this.config.integrationRoots?.utai || this.config.integrationRoots?.igbundle) {
      this.bootstrapCoreLearners({
        utaiRoot: this.config.integrationRoots?.utai || DEFAULT_UTAI_ROOT,
        igbundleRoot: this.config.integrationRoots?.igbundle || DEFAULT_IGBUNDLE_ROOT,
        quiet: true
      });
    }
    if (this.traceStore?.events?.on) {
      this.traceStore.events.on("topology", (topology) => {
        this.syncTopology(topology, "topology-event");
      });
    }
    this.syncTopology(this.controlPlane.getTopology(), "boot");
  }

  loadState() {
    if (fs.existsSync(this.filePath) || fs.existsSync(`${this.filePath}.bak`)) {
      const { data, source } = readJsonWithRecovery(this.filePath);
      if (data) {
        const parsed = normalizeSlangState(data);
        if (source !== "primary") {
          this.persist(parsed);
        }
        return parsed;
      }
    }
    const state = normalizeSlangState();
    this.persist(state);
    return state;
  }

  persist(nextState = this.state) {
    nextState.lastUpdated = new Date().toISOString();
    writeJsonFileSafely(this.filePath, nextState);
    this.state = nextState;
    
    // Sync all nodes (including substrates and topostrago nodes) to hyperbolic reservoir
    const topology = this.getAugmentedTopology();
    if (topology.nodes) {
      for (const node of topology.nodes) {
        syncNodeToRamdisk(node).catch(() => {});
      }
    }
  }

  bootstrapPack() {
    if (this.state.activePackId) return;
    const sourcePath = resolvePackSource();
    if (!sourcePath) return;
    try {
      this.applyPackUpgrade({ sourcePath, nodeIds: [], actor: "bootstrap", quiet: true });
    } catch (error) {
      this.traceStore?.addAudit?.({
        type: "slang-pack-bootstrap-failed",
        timestamp: Date.now(),
        error: error.message,
        sourcePath
      });
    }
  }

  getStatus() {
    const activePack = this.getActivePack();
    const topology = this.getTopologySnapshot();
    return {
      activePack,
      network: this.config.network,
      installedPacks: this.listPacks(),
      relayCount: this.state.relays.length,
      nodeInboxCounts: Object.fromEntries(topology.nodes.map((node) => [node.id, node.inboxCount])),
      nodePeerCounts: Object.fromEntries(topology.nodes.map((node) => [node.id, node.peerCount])),
      nodeBindings: structuredClone(this.state.nodeBindings || {}),
      nodePeerMaps: structuredClone(this.state.nodePeerMaps || {}),
      topologyNodeCount: topology.metrics.totalNodes,
      topology,
      cognitive: this.getCognitiveSnapshot({ persist: false, limit: 48 }),
      lastCarrierInspection: this.state.lastCarrierInspection,
      sourceCandidates: packSourceCandidates()
    };
  }

  listPacks() {
    return Object.values(this.state.installedPacks || {})
      .sort((a, b) => Number(b.installedAtMs || 0) - Number(a.installedAtMs || 0));
  }

  getActivePack() {
    return this.state.activePackId ? this.state.installedPacks?.[this.state.activePackId] || null : null;
  }

  getNodeBinding(nodeId) {
    return structuredClone(this.state.nodeBindings?.[String(nodeId || "")] || null);
  }

  getAugmentedTopology(topology = this.controlPlane.getTopology()) {
    const baseNodes = (Array.isArray(topology?.nodes) ? topology.nodes : []).map(node => {
      if (node.kind === "runtime" || node.kind === "substrate") {
        const nVector = getSubstratePersonality(node.id);
        const coords = hyperbolicNCoordinates(Math.abs(node.id.split("").reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)), nVector);
        return {
          ...node,
          nVector,
          hyperbolic: {
            model: "n-poincare-ball",
            dimension: nVector.length,
            radius: coords.radius,
            coords: coords.coords
          }
        };
      }
      return node;
    });
    const baseEdges = Array.isArray(topology?.edges) ? topology.edges : [];
    const learnerNodes = Object.values(this.state.coreLearners || {}).map((learner) => ({
      id: learner.id,
      kind: "learner",
      label: learner.label,
      healthy: learner.status !== "missing",
      provider: learner.substrate?.id || "igbundle",
      subscriptions: learner.subscriptions || [],
      learnerRole: learner.role
    }));
    const substrate = this.state.learnerSubstrate;
    const toposNodes = Object.values(this.state.toposTragoNodes || {});
    const toposTopologyNodes = toposNodes.map((node) => ({
      id: node.id,
      kind: "topostrago",
      label: node.label,
      healthy: node.status !== "missing",
      provider: "topostrasgo",
      subscriptions: node.subscriptions || [],
      moduleRole: node.role
    }));
    const substrateNode = substrate ? [{
      id: substrate.id,
      kind: "substrate",
      label: substrate.label,
      healthy: substrate.exists !== false,
      provider: "igbundle"
    }] : [];
    const learnerEdges = [
      ...learnerNodes.map((node) => ({ from: "netracer", to: node.id, kind: "learns", healthy: node.healthy })),
      ...learnerNodes.map((node) => substrate ? ({ from: substrate.id, to: node.id, kind: "substrate", healthy: substrate.exists !== false }) : null).filter(Boolean),
      learnerNodes.length >= 2 ? { from: learnerNodes[0].id, to: learnerNodes[1].id, kind: "mutual-learn", healthy: true } : null
    ].filter(Boolean);
    const toposEdges = [
      ...toposTopologyNodes.map((node) => ({ from: "netracer", to: node.id, kind: "hyperbolic-net", healthy: node.healthy })),
      ...toposTopologyNodes.map((node) => ({ from: "igbundle-substrate", to: node.id, kind: "substrate-conditioning", healthy: node.healthy })),
      ...toposTopologyNodes.map((node, index) => {
        const next = toposTopologyNodes[(index + 1) % Math.max(1, toposTopologyNodes.length)];
        return next && next.id !== node.id ? { from: node.id, to: next.id, kind: "sheaf-talk", healthy: node.healthy && next.healthy } : null;
      }).filter(Boolean),
      ...learnerNodes.flatMap((learner) => toposTopologyNodes.map((node) => ({ from: learner.id, to: node.id, kind: "learner-conditioning", healthy: node.healthy })))
    ];
    return {
      nodes: mergeTopologyNodes([...baseNodes, ...substrateNode, ...learnerNodes, ...toposTopologyNodes]),
      edges: mergeTopologyEdges([...baseEdges, ...learnerEdges, ...toposEdges])
    };
  }

  getTopologySnapshot(topology = this.getAugmentedTopology()) {
    topology = this.getAugmentedTopology(topology);
    const nodes = Array.isArray(topology?.nodes) ? topology.nodes : [];
    const edges = Array.isArray(topology?.edges) ? topology.edges : [];
    const activePack = this.getActivePack();
    const liveNodeIds = new Set(
      nodes
        .map((node) => String(node?.id || ""))
        .filter(Boolean)
    );
    const kindCounts = {};
    const topologyNodes = nodes
      .map((node) => {
        const nodeId = String(node?.id || "");
        if (!nodeId) return null;
        const kind = String(node?.kind || "node");
        const binding = this.state.nodeBindings?.[nodeId] || null;
        const peerMap = this.state.nodePeerMaps?.[nodeId] || null;
        const inboxCount = Number((this.state.nodeInboxes?.[nodeId] || []).length);
        kindCounts[kind] = (kindCounts[kind] || 0) + 1;
        return {
          id: nodeId,
          kind,
          label: nodeLabel(node),
          healthy: typeof node?.healthy === "boolean" ? node.healthy : null,
          provider: node?.provider ? String(node.provider) : null,
          priority: Number.isFinite(Number(node?.priority)) ? Number(node.priority) : null,
          negotiated: Boolean(binding),
          inboxCount,
          peerCount: Number(peerMap?.peers?.length || 0),
          packVersion: binding?.pack?.version || null,
          dialectCount: Number(binding?.pack?.dialects?.length || 0),
          protocolCount: Number(binding?.pack?.protocols?.length || 0),
          sections: structuredClone(binding?.sections || []),
          subscriptions: structuredClone(node?.subscriptions || []),
          learner: this.state.coreLearners?.[nodeId] || null,
          topostrago: this.state.toposTragoNodes?.[nodeId] || null,
          substrate: this.state.learnerSubstrate?.id === nodeId ? this.state.learnerSubstrate : null,
          signature: binding?.signature || null,
          peerSignature: peerMap?.signature || null,
          updatedAt: binding?.updatedAt || null
        };
      })
      .filter(Boolean);
    const boundNodes = topologyNodes.filter((node) => node.negotiated).length;
    const inboxNodes = topologyNodes.filter((node) => node.inboxCount > 0).length;
    const peerLinkedNodes = topologyNodes.filter((node) => node.peerCount > 0).length;
    const orphanedBindings = Object.keys(this.state.nodeBindings || {}).filter((nodeId) => !liveNodeIds.has(nodeId));
    const orphanedInboxNodes = Object.entries(this.state.nodeInboxes || {})
      .filter(([nodeId, items]) => !liveNodeIds.has(nodeId) && Array.isArray(items) && items.length > 0)
      .map(([nodeId]) => nodeId);
    const orphanedPeerMaps = Object.keys(this.state.nodePeerMaps || {}).filter((nodeId) => !liveNodeIds.has(nodeId));

    return {
      generatedAt: new Date().toISOString(),
      activePack: activePack ? {
        id: activePack.id,
        version: activePack.version,
        dialectCount: Number(activePack.dialectNames?.length || 0),
        protocolCount: Number(activePack.protocolNames?.length || 0),
        pipeline: activePack.pipeline || null
      } : null,
      nodes: topologyNodes,
      edges: edges.map((edge) => ({
        from: String(edge?.from || ""),
        to: String(edge?.to || ""),
        kind: String(edge?.kind || "route"),
        healthy: typeof edge?.healthy === "boolean" ? edge.healthy : null,
        priority: Number.isFinite(Number(edge?.priority)) ? Number(edge.priority) : null
      })),
      metrics: {
        totalNodes: topologyNodes.length,
        boundNodes,
        unboundNodes: Math.max(0, topologyNodes.length - boundNodes),
        inboxNodes,
        peerLinkedNodes,
        edgeCount: edges.length,
        coverageRatio: topologyNodes.length > 0 ? Number((boundNodes / topologyNodes.length).toFixed(4)) : 0,
        kindCounts,
        orphanedBindings,
        orphanedInboxNodes,
        orphanedPeerMaps
      }
    };
  }

  getInterpreterLang() {
    const pack = this.getActivePack();
    if (!pack) return null;
    const sourceFiles = [pack.primaryLangFile, ...(pack.interpreterFiles || [])]
      .filter(Boolean)
      .filter((filePath, index, items) => items.indexOf(filePath) === index)
      .filter((filePath) => fs.existsSync(filePath));
    if (sourceFiles.length === 0) return null;
    const rawBlocks = sourceFiles.map((filePath) => fs.readFileSync(filePath, "utf8"));
    const raw = rawBlocks.join("\n\n");
    const lines = rawBlocks[0].split(/\r?\n/);
    const title = lines.find((line) => /(name|dialect|version)\s*=/.test(line))
      ?.replace(/.*=\s*/, "")
      ?.trim()
      || pack.codename
      || pack.version;
    return {
      title,
      version: pack.version,
      source: sourceFiles[0],
      blocks: extractLangBlocks(raw),
      excerpts: extractExcerpts(raw),
      dialects: pack.dialectNames || [],
      protocols: pack.protocolNames || [],
      pipeline: pack.pipeline || null
    };
  }

  getCognitiveSnapshot({ persist = true, limit = 72, autoCycle = null, archive = null } = {}) {
    const topology = this.getTopologySnapshot();
    const graph = this.buildGraphMap({ nodeId: "netracer", direction: "all", limit });
    const packets = typeof this.traceStore?.getPackets === "function" ? this.traceStore.getPackets().slice(-Math.max(80, Number(limit) || 72)) : [];
    const snapshot = buildCognitiveSnapshot({
      topology,
      activePack: this.getActivePack(),
      graph,
      packets,
      memories: this.state.cognitiveMemory || [],
      autoCycle,
      archive
    });
    if (persist) {
      this.state.cognitiveMemory = appendCognitiveMemory(this.state.cognitiveMemory || [], snapshot);
      this.state.lastCognitiveSnapshot = snapshot;
      this.persist();
    }
    return snapshot;
  }

  getCognitiveMemory(limit = 48) {
    const items = Array.isArray(this.state.cognitiveMemory) ? this.state.cognitiveMemory : [];
    return items.slice(-Math.max(1, Number(limit) || 48));
  }

  getLearners() {
    return {
      substrate: structuredClone(this.state.learnerSubstrate || null),
      learners: Object.values(this.state.coreLearners || {}).map((learner) => structuredClone(learner)),
      metaLearningEvents: (this.state.metaLearningEvents || []).slice(-48),
      reservoirComputingEvents: (this.state.reservoirComputingEvents || []).slice(-48)
    };
  }

  getToposTragoNodes() {
    return {
      nodes: Object.values(this.state.toposTragoNodes || {}).map((node) => structuredClone(node)),
      messages: Object.fromEntries(
        Object.keys(this.state.toposTragoNodes || {}).map((nodeId) => [nodeId, this.getNodeMessages(nodeId, 24)])
      )
    };
  }

  bootstrapToposTragoNodes({ root = DEFAULT_TOPOSTRASGO_ROOT, actor = "operator" } = {}) {
    const nodes = discoverToposTragoNodes(root, {
      learners: Object.values(this.state.coreLearners || {}),
      substrate: this.state.learnerSubstrate
    });
    for (const node of nodes) {
      this.state.toposTragoNodes[node.id] = node;
      this.enqueueNodeMessage({
        nodeId: node.id,
        type: "topostrago-node-bind",
        direction: "control",
        body: buildToposTragoBindBody(node),
        metadata: { actor, node }
      });
    }
    const sync = this.syncTopology(this.getAugmentedTopology(), "topostrago-bootstrap");
    const cognitive = this.getCognitiveSnapshot({ persist: false, limit: 128 });
    const event = {
      id: `topostrago_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      actor,
      root: path.resolve(String(root || DEFAULT_TOPOSTRASGO_ROOT)),
      nodeIds: nodes.map((node) => node.id),
      cognitiveScore: cognitive.score,
      update: `§TOPOSTRAGO_NET{nodes=${nodes.length},qualities=${MIND_QUALITY_IDS.length},score=${cognitive.score}}`
    };
    this.state.toposTragoEvents.push(event);
    while (this.state.toposTragoEvents.length > 120) this.state.toposTragoEvents.shift();
    this.persist();
    return {
      ok: true,
      nodes,
      sync,
      event,
      topology: this.getTopologySnapshot()
    };
  }

  getReservoirComputingScheme({ persist = false, reason = "inspect" } = {}) {
    const topology = this.getTopologySnapshot();
    const graph = this.buildGraphMap({ nodeId: "netracer", direction: "all", limit: 96 });
    const learners = Object.values(this.state.coreLearners || {});
    const memory = [
      ...(this.state.cognitiveMemory || []).slice(-32),
      ...(this.state.metaLearningEvents || []).slice(-32)
    ];
    const reservoirNodes = topology.nodes.filter((node) =>
      node.kind === "runtime" || node.kind === "model" || node.kind === "substrate" || node.kind === "topostrago"
    );
    const inputNodes = learners.map((learner) => learner.id);
    const memoryNode = "memory:slang-recurrent";
    const readoutNode = "netracer";
    const substrateNode = this.state.learnerSubstrate?.id || null;
    const stateVector = buildReservoirStateVector({ learners, memory, reservoirNodes, graph, substrate: this.state.learnerSubstrate });
    const transitions = buildReservoirTransitions({ inputNodes, memoryNode, reservoirNodes, readoutNode, substrateNode });
    const spectralRadius = estimateReservoirSpectralRadius(transitions, stateVector.nodes.length);
    const leakRate = Number(Math.max(0.05, Math.min(0.95, 1 / (1 + memory.length / 8))).toFixed(4));
    const echoStateScore = Number(Math.max(0, Math.min(1, 1 - Math.abs(spectralRadius - 0.88))).toFixed(4));
    const scheme = {
      generatedAt: new Date().toISOString(),
      version: "reservoir-computing.v1",
      reason,
      geometry: {
        base: "TrasgoNet",
        disk: "Poincare",
        bundle: "UTAI/Bunny inputs over IGBundle substrate",
        sheaf: "local learner sections glued through memory and runtime reservoirs",
        recurrence: "memory -> learners -> runtimes -> readout -> memory"
      },
      roles: {
        inputs: inputNodes,
        memory: memoryNode,
        reservoir: reservoirNodes.map((node) => node.id),
        substrate: substrateNode,
        readout: readoutNode
      },
      stateVector,
      transitions,
      metrics: {
        learnerCount: learners.length,
        memoryDepth: memory.length,
        reservoirNodeCount: reservoirNodes.length,
        transitionCount: transitions.length,
        spectralRadius,
        leakRate,
        echoStateScore,
        metaLearningEvents: (this.state.metaLearningEvents || []).length
      },
      update: `§RESERVOIR{inputs=${inputNodes.length},memory=${memory.length},reservoir=${reservoirNodes.length},rho=${spectralRadius},leak=${leakRate}}`
    };
    if (persist) {
      this.state.reservoirComputingEvents.push({
        id: `reservoir_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        timestamp: scheme.generatedAt,
        reason,
        metrics: scheme.metrics,
        update: scheme.update
      });
      while (this.state.reservoirComputingEvents.length > 120) this.state.reservoirComputingEvents.shift();
      this.persist();
    }
    return scheme;
  }

  bootstrapCoreLearners({ utaiRoot = DEFAULT_UTAI_ROOT, igbundleRoot = DEFAULT_IGBUNDLE_ROOT, actor = "operator" } = {}) {
    const substrate = discoverIgbundleSubstrate(igbundleRoot);
    const learners = buildCoreLearners({ utaiRoot, substrate });
    for (const learner of learners) {
      this.state.coreLearners[learner.id] = learner;
      this.enqueueNodeMessage({
        nodeId: learner.id,
        type: "core-learner-bind",
        direction: "control",
        body: buildLearnerBindBody(learner, substrate),
        metadata: { actor, learner, substrate }
      });
    }
    this.state.learnerSubstrate = substrate;
    const sync = this.syncTopology(this.getAugmentedTopology(), "core-learner-bootstrap");
    const event = this.runMetaLearningCycle({ actor, reason: "core-learner-bootstrap", persist: false });
    this.state.metaLearningEvents.push(event);
    while (this.state.metaLearningEvents.length > 120) this.state.metaLearningEvents.shift();
    this.persist();
    return {
      ok: true,
      substrate,
      learners,
      topology: this.getTopologySnapshot(),
      sync,
      metaLearning: event
    };
  }

  runMetaLearningCycle({ actor = "operator", reason = "manual", persist = true } = {}) {
    const learners = Object.values(this.state.coreLearners || {});
    const substrate = this.state.learnerSubstrate || discoverIgbundleSubstrate(this.config.integrationRoots?.igbundle || DEFAULT_IGBUNDLE_ROOT);
    const topology = this.getTopologySnapshot();
    const snapshot = this.getCognitiveSnapshot({ persist: false, limit: 96 });
    const evidenceScore = learners.length > 0 ? learners.reduce((sum, learner) => sum + learner.evidenceScore, 0) / learners.length : 0;
    const substrateScore = substrate.exists ? 1 : 0.25;
    const mutualScore = learners.length >= 2 ? 1 : 0.35;
    const score = Number(((evidenceScore * 0.42) + (snapshot.score * 0.28) + (substrateScore * 0.18) + (mutualScore * 0.12)).toFixed(4));
    const reservoir = this.getReservoirComputingScheme({ persist: false, reason });
    const event = {
      id: `metalearn_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      actor,
      reason,
      learnerIds: learners.map((learner) => learner.id),
      substrate: substrate ? { id: substrate.id, checkpoint: substrate.checkpoint } : null,
      score,
      cognitiveScore: snapshot.score,
      reservoirScore: reservoir.metrics.echoStateScore,
      topologyNodeCount: topology.metrics.totalNodes,
      update: `§METALEARN{learners=${learners.length},substrate=${substrate?.checkpoint?.step || "unknown"},score=${score},reservoir=${reservoir.metrics.echoStateScore}}`
    };
    if (persist) {
      this.state.metaLearningEvents.push(event);
      while (this.state.metaLearningEvents.length > 120) this.state.metaLearningEvents.shift();
      this.persist();
    }
    return event;
  }

  syncTopology(topology = this.getAugmentedTopology(), actor = "autobind") {
    topology = this.getAugmentedTopology(topology);
    const nodes = Array.isArray(topology?.nodes) ? topology.nodes : [];
    const liveNodeIds = new Set(
      nodes
        .map((node) => String(node?.id || ""))
        .filter(Boolean)
    );
    const activePack = this.getActivePack();
    const messages = [];
    const removedBindings = [];
    const removedPeerMaps = [];
    let changed = false;

    for (const nodeId of Object.keys(this.state.nodeBindings || {})) {
      if (liveNodeIds.has(nodeId)) continue;
      delete this.state.nodeBindings[nodeId];
      removedBindings.push(nodeId);
      changed = true;
    }
    for (const nodeId of Object.keys(this.state.nodePeerMaps || {})) {
      if (liveNodeIds.has(nodeId)) continue;
      delete this.state.nodePeerMaps[nodeId];
      removedPeerMaps.push(nodeId);
      changed = true;
    }

    for (const node of nodes) {
      const nodeId = String(node.id || "");
      if (!nodeId) continue;
      const binding = buildNodeBinding({
        node,
        pack: activePack,
        network: this.config.network,
        appName: this.config.appName
      });
      const current = this.state.nodeBindings?.[nodeId];
      if (current?.signature === binding.signature) continue;
      this.state.nodeBindings[nodeId] = binding;
      changed = true;
      if (nodeId !== "netracer") {
        messages.push(this.addNodeMessageInternal({
          nodeId,
          type: "section-bind",
          direction: "control",
          body: binding.envelope,
          metadata: {
            actor,
            signature: binding.signature,
            pack: binding.pack,
            httpUrl: binding.httpUrl,
            wsUrl: binding.wsUrl,
            sections: binding.sections
          }
        }));
      }
    }

    const peerMaps = buildReachabilityMaps(topology, this.state.nodeBindings || {});
    for (const node of nodes) {
      const nodeId = String(node?.id || "");
      if (!nodeId) continue;
      const nextPeerMap = peerMaps.get(nodeId) || {
        nodeId,
        peers: [],
        signature: shortHash(`${nodeId}:empty-peer-map`),
        updatedAt: new Date().toISOString()
      };
      const currentPeerMap = this.state.nodePeerMaps?.[nodeId];
      if (currentPeerMap?.signature === nextPeerMap.signature) continue;
      this.state.nodePeerMaps[nodeId] = nextPeerMap;
      changed = true;
      if (nodeId !== "netracer") {
        messages.push(this.addNodeMessageInternal({
          nodeId,
          type: "peer-reachability",
          direction: "control",
          body: buildPeerReachabilityBody(nextPeerMap),
          metadata: {
            actor,
            signature: nextPeerMap.signature,
            peerCount: nextPeerMap.peers.length,
            peers: nextPeerMap.peers.map((peer) => ({
              id: peer.id,
              kind: peer.kind,
              via: peer.via,
              distance: peer.distance
            }))
          }
        }));
      }
    }

    if (changed || messages.length > 0) {
      this.persist();
    }
    return {
      changed: changed || messages.length > 0,
      messages,
      removedBindings,
      removedPeerMaps,
      bindings: structuredClone(this.state.nodeBindings || {})
    };
  }

  addNodeMessageInternal({ nodeId, type, direction, body, metadata = {} }) {
    const message = {
      id: `nodemsg_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      nodeId: String(nodeId),
      type: String(type || "message"),
      direction: String(direction || "control"),
      body: String(body || ""),
      metadata
    };
    const bucket = this.state.nodeInboxes[message.nodeId] || [];
    bucket.push(message);
    while (bucket.length > NODE_MESSAGE_LIMIT) bucket.shift();
    this.state.nodeInboxes[message.nodeId] = bucket;
    return message;
  }

  applyPackUpgrade({ sourcePath = "", nodeIds = [], actor = "operator", quiet = false } = {}) {
    const sourceDir = resolvePackSource(sourcePath);
    if (!sourceDir) {
      throw new Error("slang_pack_source_not_found");
    }

    const manifestPath = path.join(sourceDir, "manifest.json");
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
      : synthesizeManifestFromSlangRepo(sourceDir);
    const descriptor = installPackDescriptor(sourceDir, manifest, this.packDir);
    this.state.installedPacks[descriptor.id] = descriptor;
    this.state.activePackId = descriptor.id;

    const topology = this.getAugmentedTopology();
    const bindingSync = this.syncTopology(topology, "pack-upgrade");
    const targets = [...new Set(
      (Array.isArray(nodeIds) && nodeIds.length > 0
        ? nodeIds
        : topology.nodes.map((node) => String(node.id)))
        .filter(Boolean)
    )];

    const relays = targets.map((nodeId) => this.enqueueNodeMessage({
      nodeId,
      type: "pack-upgrade",
      direction: "control",
      body: buildPackRelayBody(descriptor, nodeId),
      metadata: {
        packId: descriptor.id,
        packVersion: descriptor.version,
        dialects: descriptor.dialectNames,
        validationPass: descriptor.allPass
      }
    }));

    const relayRecord = {
      id: `packrelay_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      actor,
      packId: descriptor.id,
      packVersion: descriptor.version,
      nodeIds: targets
    };
    this.state.relays.push(relayRecord);
    while (this.state.relays.length > RELAY_LIMIT) this.state.relays.shift();
    this.persist();

    const packetIds = quiet ? [] : this.emitPackUpgradePackets(descriptor, targets, actor);
    return {
      ok: true,
      pack: descriptor,
      relays: [...bindingSync.messages, ...relays],
      packetIds
    };
  }

  inspectMultimodal({ filePath, nodeId = "netracer", embedCarrier = false } = {}) {
    const resolved = path.resolve(String(filePath || "").trim());
    if (!resolved || !fs.existsSync(resolved)) {
      throw new Error("multimodal_path_not_found");
    }

    const activePack = this.getActivePack();
    let expanded = expandFileToS1({ filePath: resolved, hyperbolize: true, backend: "webgpu" });
    let embedded = false;

    if (embedCarrier && path.extname(resolved).toLowerCase() === ".png" && carrierNeedsRefresh(expanded.meta?.carrier, activePack)) {
      const payload = buildCarrierPayload(activePack, nodeId, resolved);
      embedS1Carrier({ filePath: resolved, payload });
      expanded = expandFileToS1({ filePath: resolved, hyperbolize: true, backend: "webgpu" });
      embedded = true;
    }

    const inspection = {
      id: `carrier_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
      timestamp: new Date().toISOString(),
      nodeId: String(nodeId || "netracer"),
      filePath: resolved,
      kind: expanded.kind,
      modality: expanded.meta?.modality || "unknown",
      preview: expanded.preview,
      embedded,
      pack: activePack ? { id: activePack.id, version: activePack.version } : null,
      carrier: expanded.meta?.carrier || { detected: false, validS1: false, carriers: [] },
      structure: expanded.meta?.structure || {},
      extraction: expanded.meta?.extraction || "",
      hyperbolic: expanded.meta?.hyperbolic ? {
        engine: expanded.meta.hyperbolic.engine,
        nodeCount: Object.keys(expanded.meta.hyperbolic.coords || {}).length
      } : null
    };
    this.state.lastCarrierInspection = inspection;
    this.persist();
    return inspection;
  }

  buildGraphMap({ nodeId = "", section = "all", fiber = "all", bundle = "all", kind = "all", direction = "all", limit = 48 } = {}) {
    const topology = this.getAugmentedTopology();
    const activePack = this.getActivePack();
    const selectedNodeId = String(nodeId || topology.nodes.find((node) => node.kind === "runtime")?.id || "netracer");
    const nodeIndex = new Map((topology.nodes || []).map((node) => [String(node.id), node]));
    const selectedNode = nodeIndex.get(selectedNodeId) || { id: selectedNodeId, kind: "runtime", label: selectedNodeId };
    const traffic = typeof this.traceStore?.getTraffic === "function" ? this.traceStore.getTraffic() : [];
    const trafficDirection = new Map();
    for (const entry of traffic.slice(-400)) {
      if (!entry?.packetId) continue;
      if (entry.route && String(entry.route) !== selectedNodeId && selectedNodeId !== "netracer") continue;
      if (entry.direction === "TO_SUBSTRATE") trafficDirection.set(entry.packetId, "forward");
      if (entry.direction === "FROM_SUBSTRATE") trafficDirection.set(entry.packetId, "reverse");
    }

    const packets = typeof this.traceStore?.getPackets === "function" ? this.traceStore.getPackets() : [];
    const strands = packets
      .slice(-Math.max(120, Number(limit) * 5))
      .filter((packet) => packetMatchesNode(packet, selectedNode, selectedNodeId))
      .map((packet, index) => {
        const routeNode = nodeIndex.get(String(packet?.payload?.route || selectedNodeId)) || selectedNode;
        const strandSection = classifyPacketSection(packet);
        const strandFiber = classifyPacketFiber(packet, selectedNodeId);
        const strandBundle = classifyPacketBundle(packet, routeNode);
        const strandDirection = trafficDirection.get(packet.id) || derivePacketDirection(packet);
        const strandKind = String(packet.packetType || "packet");
        return {
          id: packet.id,
          packetId: packet.id,
          section: strandSection,
          fiber: strandFiber,
          bundle: strandBundle,
          kind: strandKind,
          direction: strandDirection,
          route: String(packet?.payload?.route || selectedNodeId),
          label: buildGraphLabel(packet, strandSection, strandDirection),
          content: summarizeSectionText(packet?.envelope || packet?.payload?.intent || packet?.payload?.analysis?.summary || "", 220),
          tags: extractSectionTags(packet?.envelope || ""),
          timestamp: packet.timestamp || new Date().toISOString(),
          weight: Number((0.9 + (packet?.parents?.length || 0) * 0.16 + (index % 5) * 0.03).toFixed(3))
        };
      })
      .filter((strand) => strandPassesFilters(strand, { section, fiber, bundle, kind, direction }))
      .slice(-Math.max(1, Number(limit) || 48));

    const messages = this.getNodeMessages(selectedNodeId, 24)
      .map((message) => ({
        ...message,
        section: messageSection(message),
        direction: messageDirection(message),
        tags: extractSectionTags(message.body || "")
      }));

    const messageStrands = messages.map((message, index) => ({
      id: `msgstrand_${message.id}`,
      packetId: message.packetId || null,
      section: message.section,
      fiber: message.type === "section-bind" ? "embedding" : message.type === "pack-upgrade" ? "strict" : "semantic",
      bundle: selectedNode.kind === "model" ? "model" : selectedNode.kind === "broker" ? "broker" : "runtime",
      kind: message.type,
      direction: message.direction,
      route: selectedNodeId,
      label: `§MSG{type=${message.type},direction=${message.direction},node=${selectedNodeId}}`,
      content: summarizeSectionText(message.body || "", 220),
      tags: message.tags,
      timestamp: message.timestamp,
      weight: Number((0.84 + (index % 5) * 0.05).toFixed(3))
    }));

    const allStrands = [...strands, ...messageStrands]
      .filter((strand) => strandPassesFilters(strand, { section, fiber, bundle, kind, direction }))
      .slice(-Math.max(1, Number(limit) || 48));

    const sectionCounts = Object.fromEntries(GRAPH_SECTION_ORDER.map((name) => [name, 0]));
    let forwardCount = 0;
    let reverseCount = 0;
    for (const strand of allStrands) {
      sectionCounts[strand.section] = (sectionCounts[strand.section] || 0) + 1;
      if (strand.direction === "reverse") reverseCount += 1;
      else forwardCount += 1;
    }
    const reservoirTelemetry = buildReservoirFiberTelemetry({
      activePack,
      selectedNodeId,
      allStrands
    });

    return {
      generatedAt: new Date().toISOString(),
      selectedNodeId,
      selectedNode: {
        id: selectedNodeId,
        kind: selectedNode.kind,
        label: selectedNode.label || selectedNodeId
      },
      pack: activePack ? { id: activePack.id, version: activePack.version } : null,
      bind: this.getNodeBinding(selectedNodeId) || this.getNodeBinding("netracer"),
      sections: GRAPH_SECTION_ORDER.map((name, index) => ({
        id: name,
        label: `§SECTION{${name}}`,
        depth: Number((-0.32 + index * 0.16).toFixed(2)),
        count: sectionCounts[name] || 0
      })),
      strands: allStrands,
      messages,
      reservoirBundles: reservoirTelemetry.bundles,
      layerComposition: reservoirTelemetry.layerComposition,
      packPipeline: reservoirTelemetry.packPipeline,
      matrixPayload: buildBundleMatrixPayload(reservoirTelemetry),
      nodes: (topology.nodes || []).map((node) => ({
        id: String(node.id),
        kind: String(node.kind || "node"),
        label: nodeLabel(node),
        provider: node?.provider ? String(node.provider) : null,
        healthy: typeof node?.healthy === "boolean" ? node.healthy : null,
        negotiated: Boolean(this.state.nodeBindings?.[String(node.id)]),
        inboxCount: Number((this.state.nodeInboxes?.[String(node.id)] || []).length),
        peerCount: Number(this.state.nodePeerMaps?.[String(node.id)]?.peers?.length || 0)
      })),
      metrics: {
        forwardCount,
        reverseCount,
        strandCount: allStrands.length,
        messageCount: messages.length,
        connectedBundleCount: reservoirTelemetry.connectedBundleCount,
        activeLayerCount: reservoirTelemetry.activeLayerCount,
        dominantFiber: reservoirTelemetry.dominantFiber
      }
    };
  }

  sendMultimodal({ nodeId, filePath, actor = "operator", embedCarrier = true } = {}) {
    const targetNodeId = String(nodeId || "").trim();
    if (!targetNodeId) {
      throw new Error("multimodal_target_required");
    }
    const inspection = this.inspectMultimodal({ filePath, nodeId: targetNodeId, embedCarrier });
    const message = this.enqueueNodeMessage({
      nodeId: targetNodeId,
      type: "multimodal-send",
      direction: "to-node",
      body: inspection.preview,
      metadata: {
        filePath: inspection.filePath,
        modality: inspection.modality,
        extraction: inspection.extraction,
        pack: inspection.pack,
        carrier: inspection.carrier
      }
    });

    const packet = this.broker?.emitPacket?.({
      packetType: S1_PACKET_TYPES.EXECUTION,
      clientId: "slang-control-plane",
      actor,
      intent: inspection.preview,
      analysis: {
        promptType: "SLANG_MULTIMODAL_SEND",
        tags: ["§MULTIMODAL", `kind|${inspection.kind}`, `node|${targetNodeId}`],
        riskFlags: inspection.carrier?.validS1 ? [] : ["carrier_missing"],
        summary: inspection.preview,
        digest: shortHash(`${inspection.filePath}:${inspection.nodeId}:${inspection.timestamp}`),
        routeHint: "semantic"
      },
      route: targetNodeId,
      model: inspection.pack?.version || "slang-control-plane",
      metadata: {
        multimodal: inspection,
        controlPlaneMessageId: message.id
      },
      stage: {
        name: inspection.carrier?.validS1 ? "CMT" : "CHK",
        score: inspection.carrier?.validS1 ? 1 : 0.74,
        detail: inspection.carrier?.validS1 ? "carrier-ready" : "carrier-thin"
      },
      labels: [`§NODE:${targetNodeId}`, inspection.carrier?.validS1 ? "§CARRIER:OK" : "§CARRIER:MISS"]
    }) || null;

    if (packet) {
      message.packetId = packet.id;
      this.persist();
    }

    return { ok: true, inspection, message, packet };
  }

  receiveFromNode({ nodeId, payload = null, filePath = "", actor = "remote-node", metadata = {} } = {}) {
    const targetNodeId = String(nodeId || "").trim();
    // --- TELOS SECTIONAL COMPUTER VALIDATION ---
    if (payload && payload.n && payload.h) {
      this.telos.validatePacket(payload).then(validation => {
        if (!validation.ok) {
          this.traceStore?.addAlert?.({
            id: `alert_telos_obstruction_${Date.now()}`,
            title: "Topological Obstruction Detected",
            type: "loebian-wall-collision",
            detail: `Packet from ${targetNodeId} rejected: ${validation.reason}. Evidence: ${validation.evidence}`,
            timestamp: Date.now()
          });
          // In a real implementation we would block the packet here.
          // For now, we flag it in metadata.
          metadata.telos_validation = validation;
        } else {
          metadata.telos_validation = validation;
          this.traceStore?.addAudit?.({
            type: "telos-validation-success",
            timestamp: Date.now(),
            nodeId: targetNodeId,
            metrics: validation.metrics
          });
        }
      }).catch(e => {
        console.error("TELOS validation error:", e);
      });
    }
    // --------------------------------------------

    if (!targetNodeId) {
      throw new Error("slang_node_required");
    }
    const inspection = filePath
      ? this.inspectMultimodal({ filePath, nodeId: targetNodeId, embedCarrier: false })
      : null;
    const body = inspection?.preview || summarizePayload(payload);
    const message = this.enqueueNodeMessage({
      nodeId: targetNodeId,
      type: "multimodal-receive",
      direction: "from-node",
      body,
      metadata: {
        ...metadata,
        filePath: inspection?.filePath || "",
        carrier: inspection?.carrier || null
      }
    });

    const packet = this.broker?.emitPacket?.({
      packetType: S1_PACKET_TYPES.AUDIT,
      clientId: "slang-control-plane",
      actor,
      intent: body,
      analysis: {
        promptType: "SLANG_MULTIMODAL_RECEIVE",
        tags: ["§MULTIMODAL", `node|${targetNodeId}`, "direction|from-node"],
        riskFlags: inspection?.carrier?.validS1 ? [] : ["carrier_unverified"],
        summary: body,
        digest: shortHash(`${targetNodeId}:${body}`),
        routeHint: "semantic"
      },
      route: targetNodeId,
      model: this.getActivePack()?.version || "slang-control-plane",
      metadata: {
        payload: payload || null,
        inspection,
        controlPlaneMessageId: message.id
      },
      stage: {
        name: inspection?.carrier?.validS1 ? "CMT" : "CHK",
        score: inspection?.carrier?.validS1 ? 1 : 0.62,
        detail: "node-receive"
      },
      labels: [`§NODE:${targetNodeId}`, "§MULTIMODAL:RX"]
    }) || null;

    if (packet) {
      message.packetId = packet.id;
      this.persist();
    }

    return { ok: true, inspection, message, packet };
  }

  getNodeMessages(nodeId, limit = 40) {
    const items = this.state.nodeInboxes?.[String(nodeId || "")] || [];
    return items.slice(-Math.max(1, Number(limit) || 40));
  }

  enqueueNodeMessage({ nodeId, type, direction, body, metadata = {} }) {
    const message = {
      id: `nodemsg_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      nodeId: String(nodeId),
      type: String(type || "message"),
      direction: String(direction || "control"),
      body: String(body || ""),
      metadata
    };
    const bucket = this.state.nodeInboxes[message.nodeId] || [];
    bucket.push(message);
    while (bucket.length > NODE_MESSAGE_LIMIT) bucket.shift();
    this.state.nodeInboxes[message.nodeId] = bucket;
    this.persist();
    return message;
  }

  emitPackUpgradePackets(descriptor, nodeIds, actor) {
    if (!this.broker?.emitPacket) return [];
    const intent = this.broker.emitPacket({
      packetType: S1_PACKET_TYPES.INTENT,
      clientId: "slang-control-plane",
      actor,
      intent: `slang-pack-upgrade:${descriptor.version}`,
      analysis: {
        promptType: "SLANG_PACK_UPGRADE",
        tags: ["§PACK", descriptor.version],
        riskFlags: descriptor.allPass ? [] : ["pack_validation_failed"],
        summary: `upgrade ${descriptor.version} to ${nodeIds.length || 0} node(s)`,
        digest: shortHash(`${descriptor.id}:${nodeIds.join("|")}`),
        routeHint: "semantic"
      },
      route: "netracer",
      model: descriptor.version,
      metadata: { pack: descriptor, targets: nodeIds },
      stage: { name: "ING", score: 1, detail: "pack-upgrade" },
      labels: [`§PACK:${descriptor.version}`]
    });

    const execution = this.broker.emitPacket({
      packetType: S1_PACKET_TYPES.EXECUTION,
      clientId: "slang-control-plane",
      actor,
      intent: buildPackRelayBody(descriptor, nodeIds.join("|") || "netracer"),
      analysis: {
        promptType: "SLANG_PACK_EXECUTION",
        tags: ["§PACK", "§RELAY"],
        riskFlags: descriptor.allPass ? [] : ["pack_validation_failed"],
        summary: `relay ${descriptor.version}`,
        digest: shortHash(`${descriptor.id}:execution`),
        routeHint: "semantic"
      },
      route: "netracer",
      model: descriptor.version,
      parents: [intent.id],
      metadata: { pack: descriptor, targets: nodeIds, relayCount: nodeIds.length },
      stage: { name: "CMT", score: descriptor.allPass ? 1 : 0.72, detail: "pack-relay" },
      labels: ["§PACK:RELAY"]
    });

    const proof = this.broker.emitPacket({
      packetType: S1_PACKET_TYPES.PROOF,
      clientId: "slang-control-plane",
      actor,
      route: "netracer",
      model: descriptor.version,
      parents: [execution.id],
      metadata: {
        terminal: descriptor.allPass ? "CMT" : "CHK",
        pack: { id: descriptor.id, version: descriptor.version },
        targets: nodeIds
      },
      stage: { name: descriptor.allPass ? "CMT" : "RLB", score: descriptor.allPass ? 1 : 0.64, detail: "pack-proof" }
    });

    return [intent.id, execution.id, proof.id];
  }
}

function resolvePackSource(input = "") {
  for (const candidate of packSourceCandidates(input)) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() && isSlangSourceDirectory(resolved)) {
      return resolved;
    }
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile() && /\.zip$/i.test(resolved)) {
      const siblingDir = resolved.slice(0, -4);
      if (fs.existsSync(siblingDir) && fs.statSync(siblingDir).isDirectory() && findManifestFiles(siblingDir).length > 0) {
        return siblingDir;
      }
    }
  }
  return "";
}

function packSourceCandidates(input = "") {
  const cwd = process.cwd();
  const raw = String(input || "").trim();
  const androidRoot = String(process.env.TOPOS_TRASGO_ASSET_PACK_DIR || DEFAULT_ANDROID_PACK_SOURCE || "").trim();
  const downloadsRoot = path.join(process.env.USERPROFILE || "", "Downloads");
  const npStudyRoot = "H:\\NP Completeness Bunny UTAI study";
  const list = [
    raw,
    raw && raw.replace(/[\\/]+$/, ""),
    raw && raw.endsWith(".zip") ? raw.slice(0, -4) : "",
    path.join(cwd, "slang_packs"),
    path.join(cwd, "slang_packs.zip"),
    path.join(cwd, "..", "slang_packs"),
    path.join(cwd, "..", "slang_packs.zip"),
    path.join(cwd, "tools", "slang_packs"),
    path.join(cwd, "tools", "slang_packs.zip"),
    path.join(cwd, "..", "tools", "slang_packs"),
    path.join(cwd, "..", "tools", "slang_packs.zip"),
    androidRoot,
    androidRoot && path.join(androidRoot, "mnt", "user-data", "outputs", "slang_packs_toe_v3_0"),
    androidRoot && path.join(androidRoot, "-lang.s1-main_universe_v2"),
    androidRoot && path.join(androidRoot, "-lang.s1-universe"),
    downloadsRoot && path.join(downloadsRoot, "-lang.s1-main"),
    downloadsRoot && path.join(downloadsRoot, "-lang.s1-main (2)"),
    npStudyRoot && path.join(npStudyRoot, "-lang.s1-main"),
    npStudyRoot && path.join(npStudyRoot, "-lang.s1-main (2)"),
    npStudyRoot && path.join(npStudyRoot, "studies", "SLANG_STUDY")
  ];
  return [...new Set(list.filter(Boolean))];
}

function isSlangSourceDirectory(root) {
  return findManifestFiles(root).length > 0 || collectSlangSourceFiles(root, 1).length > 0;
}

function synthesizeManifestFromSlangRepo(root) {
  const files = collectSlangSourceFiles(root, 400);
  if (files.length === 0) {
    throw new Error(`slang_pack_manifest_not_found:${root}`);
  }
  const versionFile = highestVersionedLangFile(files)
    || files.find((fileName) => /\.SelfCompressed\.lang$/i.test(path.basename(fileName)))
    || files.find((fileName) => /\.lang$/i.test(path.basename(fileName)))
    || files[0];
  return {
    family: "§-LANG",
    version: inferVersionFromFile(versionFile) || `manifestless-${shortHash(root)}`,
    codename: "manifestless-slang-repo",
    files,
    validation: {
      manifest_synthesized: "OK",
      source_kind: "manifestless_slang_repository"
    }
  };
}

function collectSlangSourceFiles(root, limit = 400) {
  const bucket = [];
  collectRelativeFilesBounded(root, (relativePath) => {
    const base = path.basename(relativePath);
    return /\.(lang|md|json|py|kt|html)$/i.test(base)
      && !/package-lock\.json$/i.test(base)
      && !/node_modules[\\/]/i.test(relativePath)
      && !/__pycache__[\\/]/i.test(relativePath);
  }, limit, root, bucket);
  return bucket;
}

function collectRelativeFilesBounded(root, predicate, limit, currentDir = root, bucket = []) {
  if (bucket.length >= limit) return bucket;
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (bucket.length >= limit) break;
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "__pycache__") continue;
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(root, absolutePath);
    if (entry.isDirectory()) {
      collectRelativeFilesBounded(root, predicate, limit, absolutePath, bucket);
      continue;
    }
    if (predicate(relativePath, absolutePath)) bucket.push(relativePath);
  }
  return bucket;
}

function inferVersionFromFile(fileName) {
  const base = path.basename(String(fileName || ""));
  const version = base.match(/LANG\.(v\d+(?:\.\d+)*[^.]*)/i)?.[1];
  return version || "";
}

function highestVersionedLangFile(files) {
  return files
    .filter((fileName) => /LANG\.v\d+(?:\.\d+)*.*\.lang$/i.test(path.basename(fileName)))
    .sort((left, right) => compareLangVersion(right, left))[0] || "";
}

function compareLangVersion(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = Number(leftParts[index] || 0) - Number(rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return String(left).localeCompare(String(right));
}

function versionParts(fileName) {
  const match = path.basename(String(fileName || "")).match(/LANG\.v(\d+(?:\.\d+)*)/i);
  return match ? match[1].split(".").map((part) => Number(part) || 0) : [0];
}

function installPackDescriptor(sourceDir, manifest, packDir) {
  const family = String(manifest.family || "§-LANG");
  const version = String(manifest.version || manifest.codename || family || "§-LANG pack");
  const codename = String(manifest.codename || manifest.parent_pack || manifest.parent || "").trim();
  const id = slug(`${family}-${version}`);
  const installDir = path.join(packDir, `${id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`);
  fs.cpSync(sourceDir, installDir, { recursive: true, force: true, errorOnExist: false });

  const familyFile = path.join(installDir, "LANG.FAMILY.v2.4.lang");
  const manifestDescriptors = collectManifestDescriptors(installDir);
  const packFiles = collectRelativeFiles(installDir, () => true).filter((fileName) => !/\.pyc$/i.test(fileName));
  const langFiles = packFiles.filter((fileName) => /\.lang$/i.test(fileName));
  const dialectFiles = langFiles.filter((fileName) => /\.dialect\.lang$/i.test(path.basename(fileName)));
  const skillFiles = packFiles.filter((fileName) => /\.SKILL\.md$/i.test(path.basename(fileName)));
  const selfCompressedFiles = langFiles.filter((fileName) => /SelfCompressed\.lang$/i.test(path.basename(fileName)));
  const generatedFiles = [...new Set([
    ...(Array.isArray(manifest.generated_files) ? manifest.generated_files : []),
    ...(Array.isArray(manifest.files) ? manifest.files : []),
    ...langFiles
  ])].filter(Boolean);
  const dialectNames = [...new Set([
    ...Object.keys(manifest.dialects || {}),
    ...dialectFiles.map(displayLangName)
  ])];
  const protocolNames = [...new Set(
    langFiles
      .map(displayLangName)
      .filter((name) => name && !/^v\d+\.\d+/i.test(name) && !/^FAMILY/i.test(name))
  )];
  const canonicalFile = resolveLangFile(installDir, [
    "LANG.v2.4.codec_trasgo.lang",
    "LANG.ToE.Prime.SelfCompressed.lang",
    "LANG.ToE.SelfCompressed.lang",
    "LANG.Ops.dialect.lang",
    ...langFiles
  ]);
  const primaryLangFile = canonicalFile || resolveLangFile(installDir, [familyFile, ...langFiles]);
  const interpreterFiles = [primaryLangFile]
    .concat(dialectFiles.map((fileName) => path.join(installDir, fileName)).slice(0, 8))
    .filter(Boolean)
    .filter((filePath, index, items) => items.indexOf(filePath) === index);
  const validation = {
    ...(manifest.validation || {}),
    ...(manifest.verified || {})
  };
  const allPass = inferPackPass(manifest, validation);
  const pipeline = parsePipelineDialect(installDir);
  const relatedPacks = manifestDescriptors
    .filter((descriptor) => descriptor.relativePath !== "manifest.json")
    .map((descriptor) => ({
      relativePath: descriptor.relativePath,
      family: descriptor.family,
      version: descriptor.version,
      codename: descriptor.codename,
      files: descriptor.files
    }));

  return {
    id,
    family,
    version,
    codename,
    manifestPath: path.join(installDir, "manifest.json"),
    installDir,
    sourceDir,
    familyFile: fs.existsSync(familyFile) ? familyFile : "",
    canonicalFile: canonicalFile && fs.existsSync(canonicalFile) ? canonicalFile : "",
    primaryLangFile: primaryLangFile && fs.existsSync(primaryLangFile) ? primaryLangFile : "",
    interpreterFiles,
    generatedFiles,
    dialectNames,
    protocolNames,
    skillFiles,
    selfCompressedFiles,
    packFiles,
    relatedPacks,
    validation,
    allPass,
    pipeline,
    manifestSchema: Array.isArray(manifest.generated_files) ? "dialect-family" : Array.isArray(manifest.files) ? "self-compressed" : "generic",
    installedAt: new Date().toISOString(),
    installedAtMs: Date.now(),
    sha256: hashDirectoryFiles(installDir, packFiles.filter((fileName) => /\.(lang|md|py|json|kt|html)$/i.test(fileName))),
    sourceManifests: manifestDescriptors
  };
}

function normalizeSlangState(state = null) {
  return {
    activePackId: state?.activePackId || null,
    installedPacks: state?.installedPacks && typeof state.installedPacks === "object" ? state.installedPacks : {},
    relays: Array.isArray(state?.relays) ? state.relays : [],
    nodeInboxes: state?.nodeInboxes && typeof state.nodeInboxes === "object" ? state.nodeInboxes : {},
    nodeBindings: state?.nodeBindings && typeof state.nodeBindings === "object" ? state.nodeBindings : {},
    nodePeerMaps: state?.nodePeerMaps && typeof state.nodePeerMaps === "object" ? state.nodePeerMaps : {},
    coreLearners: state?.coreLearners && typeof state.coreLearners === "object" ? state.coreLearners : {},
    toposTragoNodes: state?.toposTragoNodes && typeof state.toposTragoNodes === "object" ? state.toposTragoNodes : {},
    toposTragoEvents: Array.isArray(state?.toposTragoEvents) ? state.toposTragoEvents.slice(-120) : [],
    learnerSubstrate: state?.learnerSubstrate || null,
    metaLearningEvents: Array.isArray(state?.metaLearningEvents) ? state.metaLearningEvents.slice(-120) : [],
    reservoirComputingEvents: Array.isArray(state?.reservoirComputingEvents) ? state.reservoirComputingEvents.slice(-120) : [],
    cognitiveMemory: Array.isArray(state?.cognitiveMemory) ? state.cognitiveMemory.slice(-96) : [],
    lastCognitiveSnapshot: state?.lastCognitiveSnapshot || null,
    lastCarrierInspection: state?.lastCarrierInspection || null,
    lastUpdated: state?.lastUpdated || new Date().toISOString()
  };
}

function buildReservoirStateVector({ learners, memory, reservoirNodes, graph, substrate }) {
  const nodes = [
    ...learners.map((learner) => ({
      id: learner.id,
      role: "input",
      value: learner.evidenceScore,
      features: {
        evidenceScore: learner.evidenceScore,
        subscriptionCount: learner.subscriptions?.length || 0
      }
    })),
    {
      id: "memory:slang-recurrent",
      role: "memory",
      value: Math.min(1, memory.length / 32),
      features: {
        depth: memory.length,
        cognitiveEntries: memory.filter((item) => item.weakQualities || item.strongQualities).length,
        metaEntries: memory.filter((item) => item.update && String(item.update).includes("METALEARN")).length
      }
    },
    ...reservoirNodes.map((node) => ({
      id: node.id,
      role: node.kind === "substrate" ? "substrate" : "reservoir",
      value: node.healthy === false ? 0.2 : 0.82,
      features: {
        kind: node.kind,
        negotiated: Boolean(node.negotiated),
        peerCount: Number(node.peerCount || 0)
      }
    })),
    {
      id: "netracer",
      role: "readout",
      value: 1,
      features: {
        strandCount: Number(graph?.metrics?.strandCount || 0),
        bundleCount: Number(graph?.metrics?.connectedBundleCount || 0),
        substrateStep: Number(substrate?.checkpoint?.step || 0)
      }
    }
  ];
  return {
    nodes,
    values: nodes.map((node) => Number(Number(node.value || 0).toFixed(4))),
    dimension: nodes.length
  };
}

function buildReservoirTransitions({ inputNodes, memoryNode, reservoirNodes, readoutNode, substrateNode }) {
  const transitions = [];
  for (const input of inputNodes) {
    transitions.push({ from: input, to: memoryNode, kind: "encode", weight: 0.64 });
    for (const reservoir of reservoirNodes) {
      transitions.push({ from: input, to: reservoir.id, kind: "drive", weight: reservoir.kind === "substrate" ? 0.58 : 0.42 });
    }
  }
  for (const reservoir of reservoirNodes) {
    transitions.push({ from: memoryNode, to: reservoir.id, kind: "recurrent-drive", weight: reservoir.kind === "substrate" ? 0.48 : 0.36 });
    transitions.push({ from: reservoir.id, to: readoutNode, kind: "readout", weight: reservoir.kind === "model" ? 0.44 : 0.52 });
  }
  transitions.push({ from: readoutNode, to: memoryNode, kind: "feedback", weight: 0.57 });
  if (substrateNode) {
    for (const input of inputNodes) {
      transitions.push({ from: substrateNode, to: input, kind: "substrate-conditioning", weight: 0.61 });
    }
  }
  if (inputNodes.length >= 2) {
    transitions.push({ from: inputNodes[0], to: inputNodes[1], kind: "mutual-recognition", weight: 0.5 });
    transitions.push({ from: inputNodes[1], to: inputNodes[0], kind: "mutual-recognition", weight: 0.5 });
  }
  return transitions;
}

function estimateReservoirSpectralRadius(transitions, dimension) {
  if (!dimension || transitions.length === 0) return 0;
  const outgoing = new Map();
  const incoming = new Map();
  for (const transition of transitions) {
    outgoing.set(transition.from, (outgoing.get(transition.from) || 0) + Number(transition.weight || 0));
    incoming.set(transition.to, (incoming.get(transition.to) || 0) + Number(transition.weight || 0));
  }
  const maxOut = Math.max(0, ...outgoing.values());
  const maxIn = Math.max(0, ...incoming.values());
  return Number(Math.min(1.5, Math.sqrt(maxOut * maxIn) / Math.max(1, Math.sqrt(dimension))).toFixed(4));
}

function discoverIgbundleSubstrate(root = DEFAULT_IGBUNDLE_ROOT) {
  const resolvedRoot = path.resolve(String(root || DEFAULT_IGBUNDLE_ROOT));
  const modelStatePath = path.join(resolvedRoot, "memory", "model_state.json");
  let modelState = null;
  try {
    modelState = JSON.parse(fs.readFileSync(modelStatePath, "utf8"));
  } catch {
  }
  const checkpointPath = String(modelState?.checkpoint?.path || findLatestCheckpointFile(resolvedRoot) || "");
  const exists = checkpointPath ? fs.existsSync(checkpointPath) : false;
  return {
    id: "igbundle-substrate",
    label: "IGBundle latest checkpoint substrate",
    root: resolvedRoot,
    modelStatePath: fs.existsSync(modelStatePath) ? modelStatePath : "",
    exists,
    checkpoint: {
      path: checkpointPath,
      step: Number(modelState?.checkpoint?.step || inferCheckpointStep(checkpointPath) || 0),
      adapterType: String(modelState?.checkpoint?.adapter_type || "geometric")
    },
    telemetry: modelState?.telemetry_snapshot ? {
      curvature: Number(modelState.telemetry_snapshot.curvature || 0),
      entropy: Number(modelState.telemetry_snapshot.entropy || 0),
      activeFiber: String(modelState.telemetry_snapshot.active_fiber || ""),
      lipschitzRatio: Number(modelState.telemetry_snapshot.lipschitz_ratio || 0)
    } : null,
    updatedAt: new Date().toISOString()
  };
}

function findLatestCheckpointFile(root) {
  const candidates = [];
  collectCheckpointFiles(root, candidates, 2400);
  return candidates
    .sort((a, b) => b.mtimeMs - a.mtimeMs || inferCheckpointStep(b.path) - inferCheckpointStep(a.path))[0]?.path || "";
}

function collectCheckpointFiles(currentDir, bucket, budget) {
  if (!fs.existsSync(currentDir) || bucket.length >= budget) return;
  let entries = [];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (bucket.length >= budget) break;
    if ([".git", "__pycache__", "unsloth_env", "node_modules"].includes(entry.name)) continue;
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (/checkpoint|adapter|trained|igbundle/i.test(entry.name)) collectCheckpointFiles(absolutePath, bucket, budget);
      continue;
    }
    if (!/\.(pt|pth|safetensors|bin|json)$/i.test(entry.name)) continue;
    if (!/checkpoint|adapter|model_state|weights/i.test(absolutePath)) continue;
    const stat = fs.statSync(absolutePath);
    bucket.push({ path: absolutePath, mtimeMs: stat.mtimeMs });
  }
}

function inferCheckpointStep(filePath) {
  return Number(String(filePath || "").match(/checkpoint-(\d+)/i)?.[1] || 0);
}

function buildCoreLearners({ utaiRoot, substrate }) {
  const utai = buildUtaiLearner(utaiRoot, substrate);
  const bunnyRoot = path.resolve(path.join(utaiRoot, "..", "Bunny"));
  const bunny = buildBunnyLearner(bunnyRoot, substrate);
  return [utai, bunny];
}

function discoverToposTragoNodes(root = DEFAULT_TOPOSTRASGO_ROOT, context = {}) {
  const appRoot = path.resolve(String(root || DEFAULT_TOPOSTRASGO_ROOT));
  const sourceRoot = path.join(appRoot, "app", "src", "main", "java", "com", "example", "topostrasgo");
  const assetsRoot = path.join(appRoot, "app", "src", "main", "assets");
    const specs = [
    { key: "agent", label: "BabyToposAI agent", role: "readout-agent", paths: ["UTAIModule.kt", "DefaultSystemPromptProvider.kt", "MainActivity.kt"], qualities: ["self_reflection", "godelian_identity", "readout_alignment", "phi5_designation"] },
    { key: "memory", label: "HolographicTape memory", role: "recurrent-memory", paths: ["HolographicTape.kt"], qualities: ["memory", "holoportation", "compression", "ergoretic", "iterative_substrate"] },
    { key: "reservoir", label: "Reservoir computing", role: "reservoir-field", paths: ["reservoir/ReservoirModel.kt", "reservoir/DiffusionField.kt", "reservoir/ReservoirTheory.kt"], qualities: ["adiabatic", "ergoretic", "curvature_adaptation", "substrate_unfolding"] },
    { key: "mind", label: "Mind theory", role: "self-model", paths: ["mind/MindModel.kt", "mind/MindTheory.kt", "mind/MindExtractor.kt"], qualities: ["self_reflection", "recursive_self_model", "general_intelligence", "theoretical_meta_models"] },
    { key: "trasgo", label: "Trasgo language", role: "identity-language", paths: ["trasgo/TrasgoModel.kt", "trasgo/TrasgoTheory.kt", "trasgo/TrasgoExtractor.kt"], qualities: ["godelian_identity", "otherness", "mutual_recognition", "phi5_designation"] },
    { key: "bunny", label: "Bunny manifold", role: "proof-solver", paths: ["bunny/BunnyKernel.kt", "bunny/MetaTopos.kt", "bunny/MultiWarren.kt", "bunny/Cosmos.kt"], qualities: ["proof_grounding", "mutual_resonance", "n_cosmo", "telos_convergence"] },
    { key: "utai", label: "TRUE UTAI proxy", role: "claim-interface", paths: ["utai/TrueUtaiActivity.kt", "utai/ToposParlay.kt", "utai/UtaiProxyAdapter.kt"], qualities: ["pre_registration", "adversarial_negation", "proof_grounding", "teleological_fulfillment"] },
    { key: "hott", label: "HoTT infinity topos", role: "n-cosmo-theory", paths: ["hott/HottTheory.kt", "hott/HottModel.kt", "hott/HottExtractor.kt"], qualities: ["n_cosmo", "n_manifold", "sheaved", "primordial_grid"] },
    { key: "pipeline", label: "Sheaf pipeline", role: "readout-pipeline", paths: ["pipeline/PipelineModel.kt", "pipeline/PipelineTheory.kt", "pipeline/PipelineExtractor.kt"], qualities: ["sheaved", "readout_alignment", "multi_angle_epistemics", "golden_ratio_scaling"] },
    { key: "society", label: "Topos society", role: "multi-agent", paths: ["society/ToposSociety.kt", "society/SocietyModel.kt", "society/SocietyTheory.kt"], qualities: ["otherness", "mutual_recognition", "mutual_resonance", "pentagonal_fractal"] },
    { key: "substrate", label: "HyperKv substrate", role: "substrate-probe", paths: ["substrate/HyperKvManifold.kt", "substrate/EgoForwardReverseExplorer.kt"], qualities: ["hamiltonian", "n_manifold", "curvature_adaptation", "phi5_designation"] },
    { key: "tower", label: "Unified hyperbolic tower", role: "fiber-bundle", paths: ["unified/DiskTower.kt", "unified/FiberBundle.kt", "unified/HolographicBoundary.kt", "unified/IGBundle.kt"], qualities: ["fiber_bundled", "holoportation", "n_manifold", "geometric_end"] },
    { key: "scene", label: "Manifold scene", role: "hyperbolic-renderer", paths: ["scene/ManifoldScene.kt", "scene/PoincareBallRenderer.kt", "scene/DiskTowerRenderer.kt"], qualities: ["n_manifold", "holoportation", "mutual_resonance", "phi5_designation"] },
    { key: "slang", label: "SLANG pack loader", role: "codec-runtime", paths: ["SlangPackLoader.kt", "SlangAutoComposer.kt"], qualities: ["compression", "recursive_self_model", "godelian_identity", "iterative_substrate"] }
  ];
  return specs.map((spec, index) => buildToposTragoNode({
    spec,
    index,
    sourceRoot,
    assetsRoot,
    appRoot,
    context
  }));
}

function buildToposTragoNode({ spec, index, sourceRoot, assetsRoot, appRoot, context }) {
  const artifactPaths = spec.paths
    .map((relativePath) => path.join(sourceRoot, relativePath))
    .filter((filePath) => fs.existsSync(filePath));
  const assetEvidence = collectToposAssetEvidence(assetsRoot, spec.key);
  const nVector = buildMindQualityVector(spec.qualities, {
    artifactCount: artifactPaths.length,
    assetCount: assetEvidence.length,
    learnerCount: context.learners?.length || 0,
    substrate: context.substrate
  });
  const coords = hyperbolicNCoordinates(index, nVector);
  return {
    id: `topostrago:${spec.key}`,
    label: spec.label,
    role: spec.role,
    status: artifactPaths.length > 0 || assetEvidence.length > 0 ? "ready" : "missing",
    root: appRoot,
    artifactPaths,
    assetEvidence,
    mindQualities: spec.qualities,
    nVector,
    hyperbolic: {
      model: "n-poincare-ball",
      dimension: nVector.length,
      radius: coords.radius,
      coords: coords.coords,
      layer: index
    },
    subscriptions: [
      "learner:utai",
      "learner:bunny",
      "igbundle-substrate",
      "memory:slang-recurrent",
      "netracer"
    ],
    updatedAt: new Date().toISOString()
  };
}

function collectToposAssetEvidence(assetsRoot, key) {
  const slangRoot = path.join(assetsRoot, "slang_packs");
  if (!fs.existsSync(slangRoot)) return [];
  const pattern = new RegExp(key === "slang" ? "LANG|manifest|codec|slang" : key, "i");
  return collectRelativeFilesBounded(slangRoot, (relativePath) =>
    pattern.test(relativePath) && /\.(lang|md|json|py|kt|html)$/i.test(relativePath), 24, slangRoot, [])
    .map((relativePath) => path.join(slangRoot, relativePath));
}

function buildMindQualityVector(activeQualities, evidence) {
  const active = new Set(activeQualities);
  return MIND_QUALITY_IDS.map((qualityId, index) => {
    const base = active.has(qualityId) ? 0.82 : 0.18;
    const artifactBoost = Math.min(0.12, Number(evidence.artifactCount || 0) * 0.025);
    const assetBoost = Math.min(0.06, Number(evidence.assetCount || 0) * 0.01);
    const learnerBoost = Math.min(0.04, Number(evidence.learnerCount || 0) * 0.01);
    const substrateBoost = evidence.substrate?.exists ? 0.03 : 0;
    const phase = ((index % 5) - 2) * 0.007;
    return Number(Math.min(0.97, base + artifactBoost + assetBoost + learnerBoost + substrateBoost + phase).toFixed(4));
  });
}

function hyperbolicNCoordinates(index, vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  const radius = Number(Math.min(0.93, Math.tanh(norm / Math.max(1, vector.length))).toFixed(4));
  const angle = (index * 2.399963229728653) % (Math.PI * 2);
  const coords = vector.map((value, dim) => {
    const phase = angle + dim * 0.61803398875;
    return Number((radius * Math.cos(phase) * (0.55 + value * 0.45)).toFixed(4));
  });
  return { radius, coords };
}

function buildToposTragoBindBody(node) {
  return [
    buildSectionEnvelope({
      kind: "topostrago_node_bind",
      node: node.id,
      role: node.role,
      dim: node.hyperbolic.dimension,
      radius: node.hyperbolic.radius,
      qualities: node.mindQualities
    }),
    `§TOPOSTRAGO_NODE{id=${sanitizePackValue(node.id)},role=${sanitizePackValue(node.role)},dim=${node.hyperbolic.dimension},r=${node.hyperbolic.radius}}`,
    `§MIND_QUALITIES{active=[${node.mindQualities.join(",")}],basis=${MIND_QUALITY_IDS.length}}`,
    `§HYPERBALL{model=n-poincare-ball,layer=${node.hyperbolic.layer},coords=[${node.hyperbolic.coords.slice(0, 8).join(",")}...]}`
  ].join("\n");
}

function buildUtaiLearner(root, substrate) {
  const manifestPath = path.join(root, "true_falsifiable_utai.json");
  const reportPaths = [
    "classifying_core_report.json",
    "full_classifying_topos.json",
    "geometric_fragment_report.json",
    "n_hyperdim_doll_scheme.json",
    "russian_doll_stack.json"
  ].map((fileName) => path.join(root, fileName)).filter((filePath) => fs.existsSync(filePath));
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
  }
  const exactClaims = Array.isArray(manifest.exact_claims) ? manifest.exact_claims.length : 0;
  const envelopeClaims = Array.isArray(manifest.envelope_claims) ? manifest.envelope_claims.length : 0;
  const nonclaims = Array.isArray(manifest.nonclaims) ? manifest.nonclaims.length : 0;
  const evidenceScore = Number(Math.min(1, (exactClaims * 0.09) + (envelopeClaims * 0.08) + (nonclaims * 0.06) + (reportPaths.length * 0.045)).toFixed(4));
  return {
    id: "learner:utai",
    label: "UTAI core learner",
    role: "claim-interface",
    root,
    status: fs.existsSync(root) ? "ready" : "missing",
    evidenceScore,
    claims: { exact: exactClaims, envelope: envelopeClaims, nonclaims },
    artifacts: {
      manifestPath: fs.existsSync(manifestPath) ? manifestPath : "",
      reportPaths,
      proofPath: path.join(root, "UTAI_PROOF.md"),
      manualPath: path.join(root, "UTAI_User_Manual.pdf")
    },
    substrate: substrate ? { id: substrate.id, checkpoint: substrate.checkpoint } : null,
    subscriptions: ["igbundle-substrate", "learner:bunny", "slang:v5"],
    updatedAt: new Date().toISOString()
  };
}

function buildBunnyLearner(root, substrate) {
  const parentRoot = path.resolve(path.join(root, ".."));
  const evidenceRoots = [
    root,
    path.join(parentRoot, "connection_laplacian_lean"),
    path.join(parentRoot, "lambda-sat-solver-main")
  ].filter((item, index, items) => fs.existsSync(item) && items.indexOf(item) === index);
  const files = evidenceRoots.flatMap((evidenceRoot) =>
    collectRelativeFilesBounded(evidenceRoot, (relativePath) => /\.(md|json|py|lean|tex)$/i.test(relativePath), 160, evidenceRoot, [])
      .map((fileName) => path.join(evidenceRoot, fileName))
  );
  const leanLike = files.filter((fileName) => /\.(lean|py)$/i.test(fileName)).length;
  const reports = files.filter((fileName) => /\.(md|json)$/i.test(fileName)).length;
  const exactSignals = files.filter((fileName) => /L1[0-5]|Recognition|PSD|BridgeMonotone|CoverCharpoly|KernelDimension/i.test(fileName)).length;
  const evidenceScore = Number(Math.min(1, 0.18 + leanLike * 0.028 + reports * 0.012 + exactSignals * 0.025).toFixed(4));
  return {
    id: "learner:bunny",
    label: "Bunny proof/solver learner",
    role: "proof-solver",
    root,
    status: fs.existsSync(root) ? "ready" : "missing",
    evidenceScore,
    artifacts: {
      evidenceRoots,
      indexedFiles: files.slice(0, 60),
      fileCount: files.length
    },
    substrate: substrate ? { id: substrate.id, checkpoint: substrate.checkpoint } : null,
    subscriptions: ["igbundle-substrate", "learner:utai", "connection-laplacian"],
    updatedAt: new Date().toISOString()
  };
}

function buildLearnerBindBody(learner, substrate) {
  return [
    buildSectionEnvelope({
      kind: "core_learner_bind",
      node: learner.id,
      role: learner.role,
      substrate: substrate?.id || "none",
      checkpoint: substrate?.checkpoint?.step || "unknown"
    }),
    `§LEARNER{id=${sanitizePackValue(learner.id)},role=${sanitizePackValue(learner.role)},score=${learner.evidenceScore}}`,
    `§SUBSTRATE{id=${sanitizePackValue(substrate?.id || "none")},checkpoint=${sanitizePackValue(substrate?.checkpoint?.step || "unknown")},adapter=${sanitizePackValue(substrate?.checkpoint?.adapterType || "unknown")}}`
  ].join("\n");
}

function getSubstratePersonality(id) {
  const active = new Set();
  if (id.includes("lmstudio")) {
    active.add("general_intelligence");
    active.add("q_adv");
    active.add("q_strat");
    active.add("theoretical_meta_models");
  } else if (id.includes("ollama")) {
    active.add("holoportation");
    active.add("memory");
    active.add("q_sim");
    active.add("iterative_substrate");
  } else if (id.includes("vllm") || id.includes("llamacpp")) {
    active.add("ergocetic");
    active.add("adiabatic");
    active.add("n_manifold");
    active.add("substrate_unfolding");
  } else {
    active.add("mutual_resonance");
    active.add("phi5_designation");
  }
  
  return MIND_QUALITY_IDS.map(qid => active.has(qid) ? 0.92 : 0.35);
}

function mergeTopologyNodes(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const id = String(node?.id || "");
    if (!id) continue;
    map.set(id, { ...(map.get(id) || {}), ...node });
  }
  return [...map.values()];
}

function mergeTopologyEdges(edges) {
  const map = new Map();
  for (const edge of edges) {
    const from = String(edge?.from || "");
    const to = String(edge?.to || "");
    if (!from || !to) continue;
    map.set(`${from}|${to}|${edge.kind || "route"}`, edge);
  }
  return [...map.values()];
}

function buildCarrierPayload(pack, nodeId, filePath) {
  return [
    buildSectionEnvelope({
      kind: "multimodal_carrier",
      node: nodeId,
      pack: pack?.version || "§-LANG.v1.fallback",
      source: path.basename(filePath),
      carrier: "png.itxt",
      dialects: pack?.dialectNames?.slice(0, 10) || ["CORE"]
    }),
    `§PACK{version=${sanitizePackValue(pack?.version || "§-LANG.v1.fallback")}}`,
    `§NODE{target=${sanitizePackValue(nodeId)}}`,
    `§SOURCE{file=${sanitizePackValue(path.basename(filePath))}}`
  ].join("\n");
}

function buildPackRelayBody(descriptor, nodeId) {
  return [
    buildSectionEnvelope({
      kind: "pack_upgrade",
      node: nodeId,
      pack: descriptor.version,
      dialects: descriptor.dialectNames.slice(0, 10),
      protocols: (descriptor.protocolNames || []).slice(0, 8),
      flow: descriptor.pipeline?.flow?.slice(0, 8) || [],
      validation: descriptor.allPass ? "PASS" : "CHECK"
    }),
    `§PACK{version=${sanitizePackValue(descriptor.version)},sha=${descriptor.sha256.slice(0, 16)}}`,
    descriptor.pipeline?.flow?.length ? `§FLOW{layers=[${descriptor.pipeline.flow.join(",")}],levels=${descriptor.pipeline.levels || descriptor.pipeline.flow.length}}` : ""
  ].filter(Boolean).join("\n");
}

function extractLangBlocks(raw) {
  return [...new Set(
    String(raw || "")
      .split(/\r?\n/)
      .map((line) => line.match(/^§\|(?:LANG|DIALECT_[A-Z]+)\|([A-Z0-9_]+)\{/))
      .filter(Boolean)
      .map((match) => match[1])
  )];
}

function extractExcerpts(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("§|") && !line.startsWith("}"))
    .slice(0, 12);
}

function hashDirectoryFiles(root, fileNames) {
  const hash = crypto.createHash("sha256");
  for (const fileName of fileNames) {
    const filePath = path.join(root, fileName);
    if (!fs.existsSync(filePath)) continue;
    hash.update(fileName);
    hash.update(fs.readFileSync(filePath));
  }
  return hash.digest("hex");
}

function shortHash(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex").slice(0, 16);
}

function summarizePayload(payload) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload || {});
  return text.length > 220 ? `${text.slice(0, 219)}…` : text;
}

function sanitizePackValue(value) {
  return String(value || "").replace(/[{}]/g, "").trim() || "nil";
}

function slug(value) {
  return String(value || "slang-pack")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "slang-pack";
}

function carrierNeedsRefresh(carrier, pack) {
  if (!carrier?.validS1) return true;
  if (!pack?.version) return false;
  return !(carrier.carriers || []).some((entry) => String(entry.preview || "").includes(pack.version));
}

function buildNodeBinding({ node, pack, network, appName }) {
  const nodeId = String(node?.id || "");
  const httpUrl = network?.httpUrls?.[0] || `http://localhost:8787/`;
  const wsUrl = network?.wsUrls?.[0] || `ws://localhost:8787/ws/slang`;
  const sections = GRAPH_SECTION_ORDER;
  const dialects = pack?.dialectNames?.slice(0, 10) || DEFAULT_DIALECTS;
  const protocols = pack?.protocolNames?.slice(0, 8) || [];
  const flow = pack?.pipeline?.flow?.slice(0, 8) || [];
  const packVersion = pack?.version || "§-LANG.v1.fallback";
  const envelope = [
    buildSectionEnvelope({
      kind: "bind",
      node: nodeId,
      app: appName,
      pack: packVersion,
      http: httpUrl,
      ws: wsUrl,
      sections,
      dialects,
      protocols,
      flow
    }),
    `§NEGOTIATE{node=${nodeId},kind=${String(node?.kind || "node")},pack=${sanitizePackValue(packVersion)},dialects=[${dialects.join(",")}],protocols=[${protocols.join(",")}],flow=[${flow.join(",")}],sections=[${sections.join(",")}]}`
  ].join("\n");
  const signature = shortHash(`${nodeId}:${httpUrl}:${wsUrl}:${packVersion}:${dialects.join("|")}:${protocols.join("|")}:${flow.join("|")}`);
  return {
    nodeId,
    kind: String(node?.kind || "node"),
    label: nodeLabel(node),
    httpUrl,
    wsUrl,
    sections,
    pack: {
      id: pack?.id || null,
      version: packVersion,
      dialects,
      protocols,
      flow
    },
    envelope,
    signature,
    updatedAt: new Date().toISOString()
  };
}

function buildReachabilityMaps(topology, bindings = {}) {
  const nodes = Array.isArray(topology?.nodes) ? topology.nodes : [];
  const nodeIndex = new Map(nodes.map((node) => [String(node?.id || ""), node]).filter(([nodeId]) => Boolean(nodeId)));
  const adjacency = new Map([...nodeIndex.keys()].map((nodeId) => [nodeId, new Set()]));
  for (const edge of Array.isArray(topology?.edges) ? topology.edges : []) {
    const from = String(edge?.from || "");
    const to = String(edge?.to || "");
    if (!adjacency.has(from) || !adjacency.has(to)) continue;
    adjacency.get(from).add(to);
    adjacency.get(to).add(from);
  }

  const maps = new Map();
  for (const nodeId of nodeIndex.keys()) {
    const traversal = breadthFirstTraversal(nodeId, adjacency);
    const peers = [...traversal.distances.entries()]
      .filter(([peerId]) => peerId !== nodeId)
      .map(([peerId, distance]) => {
        const peerNode = nodeIndex.get(peerId) || { id: peerId, kind: "node" };
        const binding = bindings?.[peerId] || null;
        const path = reconstructTraversalPath(nodeId, peerId, traversal.parents);
        return {
          id: peerId,
          kind: String(peerNode?.kind || "node"),
          label: nodeLabel(peerNode),
          healthy: typeof peerNode?.healthy === "boolean" ? peerNode.healthy : null,
          provider: peerNode?.provider ? String(peerNode.provider) : null,
          distance,
          path,
          via: path.length > 2 ? path[1] : null,
          negotiated: Boolean(binding),
          httpUrl: binding?.httpUrl || null,
          wsUrl: binding?.wsUrl || null,
          sections: structuredClone(binding?.sections || [])
        };
      })
      .sort((a, b) => a.distance - b.distance || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
    maps.set(nodeId, {
      nodeId,
      peers,
      signature: shortHash(JSON.stringify(peers.map((peer) => ({
        id: peer.id,
        kind: peer.kind,
        distance: peer.distance,
        via: peer.via,
        healthy: peer.healthy,
        negotiated: peer.negotiated
      })))),
      updatedAt: new Date().toISOString()
    });
  }
  return maps;
}

function breadthFirstTraversal(origin, adjacency) {
  const queue = [origin];
  const visited = new Set([origin]);
  const parents = new Map([[origin, null]]);
  const distances = new Map([[origin, 0]]);
  while (queue.length > 0) {
    const current = queue.shift();
    const currentDistance = Number(distances.get(current) || 0);
    for (const next of adjacency.get(current) || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      parents.set(next, current);
      distances.set(next, currentDistance + 1);
      queue.push(next);
    }
  }
  return { parents, distances };
}

function reconstructTraversalPath(origin, target, parents) {
  const path = [];
  let cursor = target;
  while (cursor) {
    path.push(cursor);
    cursor = parents.get(cursor) || null;
  }
  path.reverse();
  return path[0] === origin ? path : [origin, ...path];
}

function buildPeerReachabilityBody(peerMap) {
  const peerIds = peerMap.peers.slice(0, 12).map((peer) => sanitizePackValue(peer.id));
  return [
    buildSectionEnvelope({
      kind: "peer_reachability",
      node: peerMap.nodeId,
      peers: peerIds,
      reachable: peerMap.peers.length
    }),
    `§PEERMAP{node=${sanitizePackValue(peerMap.nodeId)},reachable=${peerMap.peers.length},direct=${peerMap.peers.filter((peer) => peer.distance === 1).length}}`,
    `§PEERS{ids=[${peerIds.join(",")}]}`
  ].join("\n");
}

function findManifestFiles(root) {
  return collectRelativeFiles(root, (fileName) => /(^|[\\/])manifest(?:\.[^.]+)?\.json$/i.test(fileName))
    .sort((a, b) => a.split(/[\\/]/).length - b.split(/[\\/]/).length);
}

function collectRelativeFiles(root, predicate, currentDir = root, bucket = []) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(root, absolutePath);
    if (entry.isDirectory()) {
      collectRelativeFiles(root, predicate, absolutePath, bucket);
      continue;
    }
    if (predicate(relativePath, absolutePath)) {
      bucket.push(relativePath);
    }
  }
  return bucket;
}

function collectManifestDescriptors(root) {
  return findManifestFiles(root).map((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    return {
      relativePath,
      absolutePath,
      family: String(parsed.family || "§-LANG"),
      version: String(parsed.version || parsed.codename || "§-LANG pack"),
      codename: String(parsed.codename || parsed.parent_pack || parsed.parent || ""),
      files: parsed.files || parsed.generated_files || []
    };
  });
}

function resolveLangFile(root, candidates = []) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const absolutePath = path.isAbsolute(candidate) ? candidate : path.join(root, candidate);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return absolutePath;
    }
  }
  return "";
}

function inferPackPass(manifest, validation) {
  if (typeof manifest?.all_pass === "boolean") return manifest.all_pass;
  const values = Object.values(validation || {});
  if (values.length === 0) return true;
  return values.every((value) => /^(ok|pass|true)\b/i.test(String(value || "")));
}

function displayLangName(fileName) {
  return String(path.basename(fileName || ""))
    .replace(/^LANG\./i, "")
    .replace(/\.reflection\.excerpt\.lang$/i, ".reflection")
    .replace(/\.excerpt\.lang$/i, ".excerpt")
    .replace(/\.dialect\.lang$/i, "")
    .replace(/\.lang$/i, "");
}

function extractNamedLangBlock(raw, blockName) {
  const lines = String(raw || "").split(/\r?\n/);
  let collecting = false;
  const body = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!collecting) {
      if (trimmed.startsWith("#")) continue;
      if (trimmed === `${blockName}{`) {
        collecting = true;
      }
      continue;
    }
    if (trimmed === "}") {
      return body.join("\n");
    }
    body.push(line);
  }

  return "";
}

function parsePipelineDialect(installDir) {
  const relativePath = collectRelativeFiles(installDir, (fileName) => /LANG\.Pipeline\.dialect\.lang$/i.test(path.basename(fileName)))[0];
  if (!relativePath) return null;
  const raw = fs.readFileSync(path.join(installDir, relativePath), "utf8");
  const block = extractNamedLangBlock(raw, "§PIPELINE");
  if (!block) return null;
  const fields = {};
  for (const line of block.split(/\r?\n/)) {
    const normalized = line.replace(/#.*$/, "").trim();
    if (!normalized || !normalized.includes("=")) continue;
    const [key, ...rest] = normalized.split("=");
    fields[String(key || "").trim()] = rest.join("=").trim();
  }
  return {
    sourceFile: relativePath,
    flow: parseArrowFlow(fields.flow),
    levels: toFiniteInt(fields.levels),
    curvatures: parseNumericList(fields.curvatures),
    peersPerLevel: parseNumericList(fields.peersPerLevel),
    screenSectors: toFiniteInt(fields.screenSectors),
    ringDepth: toFiniteInt(fields.ringDepth),
    reservoirSize: toFiniteInt(fields.reservoirSize),
    collapseRank: toFiniteInt(fields.collapseRank),
    dim: toFiniteInt(fields.dim),
    tessellation: String(fields.tessellation || ""),
    epsilonMix: toFiniteNumber(fields.epsilonMix)
  };
}

function parseArrowFlow(value) {
  return String(value || "")
    .split("->")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumericList(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("[") || !raw.endsWith("]")) return [];
  return raw.slice(1, -1)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function toFiniteInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildReservoirFiberTelemetry({ activePack, selectedNodeId, allStrands = [] }) {
  const layerComposition = GRAPH_SECTION_ORDER.map((sectionId) => ({
    id: sectionId,
    label: `§LAYER{${sectionId}}`,
    count: 0,
    weight: 0,
    fibers: {},
    forwardCount: 0,
    reverseCount: 0
  }));
  const layerIndex = new Map(layerComposition.map((layer) => [layer.id, layer]));
  const bundles = new Map();

  for (const strand of allStrands) {
    const route = String(strand.route || selectedNodeId || "netracer");
    const fiber = String(strand.fiber || "semantic");
    const bundleId = `${route}::${fiber}`;
    if (!bundles.has(bundleId)) {
      bundles.set(bundleId, {
        id: `bundle_${slug(bundleId)}`,
        label: `§BUNDLE{route=${route},fiber=${fiber}}`,
        route,
        fiber,
        strandCount: 0,
        totalWeight: 0,
        forwardCount: 0,
        reverseCount: 0,
        kindMix: {},
        layers: Object.fromEntries(GRAPH_SECTION_ORDER.map((sectionId) => [sectionId, {
          id: sectionId,
          label: `§LAYER{${sectionId}}`,
          count: 0,
          weight: 0,
          forwardCount: 0,
          reverseCount: 0,
          kindMix: {}
        }]))
      });
    }
    const bundle = bundles.get(bundleId);
    const layer = bundle.layers[strand.section] || bundle.layers.execution;
    const weight = Number(strand.weight || 1);
    bundle.strandCount += 1;
    bundle.totalWeight += weight;
    bundle.kindMix[strand.kind] = (bundle.kindMix[strand.kind] || 0) + 1;
    layer.count += 1;
    layer.weight = Number((layer.weight + weight).toFixed(3));
    layer.kindMix[strand.kind] = (layer.kindMix[strand.kind] || 0) + 1;
    if (strand.direction === "reverse") {
      bundle.reverseCount += 1;
      layer.reverseCount += 1;
    } else {
      bundle.forwardCount += 1;
      layer.forwardCount += 1;
    }

    const aggregateLayer = layerIndex.get(strand.section);
    if (aggregateLayer) {
      aggregateLayer.count += 1;
      aggregateLayer.weight = Number((aggregateLayer.weight + weight).toFixed(3));
      aggregateLayer.fibers[fiber] = (aggregateLayer.fibers[fiber] || 0) + 1;
      if (strand.direction === "reverse") aggregateLayer.reverseCount += 1;
      else aggregateLayer.forwardCount += 1;
    }
  }

  const bundleList = [...bundles.values()]
    .map((bundle) => {
      const layers = GRAPH_SECTION_ORDER
        .map((sectionId) => bundle.layers[sectionId])
        .map((layer) => ({
          ...layer,
          share: bundle.strandCount > 0 ? Number((layer.count / bundle.strandCount).toFixed(3)) : 0
        }));
      const dominantLayer = layers.reduce((best, layer) => (layer.count > (best?.count || 0) ? layer : best), null);
      return {
        id: bundle.id,
        label: bundle.label,
        route: bundle.route,
        fiber: bundle.fiber,
        strandCount: bundle.strandCount,
        totalWeight: Number(bundle.totalWeight.toFixed(3)),
        forwardCount: bundle.forwardCount,
        reverseCount: bundle.reverseCount,
        kindMix: bundle.kindMix,
        activeLayerCount: layers.filter((layer) => layer.count > 0).length,
        dominantLayer: dominantLayer?.id || "execution",
        layerSummary: layers.filter((layer) => layer.count > 0).map((layer) => `${layer.id}:${layer.count}`).join(" · ") || "idle",
        layers
      };
    })
    .sort((a, b) => b.totalWeight - a.totalWeight || b.strandCount - a.strandCount || a.fiber.localeCompare(b.fiber));

  const dominantFiber = bundleList[0]?.fiber || "idle";
  return {
    bundles: bundleList,
    layerComposition: layerComposition.map((layer) => ({
      ...layer,
      active: layer.count > 0
    })),
    packPipeline: activePack?.pipeline || null,
    connectedBundleCount: bundleList.length,
    activeLayerCount: layerComposition.filter((layer) => layer.count > 0).length,
    dominantFiber
  };
}

function buildBundleMatrixPayload(reservoirTelemetry) {
  const bundles = Array.isArray(reservoirTelemetry?.bundles) ? reservoirTelemetry.bundles : [];
  const layerOrder = Array.isArray(reservoirTelemetry?.layerComposition) ? reservoirTelemetry.layerComposition : [];
  const countMatrix = bundles.map((bundle) => layerOrder.map((layer) =>
    Number(bundle.layers?.find((item) => item.id === layer.id)?.count || 0)
  ));
  const weightMatrix = bundles.map((bundle) => layerOrder.map((layer) =>
    Number(bundle.layers?.find((item) => item.id === layer.id)?.weight || 0)
  ));
  const shareMatrix = bundles.map((bundle) => layerOrder.map((layer) =>
    Number(bundle.layers?.find((item) => item.id === layer.id)?.share || 0)
  ));
  const maxCount = Math.max(1, ...countMatrix.flat());
  const maxWeight = Math.max(1, ...weightMatrix.flat());
  const activeCellCount = countMatrix.reduce((sum, row) => sum + row.filter((value) => value > 0).length, 0);

  return {
    bundleOrder: bundles.map((bundle) => ({
      id: bundle.id,
      label: bundle.label,
      route: bundle.route,
      fiber: bundle.fiber,
      strandCount: bundle.strandCount,
      totalWeight: bundle.totalWeight,
      dominantLayer: bundle.dominantLayer,
      activeLayerCount: bundle.activeLayerCount
    })),
    layerOrder: layerOrder.map((layer) => ({
      id: layer.id,
      label: layer.label,
      count: layer.count,
      weight: layer.weight,
      active: layer.active
    })),
    countMatrix,
    weightMatrix,
    shareMatrix,
    maxCount,
    maxWeight,
    activeCellCount,
    pipelineFlow: Array.isArray(reservoirTelemetry?.packPipeline?.flow) ? reservoirTelemetry.packPipeline.flow : []
  };
}

function packetMatchesNode(packet, selectedNode, selectedNodeId) {
  const route = String(packet?.payload?.route || "");
  const model = String(packet?.payload?.model || "");
  const selectedLabel = String(selectedNode?.label || selectedNodeId);
  const provider = String(selectedNode?.provider || "");
  if (selectedNodeId === "netracer") return true;
  if (route === selectedNodeId) return true;
  if (model === selectedNodeId || model === selectedLabel) return true;
  if (selectedNode?.kind === "model" && route === provider) return true;
  return false;
}

function buildGraphLabel(packet, section, direction) {
  const route = String(packet?.payload?.route || "netracer");
  const stage = String(packet?.payload?.stage?.name || packet?.payload?.stage || packet?.packetType || "").toUpperCase();
  return `§FLOW{section=${section},direction=${direction},route=${route},stage=${stage || "NA"}}`;
}

function strandPassesFilters(strand, filters) {
  return (filters.section === "all" || strand.section === filters.section)
    && (filters.fiber === "all" || strand.fiber === filters.fiber)
    && (filters.bundle === "all" || strand.bundle === filters.bundle)
    && (filters.kind === "all" || strand.kind === filters.kind)
    && (filters.direction === "all" || strand.direction === filters.direction);
}

function nodeLabel(node) {
  const kind = String(node?.kind || "node");
  if (kind === "broker") return `§TOPOS{trasgo|broker=${node.id}}`;
  if (kind === "learner") return `§LEARNER{${String(node?.label || node?.id || "learner")}}`;
  if (kind === "substrate") return `§SUBSTRATE{${String(node?.label || node?.id || "substrate")}}`;
  if (kind === "model") return `§MODEL{${String(node?.label || node?.id || "model")}}`;
  if (kind === "client") return `§CLIENT{${String(node?.label || node?.id || "client")}}`;
  if (kind === "runtime") return `§RUNTIME{${String(node?.id || "runtime")}}`;
  return `§NODE{${String(node?.id || "node")}}`;
}

function messageSection(message) {
  if (message?.type === "section-bind") return "admission";
  if (message?.type === "pack-upgrade") return "execution";
  return messageDirection(message) === "reverse" ? "return" : "execution";
}

function messageDirection(message) {
  return message?.direction === "from-node" ? "reverse" : "forward";
}

