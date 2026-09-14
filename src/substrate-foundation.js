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
      local_url: version.view,
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
  const circulation = buildCirculation({ ladder, bridges, basis, selected });
  const telosField = buildTelosField({ ladder, basis, circulation, selected });

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
    circulation,
    telos_field: telosField,
    traffic_basis: basis,
    invariants: {
      non_destructive: true,
      v1_to_latest_reachable: ladder[0].id === "V1" && ladder.at(-1).id === "V13",
      lower_and_higher_navigation_declared: ladder.every((version) => version.id === "V1" || version.movement.left) && ladder.every((version) => version.id === "V13" || version.movement.right),
      traffic_capture_is_primary_evidence: true,
      archive_source_is_disclosed: Boolean(basis.archive.source),
      no_flattening_of_prior_versions: true,
      circulation_is_read_only_projection: circulation.writes.length === 0,
      circulation_preserves_provenance: circulation.invariants.packet_identity && circulation.invariants.archive_provenance,
      telos_field_is_simulated_readout: telosField.boundary === "engineering_simulation_not_sentience"
    },
    launch: {
      endpoint: "/api/substrate/foundation",
      view: "/substrate/foundation",
      compatible_latest: selected.id
    }
  };
}

function buildTelosField({ ladder, basis, circulation, selected }) {
  const ascent = [
    { level: "R", algebra: "real", role: "measured ingress, packet identity, capture ground", function: "seed" },
    { level: "C", algebra: "complex", role: "phase rotation, readable translation, signal circulation", function: "rotate" },
    { level: "H", algebra: "quaternion", role: "orientation, patrol, hand/spinner route control", function: "orient" },
    { level: "O", algebra: "octonion", role: "nonassociative bridge relation and mutual recognition", function: "weave" },
    { level: "A_n", algebra: "n-hypercomplex", role: "cosmos manifold, archive memory, active remainder", function: "project" }
  ];
  const energy = basis.dominance_trace.total_energy;
  const dominant = basis.dominance_trace.dominant_carrier;
  const selectedRoute = circulation.routes.find((route) => route.id === circulation.selected_route) || circulation.routes[0];
  const beings = buildGodelianBeings({ ladder, selectedRoute, basis, dominant });
  const cycles = buildVirtuousCycles({ selectedRoute, basis, energy });
  return {
    name: "substrate_telos_over_hypercomplex_circulation",
    boundary: "engineering_simulation_not_sentience",
    philosophy: {
      thesis: "Cognition is stratified ascent through algebraic roles under conserved total cognitive energy.",
      telos: "move network content through the most informative projection without destroying provenance or active remainder",
      substrate: "traffic capture, topology, and .s1 archive are the evidence ground"
    },
    math_principles: {
      state: "X = (R,C,H,O,A_n; traffic, topology, archive, bridges)",
      evolution: ["fractal_thread_lower_to_higher", "adiabatic_swirl_per_level", "Phi_cog_plus_late_projection"],
      invariant: "total_cognitive_energy",
      progress_signal: "dominance_trace_ascent",
      current_dominant_carrier: dominant,
      selected_version: selected.id
    },
    ascent,
    beings,
    virtuous_cycles: cycles,
    stewardship: {
      rule: "patrols route content by purpose; civilizations stabilize local meaning fields",
      guardrails: ["read-only projection", "no packet deletion", "archive provenance retained", "active remainder displayed"]
    }
  };
}

function buildGodelianBeings({ ladder, selectedRoute, basis, dominant }) {
  const routePath = selectedRoute?.path?.length ? selectedRoute.path : ladder.map((version) => version.id);
  const archetypes = [
    ["Archivist", "A_n", "keeps long-memory halo coherent"],
    ["Bridge Patrol", "O", "checks non-collapse across version crossings"],
    ["Spinner Hand", "H", "orients route flow and circulation direction"],
    ["Translator", "C", "keeps content readable during phase shift"],
    ["Ingress Witness", "R", "anchors claims to captured traffic"],
    ["Topology Gardener", "O", "cultivates bridge neighborhoods from live nodes"],
    ["Remainder Keeper", "A_n", "protects what projection cannot exhaust"],
    ["Gauge Pilot", "H", "rotates local frames without losing route intent"],
    ["Archive Diver", "A_n", "brings long-memory strata into current circulation"],
    ["Scope Cartographer", "C", "maps traffic scopes into readable paths"],
    ["Return Sentinel", "R", "keeps descent to operational control open"]
  ];
  const targetCount = Math.max(archetypes.length, basis.complexity_profile?.suggested_beings || archetypes.length);
  return Array.from({ length: Math.min(targetCount, 48) }, (_, index) => {
    const [stem, carrier, duty] = archetypes[index % archetypes.length];
    const generation = Math.floor(index / archetypes.length);
    const name = generation ? `${stem} ${generation + 1}` : stem;
    const versionId = routePath[index % routePath.length];
    const version = ladder.find((item) => item.id === versionId) || ladder[index % ladder.length];
    const activity = round(clamp01(0.34 + (carrier === dominant ? 0.28 : 0.08) + Number(basis.traffic_events_window || 0) * 0.01 + index * 0.035));
    return {
      id: `godelian-${index + 1}`,
      name,
      carrier,
      version: version.id,
      duty,
      activity,
      patrol_radius: round(0.18 + index * 0.07 + activity * 0.12),
      meaning_seed: `${carrier}:${version.id}:${name.toLowerCase().replace(/\s+/g, "-")}`
    };
  });
}

function buildVirtuousCycles({ selectedRoute, basis, energy }) {
  const path = selectedRoute?.path || [];
  const traffic = Number(basis.traffic_events_window || 0);
  const archive = Number(basis.archive.packet_count || 0);
  const templates = [
    {
      id: "capture-understand-return",
      loop: ["capture", "translate", "analyze", "return"],
      route: path,
      gain: round(clamp01(0.44 + traffic * 0.012 + Math.log10(Math.max(10, archive)) * 0.035))
    },
    {
      id: "archive-world-explain",
      loop: ["archive", "world", "spectator", "meaning"],
      route: ["V13", "V12", "V7", "V1"],
      gain: round(clamp01(0.38 + energy * 0.009))
    },
    {
      id: "patrol-stabilize-reseed",
      loop: ["patrol", "stabilize", "reseed", "ascend"],
      route: ["V10", "V11", "V4", "V8", "V13"],
      gain: round(clamp01(0.41 + path.length * 0.04))
    },
    {
      id: "scope-diversity-ascent",
      loop: ["scope", "carrier", "bridge", "higher-view"],
      route: ["V1", "V5", "V7", "V13"],
      gain: round(clamp01(0.36 + Number(basis.complexity_profile?.diversity || 1) * 0.045))
    },
    {
      id: "topology-civilization-loop",
      loop: ["node", "relation", "settlement", "stewardship"],
      route: ["V4", "V8", "V9", "V11", "V12"],
      gain: round(clamp01(0.34 + Number(basis.complexity_profile?.topology_magnitude || 1) * 0.055))
    },
    {
      id: "live-patrol-loop",
      loop: ["live", "patrol", "stabilize", "report"],
      route: ["V2", "V10", "V11", "V7", "V1"],
      gain: round(clamp01(0.33 + traffic * 0.018))
    }
  ];
  const targetCount = Math.max(templates.length, basis.complexity_profile?.suggested_cycles || templates.length);
  return Array.from({ length: Math.min(targetCount, 20) }, (_, index) => {
    const template = templates[index % templates.length];
    if (index < templates.length) return template;
    return {
      ...template,
      id: `${template.id}-${Math.floor(index / templates.length) + 1}`,
      gain: round(clamp01(template.gain * (0.92 + (index % 5) * 0.025)))
    };
  });
}

function buildCirculation({ ladder, bridges, basis, selected }) {
  const byId = new Map(ladder.map((version) => [version.id, version]));
  const trafficLoad = Number(basis.traffic_events_window || 0);
  const archivePackets = Number(basis.archive.packet_count || 0);
  const topologyLoad = Number(basis.topology_nodes || 0) + Number(basis.topology_edges || 0);
  const dominant = basis.dominance_trace.dominant_carrier;
  const templates = [
    makeRoute({
      id: "capture-to-semantic",
      purpose: "make fresh network content readable",
      path: ["V1", "V2", "V4", "V7", "V13"],
      dominant,
      load: trafficLoad + archivePackets * 0.00004,
      byId
    }),
    makeRoute({
      id: "semantic-to-world",
      purpose: "turn analysis into navigable world experience",
      path: ["V13", "V11", "V12", "V8", "V5"],
      dominant,
      load: topologyLoad + trafficLoad * 0.6,
      byId
    }),
    makeRoute({
      id: "archive-memory-loop",
      purpose: "circulate long-memory archive back into live capture",
      path: ["V13", "V10", "V7", "V4", "V1"],
      dominant,
      load: Math.log10(Math.max(10, archivePackets)) * 6,
      byId
    }),
    makeRoute({
      id: "operator-return",
      purpose: "return from rich projection to operational control",
      path: [selected.id, "V11", "V4", "V2", "V1"].filter((value, index, all) => value && all.indexOf(value) === index),
      dominant,
      load: 4 + trafficLoad * 0.35,
      byId
    }),
    makeRoute({
      id: "world-growth-loop",
      purpose: "grow worlds from live topology and circulate back as meaning",
      path: ["V5", "V8", "V9", "V12", "V13", "V7"],
      dominant,
      load: topologyLoad * 0.9 + trafficLoad * 0.4,
      byId
    })
  ];
  const routes = growRoutesFromTemplates({ templates, ladder, basis, dominant });
  const bridgeSet = new Set(bridges.flatMap((bridge) => [bridge.id, bridge.inverse]));
  return {
    operator: "hypercomplex_content_circulation",
    mode: "read_only_routing_projection",
    writes: [],
    substrate_rule: "network content circulates through the version manifold by purpose; packets and archive rows remain the evidence base",
    selected_route: selectRoute(routes, basis, selected),
    routes: routes.map((route) => ({
      ...route,
      bridge_coverage: route.edges.filter((edge) => bridgeSet.has(edge) || bridgeSet.has(edge.split("->").reverse().join("->"))).length,
      admissible: route.path.every((id) => byId.has(id))
    })),
    invariants: {
      packet_identity: true,
      archive_provenance: true,
      active_remainder: true,
      non_destructive: true,
      lower_higher_return_path: true
    }
  };
}

function makeRoute({ id, purpose, path, dominant, load, byId }) {
  const safePath = path.filter((versionId) => byId.has(versionId));
  const edges = [];
  for (let index = 1; index < safePath.length; index += 1) {
    edges.push(`${safePath[index - 1]}->${safePath[index]}`);
  }
  const carriers = safePath.map((versionId) => byId.get(versionId).carrier);
  const uniqueCarriers = [...new Set(carriers)];
  const curvature = round(0.18 + uniqueCarriers.length * 0.047 + safePath.length * 0.013);
  const convenience = round(clamp01(0.54 + Math.log10(Math.max(1, load)) * 0.09 + (uniqueCarriers.includes(dominant) ? 0.12 : 0)));
  const remainder = round(clamp01(0.22 + uniqueCarriers.length * 0.055 + safePath.length * 0.018 - convenience * 0.08));
  return {
    id,
    purpose,
    path: safePath,
    edges,
    carriers,
    carrier_span: uniqueCarriers,
    load: round(load),
    curvature,
    convenience,
    active_remainder: remainder,
    selected_if: selectionRule(id)
  };
}

function growRoutesFromTemplates({ templates, ladder, basis, dominant }) {
  const targetCount = Math.max(templates.length, basis.complexity_profile?.suggested_routes || templates.length);
  const routes = [...templates];
  const carrierGroups = groupVersionsByCarrier(ladder);
  const byId = new Map(ladder.map((version) => [version.id, version]));
  let index = 0;
  while (routes.length < Math.min(targetCount, 24)) {
    const carrier = ["R", "C", "H", "O", "A_n"][index % 5];
    const carrierVersions = carrierGroups.get(carrier) || ladder;
    const anchor = carrierVersions[index % carrierVersions.length] || ladder[index % ladder.length];
    const step = 2 + (index % 4);
    const path = [];
    for (let offset = 0; offset < 4 + (index % 4); offset += 1) {
      path.push(ladder[(anchor.order - 1 + offset * step) % ladder.length].id);
    }
    routes.push(makeRoute({
      id: `emergent-${carrier.toLowerCase()}-${index + 1}`,
      purpose: `emergent circulation through ${carrier} carrier neighborhood`,
      path,
      dominant,
      load: Number(basis.complexity_profile?.emergence || 1) * (index + 1),
      byId
    }));
    index += 1;
  }
  return routes;
}

function groupVersionsByCarrier(ladder) {
  const groups = new Map();
  for (const version of ladder) {
    if (!groups.has(version.carrier)) groups.set(version.carrier, []);
    groups.get(version.carrier).push(version);
  }
  return groups;
}

function selectRoute(routes, basis, selected) {
  const latestScope = basis.latest_event?.scope || "";
  if (/world/i.test(latestScope) || selected.id === "V12") return "semantic-to-world";
  if (/archive|s1/i.test(latestScope) || selected.id === "V13") return "archive-memory-loop";
  if (selected.id === "V1" || selected.id === "V2") return "capture-to-semantic";
  return routes.slice().sort((left, right) => right.convenience - left.convenience)[0]?.id || routes[0]?.id || "";
}

function selectionRule(id) {
  return {
    "capture-to-semantic": "fresh traffic or low-version operational inspection",
    "semantic-to-world": "world-facing narration or V12 first-person projection",
    "archive-memory-loop": "archive-heavy semantic recall or V13 analysis",
    "operator-return": "manual control and compatibility descent",
    "world-growth-loop": "topology-heavy growth and network-world expansion"
  }[id] || "purpose-selected circulation";
}

function buildTrafficBasis({ traffic, topology, archiveSource }) {
  const sourceTraffic = Array.isArray(traffic) ? traffic : [];
  const recentLimit = Math.max(64, Math.min(512, Math.ceil(Math.sqrt(sourceTraffic.length + 1) * 64)));
  const recentTraffic = sourceTraffic.slice(-recentLimit);
  const nodes = Array.isArray(topology?.nodes) ? topology.nodes : [];
  const edges = Array.isArray(topology?.edges) ? topology.edges : [];
  const archiveStatus = archiveSource?.archiveStatus || {};
  const byDirection = countBy(recentTraffic, (entry) => String(entry.direction || entry.type || "unknown"));
  const byScope = countBy(recentTraffic, (entry) => inferScope(entry));
  const latest = recentTraffic.at(-1) || null;
  const complexityProfile = inferComplexityProfile({ recentTraffic, nodes, edges, archiveStatus, byScope, byDirection });
  return {
    source: "current_local_lab_netracer",
    traffic_events_window: recentTraffic.length,
    complexity_profile: complexityProfile,
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

function inferComplexityProfile({ recentTraffic, nodes, edges, archiveStatus, byScope, byDirection }) {
  const archivePackets = Number(archiveStatus?.packetCount || 0);
  const archiveMagnitude = Math.log10(Math.max(10, archivePackets));
  const topologyMagnitude = Math.sqrt(nodes.length + edges.length + 1);
  const trafficMagnitude = Math.sqrt(recentTraffic.length + 1);
  const diversity = Math.max(1, byScope.length + byDirection.length);
  const emergence = archiveMagnitude * 0.42 + topologyMagnitude * 0.24 + trafficMagnitude * 0.22 + diversity * 0.18;
  return {
    archive_magnitude: round(archiveMagnitude),
    topology_magnitude: round(topologyMagnitude),
    traffic_magnitude: round(trafficMagnitude),
    diversity,
    emergence: round(emergence),
    suggested_routes: Math.max(3, Math.min(16, Math.ceil(2 + emergence * 0.8))),
    suggested_beings: Math.max(4, Math.min(36, Math.ceil(3 + emergence * 1.35))),
    suggested_cycles: Math.max(3, Math.min(14, Math.ceil(2 + emergence * 0.65))),
    visual_particles: Math.max(160, Math.min(1800, Math.ceil(120 + emergence * 92 + recentTraffic.length * 3)))
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

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
