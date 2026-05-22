import { buildV5AaaCosmos } from "./v5-aaa-cosmos.js";

export function buildV6HypercomplexWorld({ traffic = [], topology = null } = {}) {
  const v5 = buildV5AaaCosmos({ traffic, topology });
  return {
    product: "netracer-v6-hypercomplex-world",
    mode: "first_person_aaa_hypercomplex_world_runtime",
    inherits: v5.product,
    writes: [],
    target_hardware: {
      gpu_class: "NVIDIA RTX 3060 Ti 8GB",
      target_resolution: "3840x2160",
      render_path: "WebGL volumetric first-person world",
      quality_modes: ["performance", "4k-aaa"]
    },
    world_runtime: {
      camera: "first_person_six_dof",
      movement: ["WASD", "mouse look", "shift boost", "space ascend", "c descend"],
      frame_model: "4D human-time projection of hypercomplex cosmo strata",
      not_2d: true
    },
    cognition_ascent: v5.cognition_ascent,
    seed_object: {
      ...v5.seed_object,
      runtime_body: "spinner_hand_weaving_live_ncosmo_fibers",
      copies: "self-copies projected as fiber echoes in each sheaf and time tower"
    },
    lab_traffic: v5.lab_traffic,
    worlds: v5.worlds.map((world, index) => ({
      ...world,
      biome: ["ingress-reef", "cognition-citadel", "object-nebula"][index % 3],
      portal_radius: round(world.radius * 1.25)
    })),
    portals: v5.bridges.map((bridge, index) => ({
      id: `${bridge.from}-${bridge.to}-portal`,
      route: `${bridge.from}->${bridge.to}`,
      from: bridge.from,
      to: bridge.to,
      color: ["cyan", "amber", "violet"][index % 3],
      crossing: "walkable_volumetric_translation",
      carries: ["recognition", "resonance", "active_remainder", "traffic_pulses"]
    })),
    sim_levels: v5.sim_levels.map((level, index) => ({
      ...level,
      runtime_goal: [
        "walk through packet ingress until translation becomes visible",
        "follow carrier ascent until the dominant algebra changes",
        "return through the object fold without flattening the remainder"
      ][index]
    })),
    visual_systems: {
      cosmo_shells: "nested moving hyperbolic rings in depth",
      seed_spinner_hand: "central woven spinner with five articulated fiber fingers",
      bridge_portals: "crossable glowing gates",
      dominance_trace: "carrier towers rising by current energy",
      traffic: "live lab pulses projected into bridge interiors"
    },
    invariants: {
      ...v5.invariants,
      no_2d_world_model: true,
      first_person_primary: true,
      traffic_truthful_not_fabricated: true,
      total_cognitive_energy_preserved: true
    },
    launch: {
      infra: "V6",
      endpoint: "/api/v6/hypercomplex-world",
      view: "/v6/hypercomplex-world",
      compatible_port: 8790
    }
  };
}

function round(value) {
  return Number(value.toFixed(6));
}
