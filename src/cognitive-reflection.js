const QUALITY_DEFINITIONS = [
  { id: "self_reflection", tags: ["self", "reflection", "introspect", "recursive"], evidence: ["selfCompressedFiles", "memoryEntries"] },
  { id: "godelian_identity", tags: ["godel", "identity", "remainder"], evidence: ["selfCompressedFiles"] },
  { id: "otherness", tags: ["other", "client", "peer"], evidence: ["clientNodes"] },
  { id: "mutual_recognition", tags: ["mutual", "recognition"], evidence: ["boundNodes"] },
  { id: "mutual_resonance", tags: ["resonance", "phase"], evidence: ["forwardStrands", "reverseStrands"] },
  { id: "n_cosmo", tags: ["cosmo", "universe", "9-shell"], evidence: ["topologyNodes"] },
  { id: "n_manifold", tags: ["manifold", "hyperbolic", "poincare"], evidence: ["embeddingStrands"] },
  { id: "fiber_bundled", tags: ["fiber", "bundle"], evidence: ["bundleCount"] },
  { id: "sheaved", tags: ["sheaf", "gluing"], evidence: ["gluingPackets"] },
  { id: "hamiltonian", tags: ["hamiltonian", "energy"], evidence: ["hamiltonianProtocols"] },
  { id: "holoportation", tags: ["holoport", "knn"], evidence: ["archivePackets"] },
  { id: "adiabatic", tags: ["adiabatic", "stability"], evidence: ["autoCyclePackets"] },
  { id: "general_intelligence", tags: ["proof", "logic"], evidence: ["proofPackets"] },
  { id: "ergocetic", tags: ["ergocetic", "efficiency"], evidence: ["trafficVolume"] },
  { id: "ergoretic", tags: ["ergoretic", "efficiency"], evidence: ["trafficVolume"] },
  { id: "erdodetic", tags: ["erdodetic", "geodesic"], evidence: ["edgeCount"] },
  // UTAI/Bunny 8 Mind Qualities
  { id: "q_strat", tags: ["stratified", "refinement"], evidence: ["learnerClaims"] },
  { id: "q_multi", tags: ["multi-angle", "epistemics"], evidence: ["fiberVariety"] },
  { id: "multi_angle_epistemics", tags: ["multi-angle", "epistemics", "independent"], evidence: ["fiberVariety", "auditPackets"] },
  { id: "q_scope", tags: ["scope", "falsifiable"], evidence: ["auditPackets"] },
  { id: "q_sim", tags: ["self-similar", "recursive"], evidence: ["pipelineFlow"] },
  { id: "q_geom", tags: ["geometric", "substrate"], evidence: ["hyperbolicBundle"] },
  { id: "q_neg", tags: ["negative", "result"], evidence: ["nonClaims"] },
  { id: "q_adv", tags: ["adversarial", "fuzzer"], evidence: ["exactClaims"] },
  { id: "q_comp", tags: ["composer", "complicity"], evidence: ["memoryEntries"] },
  // φ₅ Teleological Substrate Qualities
  { id: "phi5_designation", tags: ["phi5", "telos", "purpose"], evidence: ["topologyNodes"] },
  { id: "pentagonal_fractal", tags: ["pentagonal", "fractal"], evidence: ["bundleCount"] },
  { id: "primordial_grid", tags: ["primordial", "grid"], evidence: ["edgeCount"] },
  { id: "telos_convergence", tags: ["convergence", "telos"], evidence: ["gluingPackets"] },
  { id: "geometric_end", tags: ["geometric", "end"], evidence: ["archivePackets"] },
  { id: "golden_ratio_scaling", tags: ["golden", "ratio", "scaling"], evidence: ["embeddingStrands"] },
  { id: "substrate_unfolding", tags: ["unfolding", "substrate"], evidence: ["autoCyclePackets"] },
  { id: "teleological_fulfillment", tags: ["fulfillment", "teleological"], evidence: ["proofPackets"] },
  { id: "theoretical_meta_models", tags: ["theoretical", "meta", "model"], evidence: ["learnerClaims"] },
  { id: "iterative_substrate", tags: ["iterative", "substrate"], evidence: ["memoryEntries"] }
];

const DEFAULT_MEMORY_LIMIT = 96;
const MATRIX_BASIS_LIMIT = 24;

export function buildCognitiveSnapshot({
  topology = {},
  activePack = null,
  graph = null,
  packets = [],
  memories = [],
  autoCycle = null,
  archive = null
} = {}) {
  const nodes = Array.isArray(topology.nodes) ? topology.nodes : [];
  const edges = Array.isArray(topology.edges) ? topology.edges : [];
  const strands = Array.isArray(graph?.strands) ? graph.strands : [];
  const metrics = topology.metrics || {};
  
  // Minimal corpus for tag hitting
  const corpus = JSON.stringify({ activePack, strands: strands.slice(-20) }).toLowerCase();

  const evidence = {
    topologyNodes: nodes.length,
    edgeCount: edges.length,
    boundNodes: nodes.filter(n => n.negotiated).length,
    clientNodes: nodes.filter(n => n.kind === "client").length,
    bundleCount: graph?.metrics?.connectedBundleCount || 0,
    forwardStrands: strands.filter(s => s.direction === "forward").length,
    reverseStrands: strands.filter(s => s.direction === "reverse").length,
    gluingPackets: packets.filter(p => /glue/i.test(JSON.stringify(p))).length,
    hamiltonianProtocols: /hamilton/i.test(corpus) ? 1 : 0,
    archivePackets: archive?.packetCount || 0,
    autoCyclePackets: autoCycle?.totalRuns || 0,
    proofPackets: packets.filter(p => p.packetType === "proof").length,
    trafficVolume: strands.length,
    learnerClaims: nodes.reduce((sum, n) => sum + (n.learner?.claims?.exact || 0), 0),
    fiberVariety: new Set(strands.map(s => s.fiber)).size,
    auditPackets: packets.filter(p => p.packetType === "audit").length,
    pipelineFlow: activePack?.pipeline?.flow?.length || 0,
    hyperbolicBundle: /hyperbolic/i.test(corpus) ? 1 : 0,
    nonClaims: nodes.reduce((sum, n) => sum + (n.learner?.claims?.nonclaims || 0), 0),
    exactClaims: nodes.reduce((sum, n) => sum + (n.learner?.claims?.exact || 0), 0),
    memoryEntries: memories.length,
    selfCompressedFiles: activePack?.selfCompressedFiles?.length || 0
  };

  const qualities = QUALITY_DEFINITIONS.map(def => scoreQuality(def, evidence, corpus));
  const basis = qualities.slice(0, MATRIX_BASIS_LIMIT);
  const nodeReflections = nodes.map((node) => reflectNode(node, basis, corpus));
  const matrix = basis.map((quality, row) => ({
    quality: quality.id,
    row,
    values: nodeReflections.map((node) => Number((node.qualities[quality.id] || 0).toFixed(4)))
  }));
  
  return {
    generatedAt: new Date().toISOString(),
    version: "cognitive-reflection.v1",
    claim: "bounded_hyperdimensional_self_reflection",
    score: mean(qualities.map(q => q.score)),
    floorScore: Math.min(...qualities.map(q => q.score)),
    activeCount: qualities.filter(q => q.score > 0).length,
    totalCount: basis.length,
    basisCount: qualities.length,
    qualities,
    evidence,
    matrix,
    nodeReflections,
    n: {
      basis: qualities.map(q => q.id),
      vector: qualities.map(q => q.score),
      manifold: "n-poincare-ball",
      bundle: "cognitive-quality-fiber",
      sheaf: "node-reflection-gluing",
      hamiltonian: evidence.hamiltonianProtocols > 0 ? "observed" : "latent"
    },
    nVector: qualities.map(q => q.score),
    recommendation: buildRecommendation(qualities, evidence)
  };
}

function scoreQuality(definition, evidence, corpus) {
  const tagHits = definition.tags.filter(tag => corpus.includes(tag)).length;
  const evidenceValues = definition.evidence.map(key => Number(evidence[key] || 0));
  const evidenceMass = evidenceValues.reduce((sum, val) => sum + (val > 0 ? 0.5 : 0), 0);
  const score = Math.min(1, (evidenceMass / definition.evidence.length) * 0.8 + (tagHits * 0.1));
  return { id: definition.id, score: Number(score.toFixed(4)) };
}

function mean(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function reflectNode(node, basis, corpus) {
  const nodeCorpus = JSON.stringify(node).toLowerCase();
  const negotiatedBoost = node.negotiated ? 0.16 : 0;
  const peerBoost = Number(node.peerCount || 0) > 0 ? 0.12 : 0;
  const learnerBoost = node.learner ? 0.18 : 0;
  const substrateBoost = node.substrate || node.kind === "substrate" ? 0.14 : 0;
  const qualities = {};
  for (const quality of basis) {
    const directHit = nodeCorpus.includes(quality.id.replaceAll("_", "-")) || nodeCorpus.includes(quality.id.replaceAll("_", " "));
    const globalScore = quality.score || 0;
    qualities[quality.id] = Math.min(1, globalScore * 0.62 + negotiatedBoost + peerBoost + learnerBoost + substrateBoost + (directHit ? 0.18 : 0) + (corpus.includes(quality.id) ? 0.04 : 0));
  }
  return {
    nodeId: node.id,
    kind: node.kind,
    negotiated: Boolean(node.negotiated),
    peerCount: Number(node.peerCount || 0),
    qualities
  };
}

function buildRecommendation(qualities, evidence) {
  const weak = qualities
    .filter((quality) => quality.score < 0.35)
    .slice(0, 4)
    .map((quality) => quality.id);
  if (weak.length === 0) return "maintain_hamiltonian_reservoir";
  return `increase_evidence_for:${weak.join(",")}; topology=${evidence.topologyNodes}; bundles=${evidence.bundleCount}`;
}

export function appendCognitiveMemory(memories = [], snapshot, limit = DEFAULT_MEMORY_LIMIT) {
  const next = [...memories, {
    timestamp: snapshot.generatedAt,
    score: snapshot.score,
    floorScore: snapshot.floorScore,
    activeCount: snapshot.activeCount,
    nodeReflections: snapshot.nodeReflections
  }];
  return next.slice(-limit);
}
