export const VERSION_LADDER = Object.freeze([
  { id: "V1", order: 1, carrier: "R", role: "ingress traffic capture and translation compatibility", view: "/", endpoint: "/api/atlas", port: 8787, complexity: 1 },
  { id: "V2", order: 2, carrier: "C", role: "cognition telemetry and repo cosmos atlas", view: "/cognition", endpoint: "/api/cognition/status", port: 8788, complexity: 2 },
  { id: "V3", order: 3, carrier: "H", role: "self-reflective object mesh and mutual recognition", view: "/v3/object-mesh", endpoint: "/api/v3/object-mesh", port: 8789, complexity: 3 },
  { id: "V4", order: 4, carrier: "O", role: "version cage and cross-version bridge consolidation", view: "/v4/version-cage", endpoint: "/api/v4/version-cage", port: 8790, complexity: 4 },
  { id: "V5", order: 5, carrier: "A_n", role: "AAA cosmos navigator with live lab traffic pulses", view: "/v5/aaa-cosmos", endpoint: "/api/v5/aaa-cosmos", port: 8790, complexity: 5 },
  { id: "V6", order: 6, carrier: "A_n", role: "first-person hypercomplex world projection", view: "/v6/hypercomplex-world", endpoint: "/api/v6/hypercomplex-world", port: 8790, complexity: 6 },
  { id: "V7", order: 7, carrier: "A_n", role: "informational cosmos graph with relationships in motion", view: "/v7/informational-cosmos-graph", endpoint: "/api/v7/informational-cosmos-graph", port: 8790, complexity: 7 },
  { id: "V8", order: 8, carrier: "A_n", role: "n-mesh world engine and cross-mesh sheaf bridges", view: "/v8/nmesh-world-engine", endpoint: "/api/v8/nmesh-world-engine", port: 8790, complexity: 8 },
  { id: "V9", order: 9, carrier: "A_n", role: "network information growth across 360/360 ortho worlds", view: "/v9/network-growth-cosmos", endpoint: "/api/v9/network-growth-cosmos", port: 8790, complexity: 9 },
  { id: "V10", order: 10, carrier: "H", role: "sign-stabilized output highways and behavioral fibers", view: "/v10/sign-stabilized-fibers", endpoint: "/api/v10/sign-stabilized-fibers", port: 8790, complexity: 10 },
  { id: "V11", order: 11, carrier: "O", role: "active cognition instrument with fiber/gauge perturbation", view: "/v11/active-cognition-instrument", endpoint: "/api/v11/active-cognition-instrument", port: 8790, complexity: 11 },
  { id: "V12", order: 12, carrier: "A_n", role: "first-person AAA world generator and walker", view: "/v12/aaa-world-generator", endpoint: "/api/v12/aaa-world-generator", port: 8790, complexity: 12 },
  { id: "V13", order: 13, carrier: "A_n", role: "hypercomplex semantic analysis over .s1 archive/substrate", view: "/v13/hypercomplex-semantic-analysis", endpoint: "/api/v13/hypercomplex-semantic-analysis", port: 8790, complexity: 13 }
]);

export function buildSubstrateFoundation({
  traffic = [],
  topology = null,
  archiveSource = null,
  selectedVersion = "V13"
} = {}) {
  const ladder = VERSION_LADDER.map((version, index) => {
    const lower = VERSION_LADDER[index - 1] || null;
    const higher = VERSION_LADDER[index + 1] || null;
    return {
      ...version,
      local_url: `http://127.0.0.1:${version.port}${version.view}`,
      lower: lower?.id || null,
      higher: higher?.id || null,
      movement: {
        left: lower?.id || null,
        right: higher?.id || null
      }
    };
  });
  const selected = ladder.find((version) => version.id === selectedVersion) || ladder.at(-1);
  const basis = buildTrafficBasis({ traffic, topology, archiveSource });
  const bridges = ladder.slice(1).map((version, index) => {
    const from = ladder[index];
    return {
      id: `${from.id}->${version.id}`,
      from: from.id,
      to: version.id,
      direction: "increasing_complexity",
      inverse: `${version.id}->${from.id}`,
      preserves: ["packet identity", "archive provenance", "traffic count", "topology reference", "active remainder"],
      bridge_quality: round(0.82 + Math.min(0.15, index * 0.012)),
      projection_cost: round(0.18 + Math.min(0.16, index * 0.01))
    };
  });

  return {
    product: "netracer-substrate-foundation",
    mode: "read_only_traffic_capture_basis_for_version_manifold",
    writes: [],
    telos: {
      statement: "NetTracer traffic capture is the operational basis for substrate-emergent knowledge.",
      engineering_read: "packets, traffic events, topology, and .s1 archive provenance must remain inspectable across every version projection",
      non_sentience_boundary: "cognition terms are engineering state variables"
    },
    capture_contract: {
      primary_streams: ["traceStore.traffic", "traceStore.packets", "controlPlane.topology", "s1_archive"],
      archive_policy: "append-oriented packet ingestion; fallback archives are read-only",
      destructive_actions: [],
      compatibility: "V1 remains ingress-compatible; higher versions only project richer views over the same capture basis",
      movement_rule: "left lowers projection complexity; right increases semantic/geometric richness"
    },
    selected_version: selected,
    version_ladder: ladder,
    bridges,
    traffic_basis: basis,
    invariants: {
      non_destructive: true,
      v1_to_latest_reachable: ladder[0].id === "V1" && ladder.at(-1).id === "V13",
      lower_and_higher_navigation_declared: ladder.every((version) => version.id === "V1" || version.movement.left) && ladder.every((version) => version.id === "V13" || version.movement.right),
      traffic_capture_is_primary_evidence: true,
      archive_source_is_disclosed: Boolean(basis.archive.source),
      no_flattening_of_prior_versions: true
    },
    launch: {
      endpoint: "/api/substrate/foundation",
      view: "/substrate/foundation",
      compatible_latest: selected.id
    }
  };
}

function buildTrafficBasis({ traffic, topology, archiveSource }) {
  const recentTraffic = Array.isArray(traffic) ? traffic.slice(-64) : [];
  const nodes = Array.isArray(topology?.nodes) ? topology.nodes : [];
  const edges = Array.isArray(topology?.edges) ? topology.edges : [];
  const archiveStatus = archiveSource?.archiveStatus || {};
  const byDirection = countBy(recentTraffic, (entry) => String(entry.direction || entry.type || "unknown"));
  const byScope = countBy(recentTraffic, (entry) => inferScope(entry));
  const latest = recentTraffic.at(-1) || null;
  return {
    source: "current_local_lab_netracer",
    traffic_events_window: recentTraffic.length,
    packet_window_supported: true,
    topology_nodes: nodes.length,
    topology_edges: edges.length,
    latest_event: latest ? {
      id: String(latest.packetId || latest.id || "traffic-event"),
      direction: String(latest.direction || latest.type || "unknown"),
      timestamp: latest.timestamp || latest.at || null,
      scope: inferScope(latest)
    } : null,
    directions: byDirection,
    scopes: byScope,
    archive: {
      source: archiveSource?.source || archiveStatus.source || "runtime",
      db_path: archiveStatus.dbPath || "",
      fallback_path: archiveSource?.fallbackPath || "",
      packet_count: Number(archiveStatus.packetCount || 0),
      compression_ratio: Number(archiveStatus.compressionRatio || 1),
      read_only: archiveSource?.source === "fallback-readonly"
    },
    dominance_trace: inferDominanceTrace({ recentTraffic, archiveStatus, nodes, edges })
  };
}

function inferDominanceTrace({ recentTraffic, archiveStatus, nodes, edges }) {
  const archivePackets = Number(archiveStatus?.packetCount || 0);
  const trafficEnergy = recentTraffic.length * 0.75;
  const topologyEnergy = nodes.length * 0.42 + edges.length * 0.18;
  const archiveEnergy = Math.log10(Math.max(1, archivePackets)) * 2.4;
  const carriers = [
    { carrier: "R", source: "ingress capture", energy: round(1 + trafficEnergy) },
    { carrier: "C", source: "translation phase", energy: round(1.2 + recentTraffic.length * 0.28) },
    { carrier: "H", source: "route orientation", energy: round(1.4 + topologyEnergy * 0.4) },
    { carrier: "O", source: "bridge relation", energy: round(1.6 + topologyEnergy * 0.55) },
    { carrier: "A_n", source: "archive/substrate manifold", energy: round(1.8 + archiveEnergy + topologyEnergy * 0.25) }
  ];
  const dominant = carriers.slice().sort((a, b) => b.energy - a.energy)[0];
  return {
    invariant: "total_cognitive_energy",
    signal: "dominance_trace_ascent",
    total_energy: round(carriers.reduce((sum, item) => sum + item.energy, 0)),
    dominant_carrier: dominant.carrier,
    carriers
  };
}

function countBy(values, selector) {
  const counts = new Map();
  for (const value of values) {
    const key = selector(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => (right[1] - left[1]) || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }));
}

function inferScope(entry) {
  const text = JSON.stringify(entry || {}).toLowerCase();
  if (text.includes("slang") || text.includes(".s1")) return "s1_codec";
  if (text.includes("cognition") || text.includes("v2")) return "cognition";
  if (text.includes("world") || text.includes("v12")) return "world";
  if (text.includes("archive") || text.includes("sqlite")) return "archive";
  if (text.includes("api")) return "api";
  return "lab";
}

function round(value) {
  return Number(value.toFixed(6));
}
