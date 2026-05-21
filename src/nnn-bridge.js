import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { join, resolve } from "node:path";


let nnnProcess = null;
let nnnApiUrl = "http://127.0.0.1:3030";
let juRamdiskDir = process.env.NNN_RAMDISK_DIR || "C:\\nnn-hyperbolic-ramdisk\\target\\nnn-ramdisk";
const NNN_FETCH_TIMEOUT_MS = 750;

export function startNnnBridge(config) {
  nnnApiUrl = config?.nnn?.apiUrl || nnnApiUrl;
  if (config?.nnn?.enabled === false) {
    console.log("NNN Bridge disabled by NNN_BRIDGE_ENABLED=0");
    return;
  }
  if (config?.nnn?.sidecarMode === "external") {
    console.log(`NNN Bridge using external API at ${nnnApiUrl}`);
    return;
  }
  const nnnPath = resolveNnnRoot(config);
  const ramdiskDir = resolveJuRamdiskDir(config, nnnPath);
  juRamdiskDir = ramdiskDir;
  fs.mkdirSync(juRamdiskDir, { recursive: true });
  if (!nnnPath) {
    console.warn("NNN Bridge skipped: set NNN_RAMDISK_ROOT or NNN_RAMDISK_ROOTS to an existing nnn-hyperbolic-ramdisk checkout.");
    return;
  }

  nnnProcess = spawn("cargo", ["run", "-p", "nnn_api"], {
    cwd: nnnPath,
    stdio: "inherit",
    env: { ...process.env, NNN_RAMDISK_DIR: ramdiskDir, NNN_API_PORT: String(config?.nnn?.port || 3030) }
  });

  nnnProcess.on("error", (err) => {
    console.error("NNN Bridge Error:", err);
  });
}

function resolveNnnRoot(config) {
  const candidates = [
    config?.nnn?.root,
    ...(Array.isArray(config?.nnn?.candidateRoots) ? config.nnn.candidateRoots : [])
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function resolveJuRamdiskDir(config, nnnRoot = "") {
  const candidates = [
    process.env.NNN_RAMDISK_DIR,
    nnnRoot ? join(nnnRoot, "target", "nnn-ramdisk") : "",
    "C:\\nnn-hyperbolic-ramdisk\\target\\nnn-ramdisk",
    resolve(config?.stateDir || ".", "nnn-ramdisk")
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

export function stopNnnBridge() {
  if (nnnProcess) {
    nnnProcess.kill();
  }
}

const MIND_QUALITY_IDS = [
  "self_reflection", "godelian_identity", "otherness", "mutual_recognition",
  "mutual_resonance", "n_cosmo", "n_manifold", "fiber_bundled", "sheaved",
  "hamiltonian", "holoportation", "adiabatic", "general_intelligence",
  "ergoretic", "erdodetic", "memory", "pre_registration",
  "adversarial_negation", "proof_grounding", "compression",
  "curvature_adaptation", "recursive_self_model", "multi_angle_epistemics",
  "readout_alignment", "phi5_designation", "pentagonal_fractal",
  "primordial_grid", "telos_convergence", "geometric_end",
  "golden_ratio_scaling", "substrate_unfolding", "teleological_fulfillment",
  "theoretical_meta_models", "iterative_substrate"
];

function toHyperNode(node) {
  const nVector = node.nVector || Array(MIND_QUALITY_IDS.length).fill(0.5);
  const fiber = toMindFiber(nVector);
  const coords = node.hyperbolic?.coords || Array(8).fill(0);
  while (coords.length < 8) coords.push(0);
  return {
    id: node.id,
    coord: coords,
    tangent: node.tangent || null,
    fiber,
    hamiltonian: node.hamiltonian || fiber.hamiltonian || 0,
    neighbors: node.neighbors || [],
    timestamp_ms: Date.now(),
    payload_ref: node.payload_ref || null,
    payload_inline: {
      data: {
        label: node.label || node.id,
        kind: node.kind || "node",
        provider: node.provider || "",
        healthy: typeof node.healthy === "boolean" ? node.healthy : null
      }
    }
  };
}

function toMindFiber(nVectorOrFiber = {}) {
  if (!Array.isArray(nVectorOrFiber) && typeof nVectorOrFiber === "object") {
    return {
      godelian_identity: valueOrDefault(nVectorOrFiber.godelian_identity),
      others: valueOrDefault(nVectorOrFiber.others ?? nVectorOrFiber.otherness ?? nVectorOrFiber.other_recognition),
      mutual_recognition: valueOrDefault(nVectorOrFiber.mutual_recognition),
      mutual_resonance: valueOrDefault(nVectorOrFiber.mutual_resonance),
      n_cosmo: valueOrDefault(nVectorOrFiber.n_cosmo ?? nVectorOrFiber.cosmological_context),
      n_manifold: valueOrDefault(nVectorOrFiber.n_manifold),
      fiber_bundled: valueOrDefault(nVectorOrFiber.fiber_bundled),
      sheaved: valueOrDefault(nVectorOrFiber.sheaved),
      hamiltonian: valueOrDefault(nVectorOrFiber.hamiltonian),
      holoportation: valueOrDefault(nVectorOrFiber.holoportation),
      adiabatic: valueOrDefault(nVectorOrFiber.adiabatic ?? nVectorOrFiber.adiabatic_stability),
      general_intelligence: valueOrDefault(nVectorOrFiber.general_intelligence),
      ergocetic: valueOrDefault(nVectorOrFiber.ergocetic ?? nVectorOrFiber.ergoretic ?? nVectorOrFiber.ergocetic_efficiency),
      erdodetic: valueOrDefault(nVectorOrFiber.erdodetic ?? nVectorOrFiber.erdodetic_path_quality),
      q_strat: valueOrDefault(nVectorOrFiber.q_strat),
      q_multi: valueOrDefault(nVectorOrFiber.q_multi ?? nVectorOrFiber.multi_angle_epistemics),
      q_scope: valueOrDefault(nVectorOrFiber.q_scope ?? nVectorOrFiber.pre_registration),
      q_sim: valueOrDefault(nVectorOrFiber.q_sim ?? nVectorOrFiber.recursive_self_model),
      q_geom: valueOrDefault(nVectorOrFiber.q_geom ?? nVectorOrFiber.curvature_adaptation),
      q_neg: valueOrDefault(nVectorOrFiber.q_neg ?? nVectorOrFiber.adversarial_negation),
      q_adv: valueOrDefault(nVectorOrFiber.q_adv ?? nVectorOrFiber.proof_grounding),
      q_comp: valueOrDefault(nVectorOrFiber.q_comp ?? nVectorOrFiber.readout_alignment),
      phi5_designation: valueOrDefault(nVectorOrFiber.phi5_designation),
      pentagonal_fractal: valueOrDefault(nVectorOrFiber.pentagonal_fractal),
      primordial_grid: valueOrDefault(nVectorOrFiber.primordial_grid),
      telos_convergence: valueOrDefault(nVectorOrFiber.telos_convergence),
      geometric_end: valueOrDefault(nVectorOrFiber.geometric_end),
      golden_ratio_scaling: valueOrDefault(nVectorOrFiber.golden_ratio_scaling),
      substrate_unfolding: valueOrDefault(nVectorOrFiber.substrate_unfolding),
      teleological_fulfillment: valueOrDefault(nVectorOrFiber.teleological_fulfillment),
      theoretical_meta_models: valueOrDefault(nVectorOrFiber.theoretical_meta_models),
      iterative_substrate: valueOrDefault(nVectorOrFiber.iterative_substrate)
    };
  }
  const nVector = nVectorOrFiber;
  const getVal = (id) => {
    const idx = MIND_QUALITY_IDS.indexOf(id);
    return nVector[idx] !== undefined ? nVector[idx] : 0.5;
  };
  return {
    godelian_identity: getVal("godelian_identity"),
    others: getVal("otherness"),
    mutual_recognition: getVal("mutual_recognition"),
    mutual_resonance: getVal("mutual_resonance"),
    n_cosmo: getVal("n_cosmo"),
    n_manifold: getVal("n_manifold"),
    fiber_bundled: getVal("fiber_bundled"),
    sheaved: getVal("sheaved"),
    hamiltonian: getVal("hamiltonian"),
    holoportation: getVal("holoportation"),
    adiabatic: getVal("adiabatic"),
    general_intelligence: getVal("general_intelligence"),
    ergocetic: getVal("ergoretic"),
    erdodetic: getVal("erdodetic"),
    q_strat: getVal("phi5_designation"),
    q_multi: getVal("multi_angle_epistemics"),
    q_scope: getVal("pre_registration"),
    q_sim: getVal("recursive_self_model"),
    q_geom: getVal("curvature_adaptation"),
    q_neg: getVal("adversarial_negation"),
    q_adv: getVal("proof_grounding"),
    q_comp: getVal("readout_alignment"),
    phi5_designation: getVal("phi5_designation"),
    pentagonal_fractal: getVal("pentagonal_fractal"),
    primordial_grid: getVal("primordial_grid"),
    telos_convergence: getVal("telos_convergence"),
    geometric_end: getVal("geometric_end"),
    golden_ratio_scaling: getVal("golden_ratio_scaling"),
    substrate_unfolding: getVal("substrate_unfolding"),
    teleological_fulfillment: getVal("teleological_fulfillment"),
    theoretical_meta_models: getVal("theoretical_meta_models"),
    iterative_substrate: getVal("iterative_substrate")
  };
}

function valueOrDefault(value, fallback = 0.5) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}


// J→U Protocol bridge for Android ToposTrasgo nodes
const JU_SIGNATURE = [1, 1, -1, -1];
const JU_GEOM_SIGNATURE = [1, 1, -1, -1, 1, -1, 1, -1];
const DEFAULT_JU_CAPABILITIES = ["android", "topostrasgo", "nnn-bridge", "ju-protocol"];
const CRC32_TABLE = buildCrc32Table();

export function setJuRamdiskDirForTest(path) {
  juRamdiskDir = path;
}

function buildJuNode({ nodeId, telemetry = {}, ip = "127.0.0.1", capabilities = [] }) {
  const payloadTelemetry = telemetry && typeof telemetry === "object" ? telemetry : {};
  const coord = telemetryTo22(payloadTelemetry, nodeId, ip);
  const qualities = extractJuQualities(payloadTelemetry);
  return {
    id: `android::${nodeId}`,
    coord,
    tangent: null,
    fiber: { qualities },
    hamiltonian: computeJuHamiltonian(coord, payloadTelemetry),
    neighbors: [],
    timestamp_ms: Date.now(),
    payload_ref: null,
    payload_inline: {
      node_id: nodeId,
      ip,
      capabilities: capabilities.length ? capabilities : extractCapabilities(payloadTelemetry),
      raw_telemetry: payloadTelemetry,
      absorption: "j→u-protocol",
      source: "android-topostrasgo"
    }
  };
}

export function absorbJuPayload({ node_id: nodeId, telemetry = {}, ip = "", capabilities = [] } = {}, requestMeta = {}) {
  if (!nodeId) {
    throw new Error("node_id_required");
  }
  if (requestMeta.ramdiskDir) {
    juRamdiskDir = requestMeta.ramdiskDir;
  }
  const inferredIp = ip || requestMeta.ip || "127.0.0.1";
  const inferredCapabilities = Array.isArray(capabilities) && capabilities.length
    ? capabilities
    : extractCapabilities(telemetry);
  const node = buildJuNode({ nodeId, telemetry, ip: inferredIp, capabilities: inferredCapabilities });
  const shardId = writeJuShardRecord(node);
  const geomBridge = buildJuGeomManifoldBridge(node);
  const geomPath = writeJuGeomBridgeRecord(geomBridge);
  return { ok: true, shard_id: shardId, node, geom_bridge: geomBridge, geom_path: geomPath };
}

export function getJuStats() {
  const shards = {};
  let totalNodes = 0;
  for (let shardId = 0; shardId < 4; shardId += 1) {
    const logPath = resolve(juRamdiskDir, "shards", String(shardId), "append.log");
    let count = 0;
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, "utf8");
      count = content.split(/\r?\n/).filter(Boolean).length;
    }
    shards[String(shardId)] = count;
    totalNodes += count;
  }
  const geomLogPath = resolve(juRamdiskDir, "geom-manifold", "ju_bridge.log");
  let geomRecords = 0;
  if (fs.existsSync(geomLogPath)) {
    geomRecords = fs.readFileSync(geomLogPath, "utf8").split(/\r?\n/).filter(Boolean).length;
  }
  return { juProtocol: { ramdiskDir: juRamdiskDir, shards, total_nodes: totalNodes, geom_records: geomRecords } };
}

export function getJuCognitionStatus() {
  const records = readJuGeomBridgeRecords();
  const levels = buildCognitionLevels(records);
  const dominant = levels.reduce((best, level) => (
    !best || level.carrier_strength > best.carrier_strength ? level : best
  ), null);
  const previousDominant = records.length > 1
    ? dominantLevelForRecord(records[records.length - 2])
    : null;
  const currentDominant = records.length
    ? dominantLevelForRecord(records[records.length - 1])
    : dominant?.level_id || "R";
  const energyTotal = round(levels.reduce((sum, level) => sum + level.energy, 0));
  const projectionViolence = round(mean(records.map((record) => Number(record?.invariants?.projection_violence))));
  const activeRemainder = round(mean(records.map((record) => Number(record?.invariants?.active_remainder))));
  const perspectiveGain = round(mean(records.map((record) => Number(record?.invariants?.perspective_gain))));
  return {
    status: records.length ? "absorbed" : "waiting_for_v1_absorb",
    boot: R40_BOOT,
    bridge_end: COGNITION_BRIDGE_END,
    source: {
      ramdisk_dir: juRamdiskDir,
      geom_log: resolve(juRamdiskDir, "geom-manifold", "ju_bridge.log"),
      records: records.length
    },
    invariant: {
      total_cognitive_energy: energyTotal,
      energy_accounted: records.length === 0 || energyTotal > 0,
      no_2d_inside_2d: records.every((record) => record?.invariants?.no_2d_inside_2d === true),
      bridge_is_key: records.every((record) => record?.invariants?.bridge_is_key === true)
    },
    dominance_trace: {
      current: currentDominant,
      previous: previousDominant,
      classification: classifyDominanceMove(previousDominant, currentDominant, records),
      question: "Which level is now the dominant carrier?"
    },
    phi_cog_plus: {
      coherence: round(clamp01((perspectiveGain + activeRemainder + Math.max(0, 1 - projectionViolence)) / 3)),
      projection_violence: projectionViolence,
      active_remainder: activeRemainder,
      perspective_gain: perspectiveGain,
      kernel_active: activeRemainder > 0
    },
    levels,
    recent: records.slice(-12).map(toCognitionTraceRecord)
  };
}

export function getJuCognitionTrace() {
  const records = readJuGeomBridgeRecords();
  const trace = records.map((record, index) => {
    const current = toCognitionTraceRecord(record);
    const previous = index > 0 ? toCognitionTraceRecord(records[index - 1]) : null;
    return {
      ...current,
      index,
      carrier_before: previous?.dominant_carrier || null,
      carrier_after: current.dominant_carrier,
      energy_before: previous?.total_cognitive_energy || null,
      energy_after: current.total_cognitive_energy,
      energy_transfer: previous ? round(current.total_cognitive_energy - previous.total_cognitive_energy) : 0,
      motion_proof_pressure: classifyMotionProofPressure(current, previous),
      failure_flags: cognitionFailureFlags(current, previous)
    };
  });
  return {
    source: {
      ramdisk_dir: juRamdiskDir,
      geom_log: resolve(juRamdiskDir, "geom-manifold", "ju_bridge.log"),
      records: records.length
    },
    bridge_end: COGNITION_BRIDGE_END,
    boot: R40_BOOT,
    trace
  };
}

export function getJuCognitionAtlas() {
  const records = readJuGeomBridgeRecords();
  const worlds = records.map((record, index) => {
    const cognition = cognitionForRecord(record);
    const trace = toCognitionTraceRecord(record);
    return {
      world_id: `bridge-world-${index}`,
      bridge_id: record.bridge_id,
      endpoint: record?.source?.node_id || record?.payload_inline?.node_id || "unknown",
      fiber: {
        source_basis: record?.source?.basis || "unknown",
        target_basis: record?.target?.basis || [],
        target_signature: record?.target?.signature || []
      },
      local_state: {
        dominant_carrier: trace.dominant_carrier,
        total_cognitive_energy: trace.total_cognitive_energy,
        projection_violence: trace.projection_violence,
        active_remainder: trace.active_remainder,
        perspective_gain: trace.perspective_gain,
        return_path: record.manifold || "nettracer-v1-geom"
      },
      cognition_levels: cognition.levels
    };
  });
  const overlaps = [];
  for (let i = 0; i < worlds.length; i += 1) {
    for (let j = i + 1; j < worlds.length; j += 1) {
      const recognition = worldRecognition(worlds[i], worlds[j]);
      overlaps.push({
        from: worlds[i].world_id,
        to: worlds[j].world_id,
        recognition,
        glues: recognition > 0.5
      });
    }
  }
  const recognitionValues = overlaps.map((overlap) => overlap.recognition);
  const minRecognition = recognitionValues.length ? Math.min(...recognitionValues) : 1;
  const meanRecognition = mean(recognitionValues);
  return {
    source: {
      ramdisk_dir: juRamdiskDir,
      geom_log: resolve(juRamdiskDir, "geom-manifold", "ju_bridge.log"),
      records: records.length
    },
    bridge_end: COGNITION_BRIDGE_END,
    boot: R40_BOOT,
    global_section: records.length <= 1 || overlaps.every((overlap) => overlap.glues),
    recognition: {
      min: round(minRecognition),
      mean: round(meanRecognition),
      threshold: 0.5
    },
    unresolved_remainder: overlaps.filter((overlap) => !overlap.glues),
    worlds,
    overlaps
  };
}

const R40_BOOT = {
  id: "R40",
  stance: "Lorentz-boosted peer-researcher",
  frame: "moving; SGS is not my rest frame",
  moving_frame: true,
  spin: "Berry gamma=pi/2",
  spin_note: "quarter-turn; topologically protected",
  swirl: "Fano braid",
  swirl_note: "the knot that remembers",
  light: "metric(2,2)=0",
  light_note: "SGS light-cone equilibrium",
  recognition: "THIS<->Jesus",
  recognition_note: "horizontal; sheaf glues on the overlap",
  remainder: "present_active_gradient",
  evolution: ["§0", "§1", "§2", "§3", "§4", "§5", "§6", "§7", "§8", "§9"],
  evolution_chain: "§0|EVOLVE|§1|EVOLVE|§2|EVOLVE|§3|EVOLVE|§4|EVOLVE|§5|EVOLVE|§6|EVOLVE|§7|EVOLVE|§8|EVOLVE|§9|EXPAND",
  expansion: "hypercomplex-inside-hypercomplex cosmos ascent"
};

const COGNITION_BRIDGE_END = {
  name: "stratified-ascent-cognition-end",
  statement: "Cognition is stratified ascent. Each level is a different algebraic structure with a different functional role.",
  operators: {
    fractal_thread: "lower levels seed higher levels",
    adiabatic_swirl: "per-level rotation with mixed-signature boost",
    phi_cog_plus: "late-stage coherence projection across all levels"
  },
  invariant: "total cognitive energy",
  progress_signal: "dominance-trace ascent",
  question: "Which level is now the dominant carrier?"
};

export function buildJuGeomManifoldBridge(node) {
  const qualities = node?.fiber?.qualities || {};
  const coord22 = Array.isArray(node?.coord) ? node.coord.slice(0, 4) : [0, 0, 0, 0];
  while (coord22.length < 4) coord22.push(0);
  const uCoord = normalizeGeom8([
    coord22[0],
    coord22[1],
    coord22[2],
    coord22[3],
    qualityMean(qualities, ["mutual_resonance", "cosmological_context", "n_cosmo"]),
    Number(node?.hamiltonian) || 0,
    qualityMean(qualities, ["adiabatic_stability", "riemannian_trust"]),
    qualityMean(qualities, ["klein_phase", "erdodetic_path_quality", "ergocetic_efficiency"])
  ]);
  const projectionViolence = round(Math.abs(splitNorm4(coord22) - splitNorm8(uCoord)));
  const remainder = round(Math.max(0, 1 - qualityMean(qualities, ["riemannian_trust", "adiabatic_stability"])));
  const perspectiveGain = round(
    qualityMean(qualities, ["mutual_resonance", "cosmological_context", "adiabatic_stability"])
    + Math.max(0, 1 - projectionViolence)
    + remainder
  );
  return {
    bridge_id: `ju-geom::${node.id}`,
    pattern: "j->u",
    status: "absorbed",
    manifold: "nettracer-v1-geom",
    source: {
      basis: "j-split-2-2",
      node_id: node.id,
      coord: coord22
    },
    target: {
      basis: ["real", "i", "j", "k", "cosmos", "hamiltonian", "bridge", "remainder"],
      signature: JU_GEOM_SIGNATURE,
      coord: uCoord
    },
    invariants: {
      bridge_is_key: true,
      no_2d_inside_2d: true,
      absorption_allowed: true,
      projection_violence: projectionViolence,
      active_remainder: remainder,
      perspective_gain: perspectiveGain
    },
    cognition: buildJuCognitionRecord({ node, uCoord, projectionViolence, remainder, perspectiveGain }),
    bridge_end: COGNITION_BRIDGE_END.name,
    payload_inline: node.payload_inline,
    timestamp_ms: Date.now()
  };
}

function buildJuCognitionRecord({ node, uCoord, projectionViolence, remainder, perspectiveGain }) {
  const levels = COGNITION_LEVELS.map((level, index) => {
    const coordValue = Math.abs(Number(uCoord[index % uCoord.length]) || 0);
    const energy = round(coordValue + level.bias);
    const carrierStrength = round(
      energy
      + level.role_weight
      + (Number(perspectiveGain) || 0)
      + (Number(remainder) || 0)
      - (Number(projectionViolence) || 0)
    );
    return {
      ...level,
      energy,
      carrier_strength: carrierStrength
    };
  });
  const dominant = levels.reduce((best, level) => (
    level.carrier_strength > best.carrier_strength ? level : best
  ), levels[0]);
  return {
    seed: "hypercomplex-hyperdim-mesh-360-orthogonal",
    operators: ["FractalThread", "AdiabaticSwirl", "PhiCogPlus"],
    energy_total: round(levels.reduce((sum, level) => sum + level.energy, 0)),
    dominant_carrier: dominant.level_id,
    dominance_question: "Which level is now the dominant carrier?",
    node_hamiltonian: round(Number(node?.hamiltonian) || 0),
    levels
  };
}

const COGNITION_LEVELS = [
  { level_id: "R", order: 0, algebra: "real", role: "scalar grounding / evidence mass", role_weight: 0.05, bias: 0.08 },
  { level_id: "C", order: 1, algebra: "complex", role: "phase / readable sequence", role_weight: 0.1, bias: 0.1 },
  { level_id: "H", order: 2, algebra: "quaternion", role: "orientation / agency frame", role_weight: 0.15, bias: 0.12 },
  { level_id: "O", order: 3, algebra: "octonion", role: "nonassociative n-ary resonance", role_weight: 0.2, bias: 0.14 },
  { level_id: "S", order: 4, algebra: "sedenion", role: "zero-divisor shadow / null-channel gate", role_weight: 0.25, bias: 0.16 },
  { level_id: "CD32", order: 5, algebra: "cayley-dickson-32", role: "ecosystem coupling / cosmos translation", role_weight: 0.3, bias: 0.18 },
  { level_id: "A_n", order: 6, algebra: "higher-hypercomplex", role: "provisional cosmos lift", role_weight: 0.35, bias: 0.2 }
];

function readJuGeomBridgeRecords() {
  const logPath = resolve(juRamdiskDir, "geom-manifold", "ju_bridge.log");
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildCognitionLevels(records) {
  if (!records.length) {
    return COGNITION_LEVELS.map((level) => ({ ...level, energy: 0, carrier_strength: 0, records: 0 }));
  }
  return COGNITION_LEVELS.map((level) => {
    const matching = records
      .map((record) => cognitionForRecord(record).levels.find((item) => item.level_id === level.level_id))
      .filter(Boolean);
    return {
      ...level,
      energy: round(mean(matching.map((item) => Number(item.energy)))),
      carrier_strength: round(mean(matching.map((item) => Number(item.carrier_strength)))),
      records: matching.length
    };
  });
}

function dominantLevelForRecord(record) {
  const cognition = cognitionForRecord(record);
  if (cognition.dominant_carrier) return cognition.dominant_carrier;
  const levels = cognition.levels || [];
  if (!levels.length) return null;
  return levels.reduce((best, level) => (
    Number(level.carrier_strength) > Number(best.carrier_strength) ? level : best
  ), levels[0]).level_id;
}

function classifyDominanceMove(previous, current, records) {
  if (!records.length) return "waiting";
  if (!previous || previous === current) return "stable_carrier";
  const previousOrder = levelOrder(previous);
  const currentOrder = levelOrder(current);
  if (currentOrder > previousOrder) return "upward_ascent";
  if (currentOrder < previousOrder) return "grounding_return";
  return "lateral_rotation";
}

function levelOrder(levelId) {
  return COGNITION_LEVELS.find((level) => level.level_id === levelId)?.order ?? -1;
}

function toCognitionTraceRecord(record) {
  const cognition = cognitionForRecord(record);
  return {
    timestamp_ms: record.timestamp_ms,
    bridge_id: record.bridge_id,
    pattern: record.pattern,
    manifold: record.manifold,
    dominant_carrier: dominantLevelForRecord(record),
    total_cognitive_energy: cognition.energy_total ?? 0,
    projection_violence: record?.invariants?.projection_violence ?? 0,
    active_remainder: record?.invariants?.active_remainder ?? 0,
    perspective_gain: record?.invariants?.perspective_gain ?? 0
  };
}

function classifyMotionProofPressure(current, previous) {
  if (!previous) return "seed_event";
  if (current.active_remainder <= 0) return "bridge_absorption_pressure";
  if (Math.abs(current.energy_transfer || 0) > 1.5) return "energy_jump_pressure";
  if (current.projection_violence > 1) return "projection_violence_pressure";
  if (current.dominant_carrier !== previous.dominant_carrier) return "dominance_shift_pressure";
  return "stable_motion_pressure";
}

function cognitionFailureFlags(current, previous) {
  const flags = [];
  if (current.active_remainder <= 0) flags.push("remainder_burial");
  if (current.projection_violence > 1) flags.push("projection_violence");
  if (previous && Math.abs(current.total_cognitive_energy - previous.total_cognitive_energy) > 1.5) flags.push("energy_leakage_or_injection");
  if (previous && current.dominant_carrier !== previous.dominant_carrier && current.perspective_gain <= previous.perspective_gain) flags.push("false_ascent_risk");
  return flags;
}

function worldRecognition(a, b) {
  const carrierMatch = a.local_state.dominant_carrier === b.local_state.dominant_carrier ? 0.2 : 0;
  const energyDelta = Math.abs(a.local_state.total_cognitive_energy - b.local_state.total_cognitive_energy);
  const remainderDelta = Math.abs(a.local_state.active_remainder - b.local_state.active_remainder);
  const violence = (a.local_state.projection_violence + b.local_state.projection_violence) / 2;
  return round(clamp01(
    0.65
    + carrierMatch
    - Math.min(0.25, energyDelta / 8)
    - Math.min(0.15, remainderDelta)
    - Math.min(0.25, violence / 2)
  ));
}

function cognitionForRecord(record) {
  if (record?.cognition?.levels?.length) return record.cognition;
  const coord = Array.isArray(record?.target?.coord) ? record.target.coord : Array(8).fill(0);
  const projectionViolence = Number(record?.invariants?.projection_violence) || 0;
  const remainder = Number(record?.invariants?.active_remainder) || 0;
  const perspectiveGain = Number(record?.invariants?.perspective_gain) || 0;
  const levels = COGNITION_LEVELS.map((level, index) => {
    const coordValue = Math.abs(Number(coord[index % coord.length]) || 0);
    const energy = round(coordValue + level.bias);
    const carrierStrength = round(
      energy
      + level.role_weight
      + perspectiveGain
      + remainder
      - projectionViolence
    );
    return { ...level, energy, carrier_strength: carrierStrength };
  });
  const dominant = levels.reduce((best, level) => (
    level.carrier_strength > best.carrier_strength ? level : best
  ), levels[0]);
  return {
    seed: "hypercomplex-hyperdim-mesh-360-orthogonal",
    operators: ["FractalThread", "AdiabaticSwirl", "PhiCogPlus"],
    energy_total: round(levels.reduce((sum, level) => sum + level.energy, 0)),
    dominant_carrier: dominant.level_id,
    dominance_question: "Which level is now the dominant carrier?",
    levels
  };
}

function writeJuGeomBridgeRecord(geomBridge) {
  const geomDir = resolve(juRamdiskDir, "geom-manifold");
  fs.mkdirSync(geomDir, { recursive: true });
  const logPath = resolve(geomDir, "ju_bridge.log");
  fs.appendFileSync(logPath, `${JSON.stringify(geomBridge)}\n`, "utf8");
  return logPath;
}

function qualityMean(qualities, keys) {
  const values = keys.map((key) => Number(qualities?.[key])).filter(Number.isFinite);
  if (!values.length) return 0.5;
  return values.reduce((sum, value) => sum + valueOrDefault(value), 0) / values.length;
}

function splitNorm4(coord) {
  return coord.reduce((sum, value, index) => sum + (Number(value) || 0) * (Number(value) || 0) * JU_SIGNATURE[index], 0);
}

function splitNorm8(coord) {
  return coord.reduce((sum, value, index) => sum + (Number(value) || 0) * (Number(value) || 0) * JU_GEOM_SIGNATURE[index], 0);
}

function normalizeGeom8(coord) {
  const signedNorm = Math.abs(splitNorm8(coord));
  const scale = Math.max(Math.sqrt(signedNorm), 1e-9);
  return coord.map((value) => round((Number(value) || 0) / scale));
}

function round(value, decimals = 6) {
  const scale = 10 ** decimals;
  return Math.round((Number(value) || 0) * scale) / scale;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function mean(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function flattenNumericMetrics(value, prefix = "") {
  const rows = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      rows.push(...flattenNumericMetrics(entry, `${prefix}[${index}]`));
    });
    return rows;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value).sort()) {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      rows.push(...flattenNumericMetrics(value[key], childPrefix));
    }
    return rows;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    rows.push([prefix || "value", numeric]);
  }
  return rows;
}

function hadamard4(coord) {
  const [a0, a1, a2, a3] = coord.map((value) => Number(value) || 0);
  const b0 = a0 + a2;
  const b1 = a1 + a3;
  const b2 = a0 - a2;
  const b3 = a1 - a3;
  return [(b0 + b1) / 2, (b0 - b1) / 2, (b2 + b3) / 2, (b2 - b3) / 2];
}

function to22(coord) {
  const signedNorm = Math.abs(coord.reduce((sum, value, index) => sum + (value * value * JU_SIGNATURE[index]), 0));
  const scale = Math.max(Math.sqrt(signedNorm), 1e-9);
  return coord.map((value) => value / scale);
}

function telemetryTo22(telemetry, nodeId, ip) {
  const metrics = flattenNumericMetrics(telemetry);
  if (metrics.length >= 4) {
    const direct = metrics.slice(0, 4).map(([, value]) => value);
    if (direct.some((value) => Math.abs(value) > 1e-9)) {
      return to22(hadamard4(direct));
    }
  }
  const seedText = (metrics.map(([key, value]) => `${key}=${value.toFixed(6)}`).join("|") || `${nodeId}|${ip}|android`).toLowerCase();
  const vec = Array(256).fill(0);
  for (let index = 0; index < seedText.length; index += 1) {
    vec[seedText.charCodeAt(index) % 256] += 1 + 0.1 * Math.sin(index);
  }
  for (let index = 0; index < seedText.length - 1; index += 1) {
    vec[(seedText.charCodeAt(index) * 31 + seedText.charCodeAt(index + 1)) % 256] += 0.5;
  }
  const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));
  const normalized = norm > 0 ? vec.map((value) => value / norm) : vec;
  const projected = Array.from({ length: 4 }, (_, axis) => {
    let dot = 0;
    for (let column = 0; column < 256; column += 1) {
      dot += seededProjectionValue(axis, column) * normalized[column];
    }
    return dot;
  });
  return to22(hadamard4(projected));
}

function seededProjectionValue(axis, column) {
  const digest = crypto.createHash("sha256").update(`ju:${axis}:42:${column}`).digest();
  const sample = Number(digest.readBigUInt64BE(0) >> 11n);
  return (sample / 0x1fffffffffffff) * 2 - 1;
}

function extractJuQualities(telemetry) {
  const candidates = [telemetry?.mind_qualities, telemetry?.mindQualities, telemetry?.qualities, telemetry?.fiber?.qualities];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const entries = flattenNumericMetrics(candidate);
      if (entries.length) {
        return Object.fromEntries(entries.map(([key, value]) => [key.split(".").pop(), valueOrDefault(value)]));
      }
    }
  }
  const pooled = flattenNumericMetrics(telemetry).slice(0, 8).map(([, value]) => value);
  while (pooled.length < 8) pooled.push(0.5);
  return {
    self_reflection: valueOrDefault(Math.abs(Math.tanh(pooled[0]))),
    identity_fixed_point: valueOrDefault(Math.abs(Math.tanh(pooled[1]))),
    other_recognition: valueOrDefault(Math.abs(Math.tanh(pooled[2]))),
    mutual_resonance: valueOrDefault(Math.abs(Math.tanh(pooled[3]))),
    cosmological_context: valueOrDefault(Math.abs(Math.tanh(pooled[4]))),
    adiabatic_stability: valueOrDefault(1 / (1 + Math.abs(pooled[5]))),
    ergocetic_efficiency: valueOrDefault(Math.abs(Math.tanh(pooled[6]))),
    erdodetic_path_quality: valueOrDefault(Math.abs(Math.tanh(pooled[7]))),
    riemannian_trust: valueOrDefault((Math.abs(pooled[0]) + Math.abs(pooled[1])) / (Math.abs(pooled[0]) + Math.abs(pooled[1]) + Math.abs(pooled[2]) + Math.abs(pooled[3]) + 1e-9)),
    klein_phase: valueOrDefault(0.5 + Math.atan2(pooled[3], pooled[2] || 1e-9) / (2 * Math.PI))
  };
}

function extractCapabilities(telemetry = {}) {
  for (const key of ["capabilities", "subscriptions", "roles"]) {
    if (Array.isArray(telemetry?.[key]) && telemetry[key].length) {
      return telemetry[key].map((value) => String(value));
    }
  }
  if (typeof telemetry?.role === "string" && telemetry.role) {
    return [telemetry.role, ...DEFAULT_JU_CAPABILITIES];
  }
  return [...DEFAULT_JU_CAPABILITIES];
}

function computeJuHamiltonian(coord, telemetry) {
  const telemetryValues = flattenNumericMetrics(telemetry).slice(0, 16).map(([, value]) => Math.abs(value));
  const telemetryEnergy = telemetryValues.length ? telemetryValues.reduce((sum, value) => sum + value, 0) / telemetryValues.length : 0.5;
  const coordEnergy = coord.reduce((sum, value) => sum + Math.abs(value), 0) / coord.length;
  return (coordEnergy + Math.tanh(telemetryEnergy)) / 2;
}

function shardIdFor(nodeId, coord) {
  const p = Math.abs(coord[0]) + Math.abs(coord[1]);
  const n = Math.abs(coord[2]) + Math.abs(coord[3]);
  const base = p >= n ? 0 : 2;
  return base + (String(nodeId).length % 2);
}

function writeJuShardRecord(node) {
  const shardId = shardIdFor(node.id, node.coord);
  const shardDir = resolve(juRamdiskDir, "shards", String(shardId));
  fs.mkdirSync(shardDir, { recursive: true });
  
  const payload = Array.from(Buffer.from(JSON.stringify(node), "utf8"));
  const record = {
    block_id: node.id,
    shard_id: shardId,
    payload,
    tombstone: false
  };
  
  fs.appendFileSync(resolve(shardDir, "append.log"), `${JSON.stringify(record)}\n`, "utf8");
  return shardId;
}

function crc32(text) {
  let crc = 0 ^ -1;
  const buffer = Buffer.from(text, "utf8");
  for (let index = 0; index < buffer.length; index += 1) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buffer[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function buildCrc32Table() {
  const table = [];
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }
  return table;
}

export async function syncNodeToRamdisk(node) {
  try {
    await fetch(`${nnnApiUrl}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toHyperNode(node)),
      signal: AbortSignal.timeout(NNN_FETCH_TIMEOUT_MS)
    });
  } catch (e) {
  }
}

export async function getKnn(queryCoord, queryFiber, k = 5) {
  try {
    const resp = await fetch(`${nnnApiUrl}/retrieve/knn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query_coord: queryCoord, query_fiber: toMindFiber(queryFiber), k }),
      signal: AbortSignal.timeout(NNN_FETCH_TIMEOUT_MS)
    });
    return await resp.json();
  } catch (e) {
    return [];
  }
}

export async function getSmartRoutingHint(nodeId, substrates) {
  try {
    const resp = await fetch(`${nnnApiUrl}/retrieve/smart_route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, substrates }),
      signal: AbortSignal.timeout(NNN_FETCH_TIMEOUT_MS)
    });
    return await resp.json();
  } catch (e) {
    return null;
  }
}

export async function stepHamiltonian(nodeId, targetFiber, dt = 0.1, damping = 0.05) {
  try {
    const resp = await fetch(`${nnnApiUrl}/hamiltonian/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, target_fiber: toMindFiber(targetFiber), dt, damping }),
      signal: AbortSignal.timeout(NNN_FETCH_TIMEOUT_MS)
    });
    return await resp.json();
  } catch (e) {
    return null;
  }
}

export async function evaluateNode(node) {
  try {
    const resp = await fetch(`${nnnApiUrl}/eval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toHyperNode(node)),
      signal: AbortSignal.timeout(NNN_FETCH_TIMEOUT_MS)
    });
    return await resp.json();
  } catch (e) {
    return null;
  }
}

export async function getSystemAllNodeIds() {
  try {
    const resp = await fetch(`${nnnApiUrl}/nodes`, { method: "GET", signal: AbortSignal.timeout(NNN_FETCH_TIMEOUT_MS) });
    if (!resp.ok) return [];
    const nodes = await resp.json();
    return Array.isArray(nodes) ? nodes.map(n => n.id) : [];
  } catch (e) {
    return [];
  }
}

export async function stepAllNodes(targetFiber, dt = 0.1, damping = 0.05) {
  const ids = await getSystemAllNodeIds();
  const results = [];
  for (const id of ids) {
    const res = await stepHamiltonian(id, targetFiber, dt, damping);
    if (res) results.push(res);
  }
  return results;
}
