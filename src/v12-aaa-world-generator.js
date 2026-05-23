import { buildV11ActiveCognitionInstrument } from "./v11-active-cognition-instrument.js";

const BIOMES = {
  R: ["oxide meadow", "basalt witness", "rain archive"],
  C: ["glass delta", "signal bazaar", "neon mycelium"],
  H: ["ember archive", "mantle grove", "thermal citadel"],
  O: ["orto reef", "blue lattice", "spectral harbor"],
  A_n: ["cosmos tower", "polyfold steppe", "cultural crown"],
  meaning: ["persona field", "memory rain", "semantic orchard"],
  traffic: ["packet storm", "relay marsh", "bridge port"]
};

export function buildV12AaaWorldGenerator({
  traffic = [],
  topology = null,
  meshCount = 7,
  seed = "spinner-hand-world"
} = {}) {
  const v11 = buildV11ActiveCognitionInstrument({ traffic, topology, meshCount });
  const generatorSeed = hashSeed(`${seed}:${v11.meaning_field.dominant_carrier}:${v11.meaning_field.total_cognitive_energy}`);
  const biome = chooseBiome(v11.meaning_field.dominant_carrier, generatorSeed);
  const terrain = buildTerrain(generatorSeed, v11);
  const life = buildLife(generatorSeed, v11, terrain);
  const culture = buildCulture(generatorSeed, v11, terrain);
  const cosmosTowers = buildCosmosTowers(generatorSeed, v11, terrain);
  const narrator = buildNarrator(v11, biome, terrain, life, culture);

  return {
    product: "netracer-v12-aaa-world-generator",
    mode: "first_person_open_world_generator_from_hypercomplex_cognition",
    inherits: v11.product,
    writes: [],
    world_axiom: "spinner-hand generates terrain, life, culture, and cosmos towers from live hypercomplex meaning fields",
    generator_geometry: {
      not_2d: true,
      first_person_walker: true,
      world_generation_emerges_from_complexity: true,
      source_invariant: "total_cognitive_energy",
      dominant_carrier: v11.meaning_field.dominant_carrier,
      active_remainder: v11.meaning_field.active_remainder,
      phi_cog_plus: v11.meaning_field.phi_cog_plus
    },
    semantic_essence: {
      biome,
      growth: terrain.growth,
      strata: terrain.strata,
      morphologies: terrain.morphologies,
      spectral: terrain.spectral,
      coherence: v11.meaning_field.stability_index,
      active_remainder: v11.meaning_field.active_remainder,
      narrator_seed: narrator.current
    },
    walker: {
      spawn: [0, terrain.spawn_height + 2.2, 8],
      mode: "wasd_walk_mouse_look_shift_drift_c_free_camera",
      narrator: "semantic_world_witness",
      enter_rule: "click to enter pointer lock and walk the generated field"
    },
    terrain,
    life,
    culture,
    cosmos_towers: cosmosTowers,
    narrator,
    source_state: {
      v11,
      lab_traffic: v11.source_state.lab_traffic
    },
    launch: {
      infra: "V12",
      endpoint: "/api/v12/aaa-world-generator",
      view: "/v12/aaa-world-generator",
      compatible_port: 8790
    }
  };
}

function buildTerrain(seed, v11) {
  const size = 76;
  const scale = 2.6;
  const points = [];
  const dominant = carrierIndex(v11.meaning_field.dominant_carrier);
  const energy = v11.meaning_field.total_cognitive_energy;
  const remainder = v11.meaning_field.active_remainder;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const wx = (x - size / 2) * scale;
      const wz = (z - size / 2) * scale;
      const ridge = Math.sin(wx * 0.105 + seed * 0.0003) * Math.cos(wz * 0.095 - dominant);
      const fold = Math.sin((wx + wz) * 0.055 + dominant) * 0.9;
      const pulse = Math.cos(Math.hypot(wx, wz) * 0.055 - seed * 0.00007) * 1.8;
      const canyon = Math.sin(wx * 0.031 + dominant) * Math.sin(wz * 0.044 - seed * 0.00002);
      const height = round((ridge * 8.8 + fold * 6.7 + pulse * 2.6 + canyon * 7.5 + remainder * 8.5) * (0.92 + dominant * 0.045));
      const heat = clamp(0.48 + ridge * 0.22 + dominant * 0.035, 0, 1);
      const signal = clamp(0.4 + fold * 0.28 + energy * 0.0009, 0, 1);
      const culture = clamp(0.3 + pulse * 0.12 + v11.meaning_field.phi_cog_plus * 0.42, 0, 1);
      points.push({ x: round(wx), y: height, z: round(wz), heat: round(heat), signal: round(signal), culture: round(culture) });
    }
  }
  return {
    grid_size: size,
    scale,
    spawn_height: points[Math.floor(points.length / 2)].y,
    growth: round(1 + v11.meaning_field.phi_cog_plus * 5.4),
    strata: round(3 + dominant + v11.meaning_field.active_remainder * 4),
    morphologies: round(9 + dominant * 2 + v11.meaning_field.visible_fibers * 0.02),
    spectral: round(4 + v11.meaning_field.stability_index * 3),
    points
  };
}

function buildLife(seed, v11, terrain) {
  const count = Math.min(1800, Math.max(360, Math.round(terrain.morphologies * 78 + v11.meaning_field.visible_fibers * 1.4)));
  const life = [];
  for (let i = 0; i < count; i++) {
    const angle = noise(seed, i, 11) * Math.PI * 2;
    const radius = Math.sqrt(noise(seed, i, 17)) * terrain.grid_size * terrain.scale * 0.48;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = sampleHeight(terrain, x, z);
    life.push({
      id: `life:${i}`,
      kind: i % 7 === 0 ? "witness-orb" : i % 5 === 0 ? "culture-spark" : "mantle-grass",
      position: [round(x), round(y + 0.6 + noise(seed, i, 23) * 3.2), round(z)],
      scale: round(0.6 + noise(seed, i, 29) * 5.8),
      carrier: carrierFromNumber(i + carrierIndex(v11.meaning_field.dominant_carrier)),
      glow: round(0.35 + noise(seed, i, 31) * 0.65)
    });
  }
  return {
    count,
    species: ["mantle-grass", "witness-orb", "culture-spark"],
    entities: life
  };
}

function buildCulture(seed, v11, terrain) {
  const nodes = [];
  const count = 34 + carrierIndex(v11.meaning_field.dominant_carrier) * 4;
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2 + seed * 0.0001;
    const radius = 10 + noise(seed, i, 41) * 36;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    nodes.push({
      id: `culture:${i}`,
      name: cultureName(i, v11.meaning_field.dominant_carrier),
      position: [round(x), round(sampleHeight(terrain, x, z) + 1.4), round(z)],
      intensity: round(0.42 + noise(seed, i, 43) * 0.58)
    });
  }
  return {
    count,
    nodes
  };
}

function buildCosmosTowers(seed, v11, terrain) {
  return v11.behavioral_fibers.slice(0, 96).map((fiber, i) => {
    const angle = i / 96 * Math.PI * 2 + carrierIndex(fiber.carrier) * 0.33;
    const radius = 22 + (i % 12) * 8.2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return {
      id: `tower:${fiber.id}`,
      fiber_id: fiber.id,
      carrier: fiber.carrier,
      sign: fiber.sign,
      position: [round(x), round(sampleHeight(terrain, x, z) + 2), round(z)],
      height: round(12 + fiber.rank * 4.5 + fiber.stability * 18),
      narrative: `cosmos tower carries ${fiber.carrier} from ${fiber.mesh_id}`
    };
  });
}

function buildNarrator(v11, biome, terrain, life, culture) {
  const selected = v11.selected.available ? v11.selected : null;
  const current = `${biome} / ${v11.meaning_field.dominant_carrier} meadow / persona field`;
  return {
    current,
    beats: [
      `World-weaver axiom: spinner-hand generates terrain, life, culture, and cosmos towers.`,
      `Dominant carrier ${v11.meaning_field.dominant_carrier}; energy ${v11.meaning_field.total_cognitive_energy}; coherence ${v11.meaning_field.stability_index}.`,
      `Growth ${terrain.growth}; strata ${terrain.strata}; morphologies ${terrain.morphologies}; spectral ${terrain.spectral}.`,
      selected ? `${selected.seed_label} breathes through ${selected.mesh_id}; the selected fiber narrates ${selected.carrier}.` : "No fiber selected; the world narrates the full field.",
      `${life.count} life entities and ${culture.count} culture nodes emerge from the active remainder.`
    ],
    controls: "WASD walk, mouse look, Shift drift, C free camera, N narrator beat, Esc pointer unlock"
  };
}

function chooseBiome(carrier, seed) {
  const list = BIOMES[carrier] || BIOMES.A_n;
  return list[seed % list.length];
}

function sampleHeight(terrain, x, z) {
  const gx = Math.max(0, Math.min(terrain.grid_size - 1, Math.round(x / terrain.scale + terrain.grid_size / 2)));
  const gz = Math.max(0, Math.min(terrain.grid_size - 1, Math.round(z / terrain.scale + terrain.grid_size / 2)));
  return terrain.points[gz * terrain.grid_size + gx]?.y || 0;
}

function carrierIndex(carrier) {
  return Math.max(0, ["R", "C", "H", "O", "A_n", "meaning", "traffic"].indexOf(carrier));
}

function carrierFromNumber(value) {
  return ["R", "C", "H", "O", "A_n", "meaning", "traffic"][Math.abs(value) % 7];
}

function cultureName(index, carrier) {
  const names = ["Grove", "Herd", "Village", "Rain", "Archive", "Witness", "Mantle", "Port"];
  return `${names[index % names.length]} ${carrier}`;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const ch of String(value)) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function noise(seed, index, salt) {
  let x = (seed + index * 374761393 + salt * 668265263) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(6));
}
