const VERSION_NODES = Object.freeze([
  {
    id: "V1",
    role: "ingress_translation_compatibility",
    port: 8787,
    surfaces: ["/", "/v2", "/s1", "/dosbox", "/ju/absorb", "/api/atlas", "/api/ingress/scan"],
    carrier: "R",
    energy: 1.8
  },
  {
    id: "V2",
    role: "cognition_telemetry_repo_cosmos_atlas",
    port: 8788,
    surfaces: ["/cognition", "/api/cognition/status", "/api/cognition/trace", "/api/cognition/atlas", "/api/epic1/scan/preview"],
    carrier: "A_n",
    energy: 3.44
  },
  {
    id: "V3",
    role: "self_reflective_object_mesh",
    port: 8789,
    surfaces: ["/v3/object-mesh", "/api/v3/object-mesh"],
    carrier: "bridge_discipline",
    energy: 12.576
  }
]);

export function buildV4VersionCage() {
  const bridges = buildBridges(VERSION_NODES);
  const totalEnergy = round(VERSION_NODES.reduce((sum, node) => sum + node.energy, 0));
  const gluingEvidence = average(bridges.map((bridge) => bridge.gluing_evidence));
  const projectionViolence = average(bridges.map((bridge) => bridge.projection_violence));

  return {
    product: "netracer-v4-version-cage",
    mode: "smooth_pliable_visual_consolidation",
    writes: [],
    cage: {
      kind: "hypercomplex_hyperdim_n_caged_version_manifold",
      mesh: "virtual_360x360_orthogonal_bridge_cage",
      pliability: "smooth_crossable_interbridge_navigation",
      purpose: "host_all_nets_by_geometric_navigation_and_translation"
    },
    principle: {
      operator: "hypercomplex_inside_hypercomplex",
      scope: "V1_V2_V3_inside_V4",
      rule: "higher cosmos perspective is valid only when prior version invariants remain reachable",
      not_one_planet: true
    },
    versions: VERSION_NODES,
    bridges,
    navigation: {
      crossing_modes: ["translate", "holoport", "reflect", "resonate", "return"],
      entry_points: VERSION_NODES.map((node) => ({
        version: node.id,
        local_url: `http://127.0.0.1:${node.port}/`,
        primary_surface: node.surfaces[0]
      })),
      selected_default_path: ["V1", "V2", "V3", "V1"]
    },
    hamiltonian: {
      total_cognitive_energy: totalEnergy,
      gluing_evidence: gluingEvidence,
      projection_violence: projectionViolence,
      objective: "maximize cross-version reachability while preserving each version as a local cosmos"
    },
    invariants: {
      non_destructive: true,
      all_prior_versions_reachable: true,
      no_flattening_to_single_version: true,
      bridges_are_crossable_not_absorptive: true,
      active_remainder_preserved: projectionViolence < 0.34
    },
    launch: {
      infra: "V4",
      port: 8790,
      endpoint: "/api/v4/version-cage",
      view: "/v4/version-cage"
    }
  };
}

function buildBridges(nodes) {
  const edges = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const from = nodes[index];
    const to = nodes[(index + 1) % nodes.length];
    const recognition = round(0.82 + index * 0.035);
    const resonance = round(0.79 + index * 0.041);
    edges.push({
      id: `${from.id}->${to.id}`,
      from: from.id,
      to: to.id,
      translation: `${from.role}_to_${to.role}`,
      crossing: "geometric_interbridge",
      recognition,
      resonance,
      gluing_evidence: round((recognition + resonance) / 2),
      projection_violence: round(0.22 - index * 0.025),
      active_remainder: round(0.18 + index * 0.03),
      return_path: `${to.id}->${from.id}`
    });
  }
  return edges;
}

function average(values) {
  if (!values.length) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value) {
  return Number(value.toFixed(6));
}
