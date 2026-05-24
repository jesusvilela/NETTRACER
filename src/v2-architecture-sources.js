const SOURCE_REGISTRY = [
  source("github:jesusvilela/NETTRACER", "NETTRACER", "github-repo", "private", "JavaScript", "https://github.com/jesusvilela/NETTRACER", "NETTRACER V3 object-mesh infrastructure", "telos_trace", "A_n", "root_telos", 1),
  source("github:jesusvilela/-lang.s1", "-lang.s1", "github-repo", "private", "Python", "https://github.com/jesusvilela/-lang.s1", "Section LANG specification for geometric translation, fibers, sheaf gluing, and IG transport.", "codec_translation", "C", "codec_adapter", 0.96),
  source("github:jesusvilela/nnn-hyperbolic-ramdisk_v2", "nnn-hyperbolic-ramdisk_v2", "github-repo", "private", "Python", "https://github.com/jesusvilela/nnn-hyperbolic-ramdisk_v2", "Commercial NNN hyperbolic ramdisk substrate candidate.", "capture_substrate", "A_n", "substrate_candidate", 0.95),
  source("github:jesusvilela/nnn-hyperbolic-ramdisk", "nnn-hyperbolic-ramdisk", "github-repo", "private", "Makefile", "https://github.com/jesusvilela/nnn-hyperbolic-ramdisk", "Four-shard RAM reservoir, split metric emulator, fiber state, Hamiltonian evolution, and holoport retrieval.", "capture_substrate", "H", "substrate_contract", 0.93),
  source("github:jesusvilela/TELOS", "TELOS", "github-repo", "private", "Python", "https://github.com/jesusvilela/TELOS", "Hyperdim hypercomplex hyperbolic hyprdrive NLP world brain.", "telos_engine", "A_n", "telos_engine", 0.92),
  source("github:jesusvilela/METACOG", "METACOG", "github-repo", "private", "Python", "https://github.com/jesusvilela/METACOG", "Metacognitive hyperdimensional repo protocol operators.", "metacognition", "O", "operator_pack", 0.89),
  source("github:jesusvilela/np-completeness-bunny-utai-study", "np-completeness-bunny-utai-study", "github-repo", "private", "Python", "https://github.com/jesusvilela/np-completeness-bunny-utai-study", "NP-Completeness Bunny UTAI Study with IGBundle_n and SO(2,2) hyperdim research.", "agentic_research", "S", "proof_pressure", 0.85),
  source("github:jesusvilela/connection_laplacian_lean", "connection_laplacian_lean", "github-repo", "public", "Lean", "https://github.com/jesusvilela/connection_laplacian_lean", "Lean 4 formalization of Z/2 connection Laplacian kernel dimension theory.", "formal_proof", "R", "formal_guard", 0.82),
  source("github:jesusvilela/IGBundle-LLM", "IGBundle-LLM", "github-repo", "public", "Python", "https://github.com/jesusvilela/IGBundle-LLM", "Information geometry and sheaf/bundle framework for LLM adaptation.", "model_geometry", "H", "model_geometry", 0.81),
  source("github:jesusvilela/UTAI---an-Uber-Topos-AI-", "UTAI---an-Uber-Topos-AI-", "github-repo", "private", "Python", "https://github.com/jesusvilela/UTAI---an-Uber-Topos-AI-", "Uber Topos AI research vehicle.", "agentic_research", "O", "agentic_candidate", 0.78),
  source("github:jesusvilela/Topos-Trasgo", "Topos-Trasgo", "github-repo", "private", "Kotlin", "https://github.com/jesusvilela/Topos-Trasgo", "Topos AI app based on Trasgo.", "interface_client", "H", "client_bridge", 0.74),
  source("github:jesusvilela/trasgo", "trasgo", "github-repo", "public", "JavaScript", "https://github.com/jesusvilela/trasgo", "Trasgo JavaScript vehicle for interface and agentic projection.", "interface_client", "C", "runtime_adapter", 0.68),
  source("github:jesusvilela/manifold", "manifold", "github-repo", "private", "Python", "https://github.com/jesusvilela/manifold", "Manifold research code surface.", "model_geometry", "H", "geometry_reference", 0.67),
  source("github:jesusvilela/hypercomplex-math-thesis", "hypercomplex-math-thesis", "github-repo", "private", "Python", "https://github.com/jesusvilela/hypercomplex-math-thesis", "Hypercomplex mathematical thesis repo.", "formal_proof", "O", "math_reference", 0.66),
  source("github:jesusvilela/aigit", "aigit", "github-repo", "private", "Python", "https://github.com/jesusvilela/aigit", "AI-native semantic version control layer built on Git.", "metacognition", "C", "provenance_adapter", 0.63),
  source("github:jesusvilela/generational-autoresearch", "generational-autoresearch", "github-repo", "public", "Python", "https://github.com/jesusvilela/generational-autoresearch", "AI agents running research on Hugging Face infrastructure.", "agentic_research", "CD32", "research_adapter", 0.61),
  source("github:jesusvilela/UNIVERSE_OS", "UNIVERSE_OS", "github-repo", "public", "JavaScript", "https://github.com/jesusvilela/UNIVERSE_OS", "Universe OS world/interface surface.", "world_projection", "A_n", "world_projection", 0.58),
  source("github:jesusvilela/The-Breath-of-Gaia", "The-Breath-of-Gaia", "github-repo", "private", "TypeScript", "https://github.com/jesusvilela/The-Breath-of-Gaia", "Breathing planet world-generation vehicle.", "world_projection", "A_n", "visual_reference", 0.56),
  source("github:jesusvilela/Luminas", "Luminas", "github-repo", "private", "Python", "https://github.com/jesusvilela/Luminas", "Artificial life visual/world surface.", "world_projection", "O", "visual_reference", 0.52),
  source("github:jesusvilela/polyworld-3d-evoluti", "polyworld-3d-evoluti", "github-repo", "private", "TypeScript", "https://github.com/jesusvilela/polyworld-3d-evoluti", "3D evolving world surface.", "world_projection", "H", "visual_reference", 0.5),
  source("hf:jesusvilela/manifoldgl-cp3000", "manifoldgl-cp3000", "hf-model", "public", "Qwen2", "https://hf.co/jesusvilela/manifoldgl-cp3000", "Neurosymbolic geometric model adapter with fiber-bundle, Riemannian, and information-geometry tags.", "model_adapter", "A_n", "model_adapter", 0.88),
  source("hf:jesusvilela/igbundle-qwen2.5-7b-riemannian", "igbundle-qwen2.5-7b-riemannian", "hf-model", "public", "Qwen2", "https://hf.co/jesusvilela/igbundle-qwen2.5-7b-riemannian", "Riemannian IGBundle Qwen2.5 7B model surface.", "model_adapter", "H", "model_adapter", 0.84),
  source("hf:jesusvilela/manifoldgl", "manifoldgl", "hf-model", "public", "PEFT/Qwen2", "https://hf.co/jesusvilela/manifoldgl", "Endpoint-compatible ManifoldGL adapter tagged hyperbolic, geometry, and research.", "model_adapter", "C", "endpoint_candidate", 0.8)
];

const RECOMMENDED_BRIDGES = [
  bridge("-lang.s1", "NETTRACER", "codec_translation", "admit Section LANG as the V2 translation and sheaf-gluing codec"),
  bridge("nnn-hyperbolic-ramdisk_v2", "NETTRACER", "capture_substrate", "bind the hyperbolic ramdisk as substrate candidate behind traffic capture"),
  bridge("TELOS", "NETTRACER", "telos_engine", "use TELOS as purpose-gradient reference while NetTracer remains the trace telos"),
  bridge("METACOG", "NETTRACER", "metacognition", "import protocol operators as V2 cognition status semantics"),
  bridge("connection_laplacian_lean", "NETTRACER", "formal_proof", "attach formal proof guards to graph/laplacian claims"),
  bridge("manifoldgl", "NETTRACER", "model_adapter", "treat HF ManifoldGL as a future read/model adapter, not a runtime dependency")
];

export function buildV2ArchitectureSources({ records = [], levels = [] } = {}) {
  const liveFactor = Math.log10(Math.max(1, records.length + 1));
  const sources = SOURCE_REGISTRY.map((entry, index) => {
    const level = levels.find((candidate) => candidate.level_id === entry.carrier);
    const liveBoost = (Number(level?.carrier_strength) || 0) * 0.03 + liveFactor * 0.02;
    return {
      ...entry,
      source_strength: round(entry.priority + liveBoost),
      orbit: {
        lane: index,
        radius: round(0.28 + (index % 7) * 0.08),
        phase: round((index * 137.508) % 360)
      }
    };
  });
  const strata = summarizeBy(sources, "stratum");
  const carriers = summarizeBy(sources, "carrier", "source_strength");
  const dominantCarrier = carriers.reduce((best, item) => (
    !best || item.weight > best.weight ? item : best
  ), null);
  return {
    telos: {
      root: "NETTRACER",
      statement: "NetTracer is the telos of net trace in hypercomplex hyperdim V2 architecture.",
      mode: "read_only_source_manifold"
    },
    admission_policy: {
      non_destructive: true,
      clone_required: false,
      runtime_execution: false,
      dependency_install: false,
      provenance_visible: true,
      note: "Repos and HF models are exposed as architectural source strata; they are not executed or mutated by V2."
    },
    counts: {
      sources: sources.length,
      github_repos: sources.filter((item) => item.kind === "github-repo").length,
      hf_models: sources.filter((item) => item.kind === "hf-model").length,
      strata: strata.length,
      recommended_bridges: RECOMMENDED_BRIDGES.length
    },
    dominant_source_carrier: dominantCarrier?.key || "A_n",
    strata,
    carriers,
    recommended_bridges: RECOMMENDED_BRIDGES,
    sources
  };
}

function source(id, name, kind, visibility, language, url, description, stratum, carrier, integrationMode, priority) {
  return {
    id,
    name,
    kind,
    visibility,
    language,
    url,
    description,
    stratum,
    carrier,
    integration_mode: integrationMode,
    priority
  };
}

function bridge(from, to, stratum, telos) {
  return {
    from,
    to,
    stratum,
    telos,
    guard: "read-only provenance bridge",
    preserves: ["source_identity", "active_remainder", "carrier_role", "non_destructive_admission"]
  };
}

function summarizeBy(items, key, weightKey = "priority") {
  const groups = new Map();
  for (const item of items) {
    const id = item[key] || "unknown";
    const current = groups.get(id) || { key: id, count: 0, weight: 0 };
    current.count += 1;
    current.weight += Number(item[weightKey]) || 0;
    groups.set(id, current);
  }
  return [...groups.values()]
    .map((item) => ({ ...item, weight: round(item.weight) }))
    .sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
}

function round(value, decimals = 6) {
  const scale = 10 ** decimals;
  return Math.round((Number(value) || 0) * scale) / scale;
}
