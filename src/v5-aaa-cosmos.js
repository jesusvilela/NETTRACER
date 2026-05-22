import { buildV4VersionCage } from "./v4-version-cage.js";

export function buildV5AaaCosmos() {
  const cage = buildV4VersionCage();
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

function round(value) {
  return Number(value.toFixed(6));
}
