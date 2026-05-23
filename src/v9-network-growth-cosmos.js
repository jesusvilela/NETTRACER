import { buildV8NMeshWorldEngine } from "./v8-nmesh-world-engine.js";

export function buildV9NetworkGrowthCosmos({ traffic = [], topology = null, meshCount = 7 } = {}) {
  const v8 = buildV8NMeshWorldEngine({ traffic, topology, meshCount });
  const topologyNodes = Array.isArray(topology?.nodes) ? topology.nodes : [];
  const topologyEdges = Array.isArray(topology?.edges) ? topology.edges : [];
  const recentTraffic = Array.isArray(traffic) ? traffic.slice(-24) : [];
  const informationSeeds = buildInformationSeeds(v8, topologyNodes, recentTraffic);
  const population = populateMeshes(v8.meshes, informationSeeds);
  const growthLinks = buildGrowthLinks(v8.meshes, population, topologyEdges);
  return {
    product: "netracer-v9-network-growth-cosmos",
    mode: "aaa_network_information_populates_all_360_orto_worlds",
    inherits: v8.product,
    writes: [],
    growth_engine: {
      rule: "network information populates every world mesh through 360 yaw, 360 pitch, and orthogonal carrier lanes",
      mesh_count: v8.n_mesh_engine.mesh_count,
      information_seed_count: informationSeeds.length,
      population_count: population.length,
      growth_link_count: growthLinks.length,
      not_2d: true
    },
    axes: {
      yaw_360: "azimuthal distribution around each mesh",
      pitch_360: "vertical sweep through each local world",
      ortho_lanes: ["R", "C", "H", "O", "A_n", "meaning", "traffic"],
      growth_time: "each refresh adds observed network information without fabricating traffic"
    },
    information_seeds: informationSeeds,
    population,
    growth_links: growthLinks,
    meshes: v8.meshes,
    cross_mesh_bridges: v8.cross_mesh_bridges,
    spectator_semantics: {
      ...v8.spectator_semantics,
      understanding_rule: "the world grows when network information is reprojected into every mesh and glued through ortho carrier lanes",
      network_populates_all_worlds: true
    },
    source_state: {
      v8,
      lab_traffic: v8.source_state.lab_traffic,
      topology_nodes: topologyNodes.length,
      topology_edges: topologyEdges.length
    },
    launch: {
      infra: "V9",
      endpoint: "/api/v9/network-growth-cosmos",
      view: "/v9/network-growth-cosmos",
      compatible_port: 8790
    }
  };
}

function buildInformationSeeds(v8, topologyNodes, traffic) {
  const seeds = [];
  for (const node of topologyNodes.slice(0, 36)) {
    const id = String(node.id || node.label || `topology-${seeds.length}`);
    seeds.push({
      id: `topology:${id}`,
      kind: "topology-node",
      carrier: carrierForText(`${id} ${node.kind || ""}`),
      energy: round(0.7 + JSON.stringify(node).length / 600),
      label: id,
      source: "local_topology"
    });
  }
  for (const pulse of traffic.slice(-24)) {
    const id = String(pulse.packetId || pulse.id || `traffic-${seeds.length}`);
    seeds.push({
      id: `traffic:${id}`,
      kind: "traffic-pulse",
      carrier: carrierForText(`${pulse.direction || ""} ${pulse.route || ""} ${pulse.routeHint || ""}`),
      energy: round(1 + JSON.stringify(pulse).length / 900),
      label: String(pulse.direction || "traffic"),
      source: "local_traffic"
    });
  }
  for (const mesh of v8.meshes) {
    seeds.push({
      id: `mesh:${mesh.id}`,
      kind: "world-mesh",
      carrier: mesh.carrier_bias,
      energy: round(1.2 + mesh.phase),
      label: mesh.id,
      source: "world_engine"
    });
  }
  return seeds.length ? seeds : [{
    id: "quiet:structural-growth",
    kind: "quiet-structure",
    carrier: v8.spectator_semantics.current_dominant_carrier || "A_n",
    energy: 1,
    label: "quiet structural growth",
    source: "structural"
  }];
}

function populateMeshes(meshes, seeds) {
  const population = [];
  for (const mesh of meshes) {
    const meshIndex = mesh.phase * meshes.length;
    seeds.forEach((seed, index) => {
      const yaw = ((index / seeds.length) * Math.PI * 2 + mesh.phase * Math.PI * 2) % (Math.PI * 2);
      const pitch = -Math.PI + ((index * 0.61803398875 + mesh.phase) % 1) * Math.PI * 2;
      const lane = laneIndex(seed.carrier);
      const radius = 3.4 + lane * 0.85 + seed.energy * 0.32;
      population.push({
        id: `${mesh.id}:${seed.id}`,
        mesh_id: mesh.id,
        seed_id: seed.id,
        kind: seed.kind,
        carrier: seed.carrier,
        label: seed.label,
        energy: seed.energy,
        yaw_360: round((yaw * 180 / Math.PI + 360) % 360),
        pitch_360: round((pitch * 180 / Math.PI + 360) % 360),
        ortho_lane: lane,
        position: [
          round(mesh.offset[0] + Math.cos(yaw) * Math.cos(pitch * 0.5) * radius),
          round(mesh.offset[1] + Math.sin(pitch) * 2.4 + lane * 0.18),
          round(mesh.offset[2] + Math.sin(yaw) * Math.cos(pitch * 0.5) * radius)
        ]
      });
    });
  }
  return population;
}

function buildGrowthLinks(meshes, population, topologyEdges) {
  const links = [];
  const byMesh = new Map();
  for (const item of population) {
    if (!byMesh.has(item.mesh_id)) byMesh.set(item.mesh_id, []);
    byMesh.get(item.mesh_id).push(item);
  }
  for (const mesh of meshes) {
    const items = byMesh.get(mesh.id) || [];
    const seed = mesh.nodes.find((node) => node.source_id === "seed-spinner-hand") || mesh.nodes[0];
    for (const item of items.slice(0, 48)) {
      links.push({
        id: `grow:${mesh.id}:${item.seed_id}`,
        from: seed?.id || mesh.id,
        to: item.id,
        mesh_id: mesh.id,
        kind: "world-growth-link",
        carrier: item.carrier,
        strength: round(Math.min(1, 0.42 + item.energy / 4)),
        meaning: `network information ${item.label} grows inside ${mesh.id}`
      });
    }
  }
  for (const edge of topologyEdges.slice(0, 24)) {
    links.push({
      id: `topology-growth:${edge.from}->${edge.to}`,
      from: `topology:${edge.from}`,
      to: `topology:${edge.to}`,
      mesh_id: "all",
      kind: "topology-growth-relation",
      carrier: "traffic",
      strength: 0.68,
      meaning: "observed topology relation replicated across all world meshes"
    });
  }
  return links;
}

function carrierForText(text) {
  const value = String(text || "").toLowerCase();
  if (value.includes("traffic") || value.includes("substrate")) return "traffic";
  if (value.includes("cognition") || value.includes("v2")) return "C";
  if (value.includes("object") || value.includes("v3")) return "O";
  if (value.includes("mesh") || value.includes("world")) return "A_n";
  if (value.includes("human") || value.includes("spectator")) return "meaning";
  return "H";
}

function laneIndex(carrier) {
  return ["R", "C", "H", "O", "A_n", "meaning", "traffic"].indexOf(carrier) >= 0
    ? ["R", "C", "H", "O", "A_n", "meaning", "traffic"].indexOf(carrier)
    : 2;
}

function round(value) {
  return Number(value.toFixed(6));
}
