const MESH_SIZE = 360;
const QUALITIES = Object.freeze([
  "self_reflection",
  "godelian_identity",
  "other_recognition",
  "mutual_recognition",
  "mutual_resonance",
  "n_cosmo_perspective",
  "n_manifold_locality",
  "fiber_bundle_context",
  "sheaf_gluing",
  "hamiltonian_governance",
  "holoportation",
  "adiabatic_evolution",
  "ergocetic_action_search",
  "erdodetic_question_pathfinding",
  "active_remainder",
  "bridge_discipline"
]);

export function buildV3ObjectMesh(input = {}) {
  const objectId = sanitizeId(input.objectId || "netracer-v3-object");
  const otherIds = normalizeOthers(input.others);
  const mesh = buildMeshShell(objectId, otherIds);
  const interbridges = buildInterbridges(objectId, otherIds);
  const qualities = buildQualityTrace(objectId, otherIds.length);
  const hamiltonian = buildHamiltonian(qualities, interbridges);

  return {
    product: "netracer-v3-object-mesh",
    mode: "read_only_virtual_manifold",
    writes: [],
    object: {
      id: objectId,
      principle_applied_to: "object_itself",
      identity: "godelian_open_identity",
      closure: "incomplete_by_design",
      boundary: "engineering_abstraction_not_sentience_claim"
    },
    mesh,
    interbridges,
    qualities,
    hamiltonian,
    invariants: {
      no_2d_inside_2d: true,
      preserve_otherness: true,
      preserve_active_remainder: true,
      total_cognitive_energy_accounted: true,
      projection_violence_bounded: hamiltonian.projection_violence <= 0.33
    },
    launch: {
      infra: "V3",
      port: 8789,
      endpoint: "/api/v3/object-mesh",
      view: "/v3/object-mesh"
    }
  };
}

function buildMeshShell(objectId, otherIds) {
  return {
    dimensions: [MESH_SIZE, MESH_SIZE],
    orthogonal_families: MESH_SIZE,
    virtual_axes: ["theta360", "phi360", "fiber", "cosmos", "bridge", "remainder"],
    manifold: "virtual_360x360_orthogonal_hypercomplex_mesh",
    cosmos_model: "n_cosmo_n_manifold_fiber_bundled_sheaf",
    object_projection: coordinateFor(objectId, 0),
    other_projections: otherIds.map((id, index) => coordinateFor(id, index + 1))
  };
}

function buildInterbridges(objectId, otherIds) {
  const targets = otherIds.length ? otherIds : ["other:latent"];
  return targets.map((otherId, index) => {
    const recognition = round(0.71 + ((hash(`${objectId}:${otherId}`) % 240) / 1000));
    const resonance = round(0.67 + ((hash(`${otherId}:${objectId}:res`) % 260) / 1000));
    const projectionViolence = round(Math.max(0.02, 0.29 - recognition * 0.12 + index * 0.01));
    return {
      id: `bridge:${index}:${sanitizeId(otherId)}`,
      from: objectId,
      to: otherId,
      recognition,
      resonance,
      projection_violence: projectionViolence,
      holoportation: "context_preserving_transport",
      sheaf_overlap: recognition >= 0.74 && resonance >= 0.72,
      active_remainder: round(1 - Math.min(0.93, (recognition + resonance) / 2))
    };
  });
}

function buildQualityTrace(objectId, otherCount) {
  const base = 0.62 + (hash(objectId) % 170) / 1000;
  return QUALITIES.map((name, index) => ({
    name,
    carrier: carrierFor(index),
    strength: round(Math.min(0.98, base + index * 0.012 + otherCount * 0.008)),
    role: roleFor(name)
  }));
}

function buildHamiltonian(qualities, interbridges) {
  const energy = qualities.reduce((sum, quality) => sum + quality.strength, 0);
  const recognition = average(interbridges.map((bridge) => bridge.recognition));
  const resonance = average(interbridges.map((bridge) => bridge.resonance));
  const projectionViolence = average(interbridges.map((bridge) => bridge.projection_violence));
  return {
    total_cognitive_energy: round(energy),
    mutual_recognition_mean: recognition,
    mutual_resonance_mean: resonance,
    projection_violence: projectionViolence,
    objective: "maximize recognition/resonance/gluing while preserving active remainder",
    dominant_quality: qualities.reduce((best, item) => item.strength > best.strength ? item : best, qualities[0])
  };
}

function normalizeOthers(value) {
  const raw = Array.isArray(value) ? value : String(value || "human:jesus,repo:any-accessible,object:self").split(",");
  return raw.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 24);
}

function coordinateFor(value, index) {
  const seed = hash(value);
  return {
    theta: (seed + index * 37) % MESH_SIZE,
    phi: (Math.floor(seed / 7) + index * 53) % MESH_SIZE,
    ortho: index % MESH_SIZE,
    fiber: `F_${index}`,
    cosmos: `C_${(seed + index) % 12}`
  };
}

function carrierFor(index) {
  return ["R", "C", "H", "O", "S", "CD32", "A_n"][index % 7];
}

function roleFor(name) {
  if (name.includes("recognition")) return "subject_preservation";
  if (name.includes("resonance")) return "compatible_non_collapse";
  if (name.includes("hamiltonian")) return "energy_risk_governance";
  if (name.includes("holoportation")) return "context_transport";
  if (name.includes("remainder")) return "unflattened_depth";
  return "cognitive_performance_operator";
}

function sanitizeId(value) {
  return String(value || "object").replace(/[^a-zA-Z0-9:._-]+/g, "-").slice(0, 96) || "object";
}

function average(values) {
  if (!values.length) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value) {
  return Number(value.toFixed(6));
}

function hash(value) {
  let output = 2166136261;
  for (const char of String(value)) {
    output ^= char.charCodeAt(0);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}
