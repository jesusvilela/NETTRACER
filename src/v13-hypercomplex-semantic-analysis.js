const STRATA = [
  { id: "R", label: "recognition boundary", role: "signal salience and packet presence" },
  { id: "C", label: "complex phase", role: "route and model phase coherence" },
  { id: "H", label: "quaternion context", role: "actor, client, and stage orientation" },
  { id: "O", label: "octonion gluing", role: "labels, motifs, and non-associative semantic joins" },
  { id: "A_n", label: "n-hypercomplex substrate", role: "archive-wide semantic compression and active remainder" }
];

export function buildV13HypercomplexSemanticAnalysis({
  archiveStatus = null,
  archiveInsights = null,
  recentPackets = [],
  archiveSource = null,
  topology = null,
  traffic = []
} = {}) {
  const insights = archiveInsights || emptyInsights();
  const quantitative = insights.quantitative || {};
  const qualitative = insights.qualitative || {};
  const packetCount = Number(quantitative.packetCount || archiveStatus?.packetCount || 0);
  const nodeCount = Array.isArray(topology?.nodes) ? topology.nodes.length : 0;
  const edgeCount = Array.isArray(topology?.edges) ? topology.edges.length : 0;
  const trafficCount = Array.isArray(traffic) ? traffic.length : 0;
  const strata = buildStrata({ quantitative, qualitative, packetCount, nodeCount, edgeCount, trafficCount });
  const motifs = buildMotifs(qualitative);
  const semanticGraph = buildSemanticGraph({ strata, motifs, qualitative, topology, recentPackets });
  const substrate = buildSubstrateReadout({ archiveStatus, insights, recentPackets, archiveSource, topology, traffic });
  const dominant = strata.slice().sort((a, b) => b.energy - a.energy)[0] || strata[0];
  const activeRemainder = round(clamp(
    1 - (qualitative.signedRatio || 0) * 0.24 - (qualitative.proofRatio || 0) * 0.18 + (motifs.length / 80),
    0,
    1
  ));

  return {
    product: "netracer-v13-hypercomplex-semantic-analysis",
    mode: "read_only_hypercomplex_semantic_lens_for_s1_and_substrate",
    inherits: "netracer-v12-aaa-world-generator",
    writes: [],
    non_destructive: true,
    source_surface: "http://192.168.3.88:8787/s1",
    analysis_axiom: "present the normal human with readable richness from .s1 packets, substrate routes, node topology, semantic motifs, and hypercomplex strata",
    substrate,
    hypercomplex_semantics: {
      dominant_carrier: dominant.id,
      dominant_label: dominant.label,
      total_semantic_energy: round(strata.reduce((sum, stratum) => sum + stratum.energy, 0)),
      active_remainder: activeRemainder,
      gluing_quality: round(clamp(1 - activeRemainder * 0.62, 0, 1)),
      strata
    },
    motifs,
    semantic_graph: semanticGraph,
    human_readout: buildHumanReadout({ dominant, substrate, motifs, activeRemainder }),
    launch: {
      infra: "V13",
      endpoint: "/api/v13/hypercomplex-semantic-analysis",
      view: "/v13/hypercomplex-semantic-analysis",
      compatible_port: 8790
    }
  };
}

function buildStrata({ quantitative, qualitative, packetCount, nodeCount, edgeCount, trafficCount }) {
  const typeCount = Number(quantitative.packetTypes || 0);
  const routeCount = Number(quantitative.routes || 0);
  const modelCount = Number(quantitative.models || 0);
  const stageCount = Array.isArray(qualitative.stages) ? qualitative.stages.length : 0;
  const labelCount = Array.isArray(qualitative.labels) ? qualitative.labels.length : 0;
  const motifCount = Array.isArray(qualitative.motifs) ? qualitative.motifs.length : 0;
  const decoded = Number(qualitative.decodedWindow || 0);
  const signed = Number(qualitative.signedRatio || 0);
  const proof = Number(qualitative.proofRatio || 0);
  const intent = Number(qualitative.intentRatio || 0);
  const raw = [
    packetCount * 0.7 + typeCount * 3 + trafficCount * 0.5,
    routeCount * 7 + modelCount * 4 + signed * 12,
    stageCount * 8 + decoded * 0.6 + intent * 16,
    labelCount * 6 + motifCount * 7 + proof * 18,
    packetCount * 0.22 + nodeCount * 3 + edgeCount * 4 + decoded * 0.8
  ];
  const max = Math.max(1, ...raw);
  return STRATA.map((stratum, index) => ({
    ...stratum,
    energy: round(raw[index]),
    normalized: round(raw[index] / max),
    evidence: evidenceForStratum(index, { packetCount, typeCount, routeCount, modelCount, stageCount, labelCount, motifCount, nodeCount, edgeCount, trafficCount, decoded, signed, proof, intent })
  }));
}

function evidenceForStratum(index, facts) {
  const rows = [
    [`packets=${facts.packetCount}`, `types=${facts.typeCount}`, `traffic=${facts.trafficCount}`],
    [`routes=${facts.routeCount}`, `models=${facts.modelCount}`, `signed=${round(facts.signed)}`],
    [`stages=${facts.stageCount}`, `decoded=${facts.decoded}`, `intent=${round(facts.intent)}`],
    [`labels=${facts.labelCount}`, `motifs=${facts.motifCount}`, `proof=${round(facts.proof)}`],
    [`nodes=${facts.nodeCount}`, `edges=${facts.edgeCount}`, `decoded=${facts.decoded}`]
  ];
  return rows[index] || [];
}

function buildMotifs(qualitative) {
  const motifs = Array.isArray(qualitative.motifs) ? qualitative.motifs : [];
  const labels = Array.isArray(qualitative.labels) ? qualitative.labels : [];
  const stages = Array.isArray(qualitative.stages) ? qualitative.stages : [];
  return motifs.slice(0, 12).map((motif, index) => {
    const label = labels[index % Math.max(1, labels.length)]?.label || "unlabeled";
    const stage = stages[index % Math.max(1, stages.length)]?.label || "unstaged";
    const carrier = STRATA[index % STRATA.length].id;
    return {
      id: `motif:${index}`,
      carrier,
      motif: motif.label,
      count: Number(motif.count || 0),
      label,
      stage,
      interpretation: `carrier ${carrier} binds motif "${motif.label}" through label "${label}" and stage "${stage}"`
    };
  });
}

function buildSemanticGraph({ strata, motifs, qualitative, topology, recentPackets }) {
  const nodes = [];
  const edges = [];
  for (const [index, stratum] of strata.entries()) {
    nodes.push({
      id: `stratum:${stratum.id}`,
      type: "stratum",
      label: stratum.label,
      carrier: stratum.id,
      energy: stratum.energy,
      position: polar(index, strata.length, 9 + index * 1.5, stratum.normalized * 7)
    });
  }
  motifs.forEach((motif, index) => {
    nodes.push({
      id: motif.id,
      type: "motif",
      label: motif.motif,
      carrier: motif.carrier,
      energy: motif.count,
      position: polar(index, Math.max(1, motifs.length), 18 + (index % 4) * 3, 2 + (index % 5))
    });
    edges.push({ from: `stratum:${motif.carrier}`, to: motif.id, relation: "carries", strength: round(Math.min(1, motif.count / 12)) });
  });
  const cards = Array.isArray(qualitative.cards) ? qualitative.cards : [];
  cards.slice(0, 16).forEach((card, index) => {
    const carrier = STRATA[index % STRATA.length].id;
    nodes.push({
      id: `packet:${card.id}`,
      type: "packet",
      label: card.summary || card.packetType || card.id,
      carrier,
      energy: 1 + (card.labels?.length || 0),
      position: polar(index, Math.max(1, cards.length), 28 + (index % 3) * 4, -4 + (index % 7))
    });
    edges.push({ from: `stratum:${carrier}`, to: `packet:${card.id}`, relation: "projects", strength: 0.52 });
  });
  const topologyNodes = Array.isArray(topology?.nodes) ? topology.nodes : [];
  topologyNodes.slice(0, 20).forEach((node, index) => {
    nodes.push({
      id: `node:${node.id || index}`,
      type: "substrate-node",
      label: node.id || `node-${index}`,
      carrier: "A_n",
      energy: 2,
      position: polar(index, Math.max(1, topologyNodes.length), 38, 6 * Math.sin(index))
    });
    edges.push({ from: "stratum:A_n", to: `node:${node.id || index}`, relation: "hosts", strength: 0.44 });
  });
  recentPackets.slice(0, 12).forEach((packet, index) => {
    if (!packet.id) return;
    const packetNode = `packet:${packet.id}`;
    if (nodes.some((node) => node.id === packetNode)) return;
    nodes.push({
      id: packetNode,
      type: "recent",
      label: `${packet.packetType || "packet"} ${packet.route || ""}`.trim(),
      carrier: STRATA[index % STRATA.length].id,
      energy: 1,
      position: polar(index, Math.max(1, recentPackets.length), 32, 0)
    });
  });
  return {
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      strataNodes: strata.length,
      motifNodes: motifs.length
    }
  };
}

function buildSubstrateReadout({ archiveStatus, insights, recentPackets, archiveSource, topology, traffic }) {
  const quantitative = insights.quantitative || {};
  const qualitative = insights.qualitative || {};
  return {
    archive_packets: Number(archiveStatus?.packetCount || quantitative.packetCount || 0),
    archive_db: archiveStatus?.dbPath || "",
    compression_ratio: Number(archiveStatus?.compressionRatio || quantitative.compressionRatio || 1),
    decoded_window: Number(qualitative.decodedWindow || 0),
    signed_ratio: Number(qualitative.signedRatio || 0),
    proof_ratio: Number(qualitative.proofRatio || 0),
    intent_ratio: Number(qualitative.intentRatio || 0),
    recent_packets: recentPackets.length,
    topology_nodes: Array.isArray(topology?.nodes) ? topology.nodes.length : 0,
    topology_edges: Array.isArray(topology?.edges) ? topology.edges.length : 0,
    traffic_events: Array.isArray(traffic) ? traffic.length : 0,
    source: archiveSource?.source || archiveStatus?.source || "runtime",
    fallback_path: archiveSource?.fallbackPath || "",
    read_only: true
  };
}

function buildHumanReadout({ dominant, substrate, motifs, activeRemainder }) {
  const topMotif = motifs[0]?.motif || "no active motif";
  return [
    `The active semantic carrier is ${dominant.id}: ${dominant.label}.`,
    `The substrate currently exposes ${substrate.archive_packets} archived .s1 packet(s), ${substrate.topology_nodes} node(s), and ${substrate.traffic_events} traffic event(s).`,
    `The strongest readable motif is "${topMotif}".`,
    `Active remainder is ${activeRemainder}: this is the part that remains semantically alive rather than fully flattened into the dashboard.`
  ];
}

function emptyInsights() {
  return {
    quantitative: { packetCount: 0, packetTypes: 0, routes: 0, models: 0, byType: [], byRoute: [], byModel: [], timeline: [] },
    qualitative: { decodedWindow: 0, signedRatio: 0, proofRatio: 0, intentRatio: 0, stages: [], labels: [], actors: [], clients: [], motifs: [], cards: [] }
  };
}

function polar(index, total, radius, y) {
  const angle = (index / Math.max(1, total)) * Math.PI * 2;
  return [round(Math.cos(angle) * radius), round(y), round(Math.sin(angle) * radius)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(Number(value || 0).toFixed(6));
}
