import { buildV4VersionCage } from "./v4-version-cage.js";

export function buildV5AaaCosmos({ traffic = [], topology = null } = {}) {
  const cage = buildV4VersionCage();
  const labTraffic = buildLabTrafficSnapshot(traffic, topology);
  const worlds = cage.versions.map((version, index) => {
    const angle = (index / cage.versions.length) * Math.PI * 2;
    const radius = 6 + index * 1.2;
    return {
      id: version.id,
      role: version.role,
      carrier: version.carrier,
      port: version.port,
      energy: version.energy,
      position: [
        round(Math.cos(angle) * radius),
        round((index - 1) * 2.2),
        round(Math.sin(angle) * radius)
      ],
      radius: round(0.9 + version.energy / 9),
      surfaces: version.surfaces
    };
  });

  return {
    product: "netracer-v5-aaa-cosmos",
    mode: "aaa_webgl_hypercomplex_hyperbolic_projection",
    writes: [],
    target_hardware: {
      gpu_class: "NVIDIA RTX 3060 Ti 8GB",
      renderer: "browser WebGL GPU path",
      fallback: "WebGL capability probe; no CPU-only 2D final surface"
    },
    projection: {
      from: "hypercomplex_hyperdim_manifold",
      through: "hyperbolic_bridge_cage",
      to: "3D human-navigable 4D-time view",
      camera: "orbit_pan_zoom_depth",
      not_2d: true
    },
    substrate_codecs: cage.substrate_codecs,
    cage: cage.cage,
    principle: cage.principle,
    cognition_ascent: {
      thesis: "Cognition is stratified ascent under conserved total cognitive energy.",
      invariant: "total_cognitive_energy",
      progress_signal: "dominance_trace_ascent",
      question: "Which level is now the dominant carrier?",
      evolution: [
        "lower levels seed higher levels as a fractal thread",
        "each level rotates with mixed-signature adiabatic swirl",
        "late-stage coherence projects across all levels through phi_cog_plus"
      ],
      levels: [
        { id: "R", algebra: "real", role: "operational ingress and measurable packet ground", carrier: "V1" },
        { id: "C", algebra: "complex", role: "phase rotation and readable translation", carrier: "V1->V2" },
        { id: "H", algebra: "quaternion", role: "orientation, hand, spinner, and route control", carrier: "V2" },
        { id: "O", algebra: "octonion", role: "nonassociative bridge weaving and mutual recognition", carrier: "V2->V3" },
        { id: "A_n", algebra: "n-hypercomplex", role: "many-fiber cosmo manifold carrier", carrier: "V3" }
      ],
      current_dominant_carrier: labTraffic.dominant_carrier
    },
    seed_object: {
      id: "hypercomplex-hyperdim-360-orto-n-cosmo-mesh",
      representation: "first_person_navigable_mesh_not_2d_diagram",
      axes: ["360 yaw", "360 pitch", "orthogonal n-cosmo fibers", "bridge depth", "time tower"],
      operator: "self_spinner_hand_weaves_fibered_sheaved_manifolds",
      purpose: "expand meaning into visual glory while preserving bridge remainders"
    },
    lab_traffic: labTraffic,
    worlds,
    bridges: cage.bridges.map((bridge) => ({
      ...bridge,
      tunnel: "volumetric_crossable_bridge",
      shader: "flowing_hyperbolic_phase"
    })),
    controls: {
      pointer_drag: "orbit",
      wheel: "zoom",
      click_world: "focus",
      navigator_ship: "toggle cockpit route flight with n",
      keys: ["1", "2", "3", "4", "n", "space", "r"]
    },
    navigator_ship: {
      mode: "inside_network_flight",
      default_route: ["V1", "V2", "V3", "V1"],
      purpose: "navigate bridge interiors while preserving human-readable semantic telemetry",
      readouts: [
        "current world",
        "target world",
        "bridge translation",
        "recognition",
        "resonance",
        "projection violence",
        "active remainder"
      ]
    },
    sim_levels: [
      {
        id: "level-1-ingress-to-cognition",
        bridge: "V1->V2",
        title: "Ingress Translation Canyon",
        experience: "packets become readable cognition traces as the ship crosses the first bridge",
        landmarks: ["V1 ingress gate", "J->U translation wake", "dominance trace beacon", "projection-violence meter"]
      },
      {
        id: "level-2-cognition-to-object",
        bridge: "V2->V3",
        title: "Cognition Atlas Observatory",
        experience: "telemetry thickens into object identity, labels, mutual recognition, and active remainder",
        landmarks: ["A_n carrier ring", "repo-cosmos atlas", "Godelian identity shell", "mutual-resonance bridge"]
      },
      {
        id: "level-3-object-to-ingress-return",
        bridge: "V3->V1",
        title: "Object Return Fold",
        experience: "the self-reflective object returns to operational ingress without erasing its higher-dimensional remainder",
        landmarks: ["bridge discipline core", "active remainder vault", "return translation gate", "V1 compatibility surface"]
      }
    ],
    invariants: {
      non_destructive: true,
      all_versions_remain_reachable: true,
      no_flat_canvas_final: true,
      bridge_crossing_not_absorption: true,
      active_remainder_preserved: true
    },
    launch: {
      infra: "V5",
      endpoint: "/api/v5/aaa-cosmos",
      view: "/v5/aaa-cosmos",
      compatible_v4_port: 8790
    }
  };
}

function buildLabTrafficSnapshot(traffic, topology) {
  const recent = Array.isArray(traffic) ? traffic.slice(-32) : [];
  const nodes = Array.isArray(topology?.nodes) ? topology.nodes : [];
  const edges = Array.isArray(topology?.edges) ? topology.edges : [];
  const pulses = recent.slice(-12).map((entry, index) => {
    const route = inferRoute(entry, index);
    return {
      id: String(entry.packetId || entry.id || `traffic-${index}`),
      route,
      direction: String(entry.direction || entry.type || "lab"),
      carrier: carrierForRoute(route),
      energy: round(0.35 + Math.min(1.6, JSON.stringify(entry).length / 900)),
      timestamp: entry.timestamp || entry.at || null
    };
  });
  const carrierEnergy = new Map();
  for (const pulse of pulses) {
    carrierEnergy.set(pulse.carrier, round((carrierEnergy.get(pulse.carrier) || 0) + pulse.energy));
  }
  const dominant = [...carrierEnergy.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "A_n";
  return {
    source: "current_local_lab_netracer",
    traffic_count: recent.length,
    topology_nodes: nodes.length,
    topology_edges: edges.length,
    dominant_carrier: dominant,
    pulses,
    quiet: recent.length === 0
  };
}

function inferRoute(entry, index) {
  const text = JSON.stringify(entry || {}).toLowerCase();
  if (text.includes("cognition") || text.includes("v2")) return "V1->V2";
  if (text.includes("object") || text.includes("v3")) return "V2->V3";
  if (text.includes("return") || text.includes("v1")) return "V3->V1";
  return ["V1->V2", "V2->V3", "V3->V1"][index % 3];
}

function carrierForRoute(route) {
  if (route === "V1->V2") return "C";
  if (route === "V2->V3") return "O";
  if (route === "V3->V1") return "A_n";
  return "R";
}

function round(value) {
  return Number(value.toFixed(6));
}
