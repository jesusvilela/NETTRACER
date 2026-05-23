import { buildV7InformationalCosmosGraph } from "./v7-informational-cosmos-graph.js";

export function buildV8NMeshWorldEngine({ traffic = [], topology = null, meshCount = 5 } = {}) {
  const v7 = buildV7InformationalCosmosGraph({ traffic, topology });
  const n = Math.max(3, Math.min(9, Number(meshCount) || 5));
  const meshes = Array.from({ length: n }, (_, index) => buildMeshInstance(v7, index, n));
  const crossMeshBridges = buildCrossMeshBridges(meshes);
  return {
    product: "netracer-v8-nmesh-world-engine",
    mode: "aaa_n_mesh_hypercomplex_world_constructor",
    inherits: v7.product,
    writes: [],
    n_mesh_engine: {
      mesh_count: n,
      instance_rule: "each mesh is a phase-shifted hypercomplex world engine instance",
      not_2d: true,
      mesh_nodes: meshes.reduce((sum, mesh) => sum + mesh.nodes.length, 0),
      mesh_relationships: meshes.reduce((sum, mesh) => sum + mesh.relationships.length, 0),
      cross_mesh_bridges: crossMeshBridges.length
    },
    meshes,
    cross_mesh_bridges: crossMeshBridges,
    spectator_semantics: {
      ...v7.spectator_semantics,
      understanding_rule: "meaning becomes clearer when the same informational cosmos is seen across n phase-shifted meshes and their gluing bridges",
      n_mesh_consolidation: true
    },
    movement_fields: {
      mesh_orbit: "each world mesh precesses with its own phase",
      intra_mesh: "local relationships move inside each mesh",
      inter_mesh: "sheaf bridges bind homologous nodes across meshes",
      spectator: "human view reads the interference pattern across the n meshes"
    },
    source_state: {
      v7,
      lab_traffic: v7.source_state.lab_traffic
    },
    launch: {
      infra: "V8",
      endpoint: "/api/v8/nmesh-world-engine",
      view: "/v8/nmesh-world-engine",
      compatible_port: 8790
    }
  };
}

function buildMeshInstance(v7, index, total) {
  const angle = (index / total) * Math.PI * 2;
  const radius = 13 + total * 0.75;
  const offset = [round(Math.cos(angle) * radius), round((index - (total - 1) / 2) * 1.65), round(Math.sin(angle) * radius)];
  const scale = round(0.55 + index * 0.055);
  const phase = round(index / total);
  const nodes = v7.graph.nodes.map((node) => ({
    ...node,
    id: `mesh-${index}:${node.id}`,
    source_id: node.id,
    mesh_index: index,
    position: transformPosition(node.position, offset, scale, angle),
    energy: round((node.energy || 1) * (1 + index * 0.045))
  }));
  const relationships = v7.graph.relationships.map((edge) => ({
    ...edge,
    id: `mesh-${index}:${edge.id}`,
    from: `mesh-${index}:${edge.from}`,
    to: `mesh-${index}:${edge.to}`,
    mesh_index: index,
    strength: round(edge.strength * (1 + index * 0.025))
  }));
  return {
    id: `nmesh-${index}`,
    phase,
    carrier_bias: ["R", "C", "H", "O", "A_n"][index % 5],
    offset,
    scale,
    nodes,
    relationships,
    meaning: `phase ${index + 1}/${total} world-engine mesh`
  };
}

function buildCrossMeshBridges(meshes) {
  const bridges = [];
  for (let i = 0; i < meshes.length; i += 1) {
    const next = meshes[(i + 1) % meshes.length];
    for (const source of ["seed-spinner-hand", "spectator-human", "carrier-A_n"]) {
      bridges.push({
        id: `sheaf-${i}-${(i + 1) % meshes.length}:${source}`,
        from: `mesh-${i}:${source}`,
        to: `mesh-${(i + 1) % meshes.length}:${source}`,
        kind: "cross-mesh-sheaf-bridge",
        carrier: source === "carrier-A_n" ? "A_n" : "meaning",
        strength: round(0.74 + i * 0.025),
        motion: "n_mesh_gluing_precession",
        meaning: `glues homologous ${source} across ${meshes[i].id} and ${next.id}`
      });
    }
  }
  return bridges;
}

function transformPosition(position = [0, 0, 0], offset, scale, angle) {
  const x = position[0] * scale;
  const y = position[1] * scale;
  const z = position[2] * scale;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    round(x * c - z * s + offset[0]),
    round(y + offset[1]),
    round(x * s + z * c + offset[2])
  ];
}

function round(value) {
  return Number(value.toFixed(6));
}
