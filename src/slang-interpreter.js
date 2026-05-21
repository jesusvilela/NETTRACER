import fs from "node:fs";
import { summarize } from "./packet.js";
import { extractSectionTags } from "./section-lang.js";
import { TelosValidator } from "./telos-validator.js";

const CANONICAL_BLOCKS = [
  "SOURCE",
  "AXIOMS",
  "OUTPUT",
  "SORTS",
  "FUNCTORS",
  "SEMANTICS",
  "REDUCTION_BETA",
  "TURING_ENCODING",
  "SPECTRAL_PIPELINE",
  "FISHER_UPDATE",
  "INTER_MANIFOLD",
  "GRAMMAR",
  "NOTATION_MAP",
  "SEMANTICS_TOPOS",
  "AML_DEFINITION",
  "CONCLUSIONS"
];

const DEFAULT_THRESHOLDS = {
  minCoherence: 0.46,
  maxDistortion: 0.82
};

const THESIS_PATH = "H:/SLANG_TESTING/thesis/thesis.md";

export class SlangInterpreter {
  constructor({ traceStore, controlPlane, slangControlPlane = null, telosBaseUrl = "http://localhost:8001" }) {  
    this.traceStore = traceStore;
    this.controlPlane = controlPlane;
    this.slangControlPlane = slangControlPlane;
    this.thresholds = { ...DEFAULT_THRESHOLDS };
    this.frames = [];
    this.frameIndex = new Map();
    this.nodeFrames = new Map();
    this.relayEvents = [];
    this.lang = this.resolveLang();
    
    this.validator = new TelosValidator(telosBaseUrl);
    this.onFrameUpdate = null;

    for (const packet of traceStore.getPackets().slice(-120)) {
      this.ingestPacket(packet);
    }
  }

  close() {
  }

  getCatalog() {
    this.lang = this.resolveLang();
    const topology = this.controlPlane.getTopology();
    return {
      generatedAt: new Date().toISOString(),
      lang: {
        title: this.lang.title,
        version: this.lang.version,
        source: this.lang.source,
        canonicalBlocks: this.lang.blocks
      },
      thresholds: { ...this.thresholds },
      nodes: topology.nodes.map((node) => ({
        id: String(node.id),
        kind: String(node.kind || "node"),
        label: String(node.label || node.id),
        frameCount: this.getFramesForNode(node.id, 24).length
      })),
      relayCount: this.relayEvents.length
    };
  }

  getFramesForNode(nodeId, limit = 40) {
    const items = this.nodeFrames.get(String(nodeId)) || [];
    return items.slice(-Math.max(1, Number(limit) || 40));
  }

  getFrame(frameId) {
    return this.frameIndex.get(String(frameId)) || null;
  }

  previewRelay(nodeId, frameId) {
    const frame = this.getFrame(frameId);
    const target = String(nodeId || "");
    if (!frame) {
      return { ok: false, error: "slang_frame_not_found" };
    }
    const topology = this.controlPlane.getTopology();
    const targetNode = topology.nodes.find((node) => String(node.id) === target);
    if (!targetNode) {
      return { ok: false, error: "slang_target_not_found" };
    }
    const transportPath = ["reservoir", "netracer", target];
    const eligible = frame.coherence >= this.thresholds.minCoherence     
      && frame.distortion <= this.thresholds.maxDistortion;
    return {
      ok: true,
      eligible,
      relayReason: eligible ? "coherent_transport" : this.buildRelayReason(frame, this.thresholds),
      nodeId: target,
      frameId: frame.id,
      transportPath,
      canonical: frame.canonical,
      compacted: frame.compacted,
      update: this.buildLanguageUpdate(frame, targetNode)
    };
  }

  relayFrame(nodeId, frameId, mode = "compacted") {
    const preview = this.previewRelay(nodeId, frameId);
    if (!preview.ok) {
      return preview;
    }
    if (!preview.eligible) {
      return { ...preview, ok: false, error: "slang_relay_blocked" };    
    }
    const frame = this.getFrame(frameId);
    const payload = {
      id: `relay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      nodeId: String(nodeId),
      frameId: frame.id,
      mode: mode === "canonical" ? "canonical" : "compacted",
      body: mode === "canonical" ? frame.canonical : frame.compacted,    
      update: preview.update,
      transportPath: preview.transportPath,
      coherence: frame.coherence,
      distortion: frame.distortion
    };
    this.relayEvents.push(payload);
    while (this.relayEvents.length > 200) this.relayEvents.shift();      
    return { ok: true, relay: payload };
  }

  ingestPacket(packet) {
    this.lang = this.resolveLang();
    const frame = this.buildFrame(packet, this.controlPlane.getTopology(), this.lang);
    
    // Packet Interception for TELOS validation
    if (packet.payload?.n_v || packet.payload?.n || packet.payload?.h) {
      this.validator.validatePacket(packet.payload).then(result => {
        frame.telos = result;
        if (this.onFrameUpdate) {
          this.onFrameUpdate(frame);
        }
      }).catch(err => {
        console.error("[SlangInterpreter] TELOS validation failed:", err);
      });
    }

    this.frames.push(frame);
    while (this.frames.length > 1500) {
      const removed = this.frames.shift();
      if (removed) {
        this.frameIndex.delete(removed.id);
      }
    }
    this.frameIndex.set(frame.id, frame);
    const bucket = this.nodeFrames.get(frame.nodeId) || [];
    bucket.push(frame);
    while (bucket.length > 300) bucket.shift();
    this.nodeFrames.set(frame.nodeId, bucket);
    return frame;
  }

  resolveLang() {
    return this.slangControlPlane?.getInterpreterLang?.() || loadCanonicalLang();
  }

  buildFrame(packet, topology, lang) {
    const nodeId = String(packet?.payload?.route || "netracer");
    const node = topology.nodes.find((item) => String(item.id) === nodeId);
    const section = classifyPacketSection(packet);
    const fiber = classifyPacketFiber(packet, nodeId);
    const bundle = classifyPacketBundle(packet, node);
    const symbols = extractSymbols(packet, lang);
    const coherence = computeCoherence(packet, symbols);
    const distortion = computeDistortion(packet, coherence);
    const canonical = this.buildCanonicalFrame(packet, { section, fiber, bundle, symbols, lang });
    const compacted = this.compactFrame(packet, canonical, { section, fiber, bundle, symbols });
    const metaphor = this.buildMetaphor(packet, section, fiber);
    const hyperbole = this.buildHyperbole(packet, coherence, distortion);       
    const transportPath = ["reservoir", "netracer", nodeId];

    return {
      id: `slang_${packet.id}`,
      timestamp: packet.timestamp || new Date().toISOString(),
      nodeId,
      nodeKind: String(node?.kind || "runtime"),
      route: nodeId,
      section,
      fiber,
      bundle,
      symbols,
      canonical,
      compacted,
      metaphor,
      hyperbole,
      coherence,
      distortion,
      transportPath,
      relayEligible: coherence >= DEFAULT_THRESHOLDS.minCoherence && distortion <= DEFAULT_THRESHOLDS.maxDistortion,
      relayReason: this.buildRelayReason({ coherence, distortion }, DEFAULT_THRESHOLDS),
      packet: {
        id: packet.id,
        packetType: packet.packetType,
        envelope: packet.envelope,
        digest: packet.digest
      }
    };
  }

  buildCanonicalFrame(packet, context) {
    return [
      `Â§FRAME{route=${context.bundle}|node=${packet?.payload?.route || "netracer"}}`,
      `Â§SECTION{${context.section}}`,
      `Â§FIBER{${context.fiber}}`,
      `Â§BUNDLE{${context.bundle}}`,
      `Â§SYMBOLS{${context.symbols.join("|") || "nil"}}`,
      summarize(packet?.payload?.intent || packet?.payload?.analysis?.summary || packet?.envelope || "nil", 180)
    ].join(" ");
  }

  compactFrame(packet, canonical, context) {
    const intent = summarize(packet?.payload?.intent || packet?.payload?.analysis?.summary || packet?.envelope || "", 120);
    const symbolCore = context.symbols.slice(0, 3).join("|") || "nil";     
    return `Â§COMPACT{${context.section}>${context.fiber}>${context.bundle}} :: ${symbolCore} :: ${intent || canonical}`;
  }

  buildMetaphor(packet, section, fiber) {
    const kind = String(packet?.packetType || "packet");
    return `Â§META{${section}:${fiber}:${kind}}`;
  }

  buildHyperbole(packet, coherence, distortion) {
    const route = String(packet?.payload?.route || "netracer");
    const intensity = coherence > 0.7 && distortion < 0.4 ? "crystalline" : distortion > 0.7 ? "gyration-loud" : "sheaf-bright";
    return `Â§HYP{${route}:${intensity}}`;
  }

  buildRelayReason(frame, thresholds) {
    if (frame.coherence < thresholds.minCoherence) return "low_coherence"; 
    if (frame.distortion > thresholds.maxDistortion) return "distortion_gate";
    return "coherent_transport";
  }

  buildLanguageUpdate(frame, targetNode) {
    return {
      nodeId: String(targetNode?.id || frame.nodeId),
      nodeKind: String(targetNode?.kind || frame.nodeKind),
      languageDelta: `Â§UPDATE{section=${frame.section},fiber=${frame.fiber},bundle=${frame.bundle},coherence=${frame.coherence.toFixed(2)},distortion=${frame.distortion.toFixed(2)}}`,
      compacted: frame.compacted
    };
  }
}

function loadCanonicalLang() {
  const fallback = {
    title: "Â§|LANG| v1.2.0",
    version: "v1.2.0",
    source: "specification-first fallback",
    blocks: CANONICAL_BLOCKS,
    excerpts: [
      "A7 hyperbolic beta-reduction transports the reduct along the information-geometric geodesic.",
      "A5 drift requires external witness when gyration residue persists.",
      "Topos coherence comes from local gluing across semantic patches." 
    ]
  };
  try {
    const raw = fs.readFileSync(THESIS_PATH, "utf8");
    const lines = raw.split(/\r?\n/);
    const title = lines.find((line) => line.startsWith("# "))?.replace(/^#\s+/, "") || fallback.title;
    const excerpts = lines.filter((line) => line.trim() && !line.startsWith("#")).slice(0, 12).map((line) => summarize(line, 180));
    return {
      title,
      version: "v1.2.0",
      source: THESIS_PATH,
      blocks: CANONICAL_BLOCKS,
      excerpts
    };
  } catch {
    return fallback;
  }
}

function extractSymbols(packet, lang) {
  const symbols = new Set();
  for (const tag of extractSectionTags(packet?.envelope || "")) symbols.add(`Â§${tag}`);
  for (const label of packet?.payload?.labels || []) symbols.add(String(label));
  for (const tag of packet?.payload?.analysis?.tags || []) symbols.add(String(tag));
  const stage = packet?.payload?.stage?.name || packet?.payload?.stage;  
  if (stage) symbols.add(`Â§STAGE:${stage}`);
  const sample = lang.excerpts.find((item) => /A7|A5|Topos|gluing/i.test(item));
  if (sample) symbols.add(summarize(sample, 72));
  return [...symbols].slice(0, 8);
}

export function classifyPacketSection(packet) {
  const stage = String(packet?.payload?.stage?.name || packet?.payload?.stage || "").toUpperCase();
  if (stage === "ING") return "reservoir";
  if (stage === "CHK") return "admission";
  if (String(packet?.packetType || "") === "proof") return "proof";      
  if (stage === "RLB" || stage === "BLK") return "return";
  return "execution";
}

export function classifyPacketFiber(packet, nodeId) {
  const hint = String(packet?.payload?.analysis?.routeHint || "").toLowerCase();
  if (hint) return hint;
  const route = String(packet?.payload?.route || nodeId || "").toLowerCase();
  if (route.includes("embed")) return "embedding";
  if (route.includes("reflect")) return "reflective";
  if (route.includes("strict")) return "strict";
  return "semantic";
}

export function classifyPacketBundle(packet, node) {
  if (String(packet?.packetType || "") === "proof") return "return";     
  if (node?.kind === "broker") return "broker";
  if (node?.kind === "model") return "model";
  return "runtime";
}

export function derivePacketDirection(packet) {
  const stage = String(packet?.payload?.stage?.name || packet?.payload?.stage || "").toUpperCase();
  if (String(packet?.packetType || "") === "proof") return "reverse";    
  if (String(packet?.packetType || "") === "audit") return "reverse";    
  if (String(packet?.packetType || "") === "alert") return "reverse";    
  if (stage === "RLB" || stage === "BLK") return "reverse";
  return "forward";
}

function computeCoherence(packet, symbols) {
  const sigmaSpread = Object.keys(packet?.payload?.sigma || {}).filter((key) => packet.payload.sigma[key]).length;
  const labels = (packet?.payload?.labels || []).length;
  const parentFactor = (packet?.parents || []).length;
  return clamp(0.34 + sigmaSpread * 0.12 + labels * 0.06 + Math.min(0.18, parentFactor * 0.05) + Math.min(0.12, symbols.length * 0.015), 0, 1);   
}

function computeDistortion(packet, coherence) {
  const kappa = Number(packet?.payload?.kappa?.loadPct || packet?.payload?.kappa?.usagePct || packet?.payload?.kappa?.tokenPressure || 0);        
  const proofPenalty = String(packet?.packetType || "") === "proof" ? 0.06 : 0;
  return clamp(0.92 - coherence + kappa * 0.48 + proofPenalty, 0, 1.2);  
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
