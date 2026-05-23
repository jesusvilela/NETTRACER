import { buildV9NetworkGrowthCosmos } from "./v9-network-growth-cosmos.js";

export function buildV10SignStabilizedFibers({ traffic = [], topology = null, meshCount = 7 } = {}) {
  const v9 = buildV9NetworkGrowthCosmos({ traffic, topology, meshCount });
  const outputHighway = buildOutputHighway(v9);
  const behavioralFibers = buildBehavioralFibers(v9);
  const gaugeRotations = buildGaugeRotations(behavioralFibers);
  return {
    product: "netracer-v10-sign-stabilized-fibers",
    mode: "aaa_hypercomplex_two_channel_fiber_visualization",
    inherits: v9.product,
    writes: [],
    inspiration: {
      source: "Zenodo record 20102939",
      title: "Mathematics is All You Need 2 — Sign-Stabilized Behavioral Fibers in Transformer Residual Streams.",
      doi: "10.5281/zenodo.20102939",
      used_as: "visual and structural inspiration for two-channel fiber geometry"
    },
    two_channel_geometry: {
      output_highway: "rank_1_dominant_output_channel",
      behavioral_channel: "low_rank_near_orthogonal_sign_stabilized_fibers",
      invariant_object: "sign_stabilized_subspace_not_single_basis",
      not_2d: true
    },
    output_highway: outputHighway,
    behavioral_fibers: behavioralFibers,
    gauge_rotations: gaugeRotations,
    source_state: {
      v9,
      lab_traffic: v9.source_state.lab_traffic
    },
    spectator_semantics: {
      ...v9.spectator_semantics,
      understanding_rule: "humans see the network as a split geometry: output highway plus near-orthogonal behavioral fibers stabilized by sign and subspace",
      sign_stabilized_fiber_view: true
    },
    launch: {
      infra: "V10",
      endpoint: "/api/v10/sign-stabilized-fibers",
      view: "/v10/sign-stabilized-fibers",
      compatible_port: 8790
    }
  };
}

function buildOutputHighway(v9) {
  return v9.meshes.map((mesh, index) => ({
    id: `highway:${mesh.id}`,
    mesh_id: mesh.id,
    rank: 1,
    carrier: "output",
    strength: round(1.4 + index * 0.08),
    start: [round(mesh.offset[0]), round(mesh.offset[1] - 4.2), round(mesh.offset[2])],
    end: [round(mesh.offset[0]), round(mesh.offset[1] + 5.2), round(mesh.offset[2])],
    meaning: "dominant output channel through the local world mesh"
  }));
}

function buildBehavioralFibers(v9) {
  const lanes = ["R", "C", "H", "O", "A_n", "meaning", "traffic"];
  const seeds = v9.information_seeds.slice(0, 18);
  const fibers = [];
  for (const mesh of v9.meshes) {
    seeds.forEach((seed, index) => {
      const lane = lanes.indexOf(seed.carrier) >= 0 ? lanes.indexOf(seed.carrier) : 2;
      const angle = (index / Math.max(1, seeds.length)) * Math.PI * 2 + mesh.phase * Math.PI * 2;
      const radius = 2.4 + lane * 0.55;
      const sign = index % 2 === 0 ? 1 : -1;
      fibers.push({
        id: `fiber:${mesh.id}:${seed.id}`,
        mesh_id: mesh.id,
        seed_id: seed.id,
        carrier: seed.carrier,
        rank: 1 + (index % 4),
        sign,
        stability: round(0.72 + ((index + lane) % 7) * 0.035),
        orthogonality: round(0.82 + lane * 0.018),
        anchor: mesh.offset,
        direction: [
          round(Math.cos(angle) * radius),
          round(sign * (1.2 + lane * 0.22)),
          round(Math.sin(angle) * radius)
        ],
        meaning: `sign-stabilized behavioral fiber for ${seed.label}`
      });
    });
  }
  return fibers;
}

function buildGaugeRotations(fibers) {
  return fibers.slice(0, 64).map((fiber, index) => ({
    id: `gauge:${fiber.id}`,
    fiber_id: fiber.id,
    rotation_phase: round((index * 0.61803398875) % 1),
    preserves_subspace: true,
    sign: fiber.sign,
    meaning: "basis may rotate while the behavioral subspace remains the object"
  }));
}

function round(value) {
  return Number(value.toFixed(6));
}
