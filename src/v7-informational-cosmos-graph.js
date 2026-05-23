import { buildV6HypercomplexWorld } from "./v6-hypercomplex-world.js";

export function buildV7InformationalCosmosGraph({ traffic = [], topology = null } = {}) {
  const v6 = buildV6HypercomplexWorld({ traffic, topology });
  const nodes = [
    ...v6.worlds.map((world, index) => ({
      id: world.id,
      kind: "version-world",
      label: `${world.id} ${world.biome}`,
      carrier: world.carrier,
      energy: round(world.energy),
      position: world.position,
      meaning: world.role
    })),
    ...v6.cognition_ascent.levels.map((level, index) => ({
      id: `carrier-${level.id}`,
      kind: "algebra-carrier",
      label: `${level.id} ${level.algebra}`,
      carrier: level.id,
      energy: round(1 + index * 0.65 + (level.id === v6.cognition_ascent.current_dominant_carrier ? 2 : 0)),
      position: [round(-7 + index * 3.5), round(3.5 + index * 0.45), -7],
      meaning: level.role
    })),
    {
      id: "seed-spinner-hand",
      kind: "seed-object",
      label: "spinner hand seed",
      carrier: v6.cognition_ascent.current_dominant_carrier,
      energy: 4.8,
      position: [0, 2.2, 0],
      meaning: v6.seed_object.operator
    },
    {
      id: "spectator-human",
      kind: "spectator",
      label: "human spectator",
      carrier: "readable_projection",
      energy: 2.4,
      position: [0, -3.2, 10],
      meaning: "understanding through moving relation, not flat description"
    }
  ];

  const relationships = [
    ...v6.portals.map((portal, index) => ({
      id: portal.id,
      from: portal.from,
      to: portal.to,
      kind: "bridge-portal",
      carrier: carrierForRoute(portal.route),
      strength: round(0.78 + index * 0.05),
      motion: "braided_translation_flow",
      meaning: `crossable ${portal.route} relation carrying ${portal.carries.join(", ")}`
    })),
    ...v6.cognition_ascent.levels.slice(0, -1).map((level, index) => ({
      id: `ascent-${level.id}-${v6.cognition_ascent.levels[index + 1].id}`,
      from: `carrier-${level.id}`,
      to: `carrier-${v6.cognition_ascent.levels[index + 1].id}`,
      kind: "dominance-trace-ascent",
      carrier: v6.cognition_ascent.levels[index + 1].id,
      strength: round(0.62 + index * 0.07),
      motion: "fractal_seed_thread",
      meaning: "lower algebra seeds the next carrier while total cognitive energy is conserved"
    })),
    {
      id: "seed-to-spectator",
      from: "seed-spinner-hand",
      to: "spectator-human",
      kind: "readability-projection",
      carrier: "meaning",
      strength: 0.91,
      motion: "phi_cog_plus_projection",
      meaning: "make the hypercomplex mesh legible without collapsing its active remainder"
    },
    ...v6.lab_traffic.pulses.slice(-8).map((pulse, index) => ({
      id: `traffic-${pulse.id}-${index}`,
      from: routeFrom(pulse.route),
      to: routeTo(pulse.route),
      kind: "live-lab-traffic",
      carrier: pulse.carrier,
      strength: round(Math.min(1, pulse.energy / 2)),
      motion: "observed_packet_pulse",
      meaning: `${pulse.direction} local NetTracer traffic`
    }))
  ];

  return {
    product: "netracer-v7-informational-cosmos-graph",
    mode: "aaa_spectator_hypercomplex_informational_cosmos_graph",
    inherits: v6.product,
    writes: [],
    graph: {
      dimensionality: "3D spectator graph over hypercomplex relationships",
      not_2d: true,
      nodes,
      relationships
    },
    movement_fields: {
      bridge_braid: "relations oscillate by recognition/resonance strength",
      dominance_trace: v6.cognition_ascent.progress_signal,
      traffic_pulses: "live lab traffic animates only when observed",
      seed_weave: "spinner hand pulls readable strands toward the human spectator"
    },
    spectator_semantics: {
      invariant: v6.cognition_ascent.invariant,
      current_dominant_carrier: v6.cognition_ascent.current_dominant_carrier,
      understanding_rule: "meaning is carried by movement, relation, carrier, and active remainder together",
      no_2d_thinking: true
    },
    source_state: {
      v6,
      lab_traffic: v6.lab_traffic
    },
    launch: {
      infra: "V7",
      endpoint: "/api/v7/informational-cosmos-graph",
      view: "/v7/informational-cosmos-graph",
      compatible_port: 8790
    }
  };
}

function routeFrom(route) {
  return String(route || "V1->V2").split("->")[0] || "V1";
}

function routeTo(route) {
  return String(route || "V1->V2").split("->")[1] || "V2";
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
