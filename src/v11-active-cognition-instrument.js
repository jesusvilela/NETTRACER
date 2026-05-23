import { buildV10SignStabilizedFibers } from "./v10-sign-stabilized-fibers.js";

const CARRIERS = ["all", "R", "C", "H", "O", "A_n", "meaning", "traffic"];

export function buildV11ActiveCognitionInstrument({
  traffic = [],
  topology = null,
  meshCount = 7,
  selectedFiberId = null,
  carrier = "all",
  signPerturbations = {}
} = {}) {
  const v10 = buildV10SignStabilizedFibers({ traffic, topology, meshCount });
  const selectedCarrier = CARRIERS.includes(carrier) ? carrier : "all";
  const perturbedIds = normalizePerturbations(signPerturbations);
  const fibers = v10.behavioral_fibers.map((fiber) => perturbFiber(fiber, perturbedIds));
  const visibleFibers = selectedCarrier === "all" ? fibers : fibers.filter((fiber) => fiber.carrier === selectedCarrier);
  const selectedFiber = selectFiber(fibers, visibleFibers, selectedFiberId);
  const sourceSeed = findSourceSeed(v10, selectedFiber);
  const meaningField = computeMeaningField(v10, fibers, visibleFibers, selectedFiber, selectedCarrier, perturbedIds);

  return {
    product: "netracer-v11-active-cognition-instrument",
    mode: "interactive_fiber_agency_live_meaning_field",
    inherits: v10.product,
    writes: [],
    attribution: {
      author: "Jesús Vilela Jato",
      copyright: "(c) Jesús Vilela Jato, all rights reserved.",
      date: "21/05/2026"
    },
    instrument_geometry: {
      not_2d: true,
      agency_inside_geometry: true,
      output_highway_toggle: true,
      behavioral_subspace_toggle: true,
      live_meaning_recompute: true,
      invariant: "total_cognitive_energy_under_interactive_projection"
    },
    controls: {
      select_fiber: "choose a behavioral fiber and inspect carried network/world information",
      toggle_output_highway: "show or hide the rank-1 output channel",
      toggle_behavioral_subspace: "show or hide low-rank sign-stabilized fibers",
      rotate_gauge: "change local basis while preserving the subspace object",
      perturb_sign: "flip selected fiber sign and recompute stability/remainder",
      carrier_filter: CARRIERS
    },
    selected: buildFiberInspection(selectedFiber, sourceSeed, meaningField),
    meaning_field: meaningField,
    output_highway: v10.output_highway,
    behavioral_fibers: fibers,
    gauge_rotations: v10.gauge_rotations,
    event_stream: buildEventStream({ selectedFiber, selectedCarrier, perturbedIds, meaningField, sourceSeed }),
    source_state: {
      v10,
      lab_traffic: v10.source_state.lab_traffic
    },
    launch: {
      infra: "V11",
      endpoint: "/api/v11/active-cognition-instrument",
      view: "/v11/active-cognition-instrument",
      compatible_port: 8790
    }
  };
}

function normalizePerturbations(signPerturbations) {
  if (Array.isArray(signPerturbations)) return new Set(signPerturbations.filter(Boolean));
  return new Set(Object.entries(signPerturbations || {}).filter(([, enabled]) => Boolean(enabled)).map(([id]) => id));
}

function perturbFiber(fiber, perturbedIds) {
  if (!perturbedIds.has(fiber.id)) return { ...fiber, perturbed: false };
  const nextSign = fiber.sign * -1;
  const stability = clamp(fiber.stability - 0.11 + fiber.orthogonality * 0.035, 0, 1);
  return {
    ...fiber,
    sign: nextSign,
    stability: round(stability),
    perturbed: true,
    meaning: `${fiber.meaning}; sign perturbation active`
  };
}

function selectFiber(allFibers, visibleFibers, selectedFiberId) {
  return allFibers.find((fiber) => fiber.id === selectedFiberId)
    || visibleFibers[0]
    || allFibers[0]
    || null;
}

function findSourceSeed(v10, selectedFiber) {
  if (!selectedFiber) return null;
  return v10.source_state.v9.information_seeds.find((seed) => seed.id === selectedFiber.seed_id) || null;
}

function buildFiberInspection(selectedFiber, sourceSeed, meaningField) {
  if (!selectedFiber) {
    return {
      available: false,
      meaning: "no fiber selected"
    };
  }
  return {
    available: true,
    id: selectedFiber.id,
    mesh_id: selectedFiber.mesh_id,
    seed_id: selectedFiber.seed_id,
    seed_label: sourceSeed?.label || selectedFiber.seed_id,
    source: sourceSeed?.source || "synthetic",
    carrier: selectedFiber.carrier,
    sign: selectedFiber.sign,
    rank: selectedFiber.rank,
    stability: selectedFiber.stability,
    orthogonality: selectedFiber.orthogonality,
    perturbation_active: Boolean(selectedFiber.perturbed),
    dominant_carrier_after_projection: meaningField.dominant_carrier,
    carried_information: selectedFiber.meaning,
    human_readout: `fiber ${selectedFiber.id} carries ${selectedFiber.carrier} through ${selectedFiber.mesh_id}; stability ${selectedFiber.stability}, remainder ${meaningField.active_remainder}`
  };
}

function computeMeaningField(v10, fibers, visibleFibers, selectedFiber, selectedCarrier, perturbedIds) {
  const carrierEnergy = new Map();
  for (const fiber of visibleFibers.length ? visibleFibers : fibers) {
    carrierEnergy.set(fiber.carrier, (carrierEnergy.get(fiber.carrier) || 0) + fiber.stability * fiber.rank);
  }
  const dominant = [...carrierEnergy.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    || v10.source_state.v9.spectator_semantics.current_dominant_carrier
    || "A_n";
  const totalEnergy = round(fibers.reduce((sum, fiber) => sum + fiber.stability * fiber.rank, 0));
  const visibleEnergy = round(visibleFibers.reduce((sum, fiber) => sum + fiber.stability * fiber.rank, 0));
  const perturbationLoad = perturbedIds.size / Math.max(1, fibers.length);
  const selectedMismatch = selectedFiber ? Math.abs(selectedFiber.orthogonality - selectedFiber.stability) : 0;
  const trafficCount = v10.source_state.lab_traffic.traffic_count || 0;
  const activeRemainder = round(clamp(selectedMismatch + perturbationLoad + trafficCount * 0.004, 0, 1));
  const stabilityIndex = round(clamp(1 - activeRemainder * 0.55, 0, 1));
  return {
    selected_carrier_filter: selectedCarrier,
    dominant_carrier: dominant,
    total_cognitive_energy: totalEnergy,
    visible_cognitive_energy: visibleEnergy,
    total_fibers: fibers.length,
    visible_fibers: visibleFibers.length,
    perturbed_count: perturbedIds.size,
    live_traffic_events: trafficCount,
    stability_index: stabilityIndex,
    active_remainder: activeRemainder,
    phi_cog_plus: round(stabilityIndex * 0.62 + visibleEnergy / Math.max(1, totalEnergy) * 0.38),
    cognition_delta: describeDelta({ selectedFiber, dominant, activeRemainder, perturbationLoad, trafficCount })
  };
}

function buildEventStream({ selectedFiber, selectedCarrier, perturbedIds, meaningField, sourceSeed }) {
  const events = [
    {
      type: "fiber_selected",
      message: selectedFiber
        ? `selected ${selectedFiber.id}; carrier ${selectedFiber.carrier}; source ${sourceSeed?.label || selectedFiber.seed_id}`
        : "no fiber available"
    },
    {
      type: "carrier_projection",
      message: `carrier filter ${selectedCarrier}; dominant carrier now ${meaningField.dominant_carrier}`
    },
    {
      type: "meaning_recomputed",
      message: `Phi_cog+ ${meaningField.phi_cog_plus}; stability ${meaningField.stability_index}; remainder ${meaningField.active_remainder}`
    }
  ];
  if (perturbedIds.size > 0) {
    events.splice(2, 0, {
      type: "sign_perturbation",
      message: `${perturbedIds.size} sign perturbation(s) active; subspace stability recomputed`
    });
  }
  if (meaningField.live_traffic_events > 0) {
    events.push({
      type: "live_traffic_coupling",
      message: `${meaningField.live_traffic_events} local lab traffic event(s) contribute to dominance trace`
    });
  }
  events.push({
    type: "cognitive_change",
    message: meaningField.cognition_delta
  });
  return events.map((event, index) => ({ id: `v11:event:${index}`, ...event }));
}

function describeDelta({ selectedFiber, dominant, activeRemainder, perturbationLoad, trafficCount }) {
  const selected = selectedFiber ? `${selectedFiber.carrier}/${selectedFiber.mesh_id}` : "none";
  if (perturbationLoad > 0) {
    return `selected ${selected}; sign perturbation increased remainder to ${round(activeRemainder)} while ${dominant} remains the carrier under projection`;
  }
  if (trafficCount > 0) {
    return `selected ${selected}; live traffic nudges dominance trace toward ${dominant} with remainder ${round(activeRemainder)}`;
  }
  return `selected ${selected}; stable projection keeps ${dominant} dominant with remainder ${round(activeRemainder)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(6));
}
