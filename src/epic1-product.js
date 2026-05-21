import path from "node:path";
import { collectScanTargets, expandFileToS1 } from "./ingress-expander.js";

const DEFAULT_SAMPLE_LIMIT = 5;
const SUBSTRATE_TARGET = Object.freeze({
  scope: "any_accessible_jesusvilela_repo",
  observed_reference: "jesusvilela/nnn-hyperbolic-ramdisk_v2",
  role: "substrate-independent hyperbolic semantic memory fabric",
  integration_mode: "reference_only_non_destructive",
  admissibility: "repo may serve as substrate target when it can satisfy the backend contract and safety gates",
  cosmos_model: {
    unit: "repository_as_local_cosmos_fiber",
    atlas: "multi_repo_hypercomplex_manifold",
    perspective_operator: "hypercomplex_inside_hypercomplex",
    rule: "wider repo-cosmos views must preserve local invariants while increasing gluing evidence"
  },
  geometric_metric: "split-signature (2,2) placement/ranking metric",
  backend_contract: ["reserve", "write", "read", "append", "flush", "migrate_out", "events"],
  substrate_tiers: ["T0_RAM", "T1_NVMe", "T2_ZNS", "T3_NVMe_oF", "T4_GPU", "T5_CXL"],
  safety: ["emulator_default", "explicit_feature_flags", "hardware_guardrails", "idempotent_migration"]
});

export function buildEpic1ScanPreview(payload = {}, config = {}) {
  const scanPath = String(payload.path || "").trim();
  if (!scanPath) {
    throw new Error("scan_path_required");
  }

  const recursive = payload.recursive !== false;
  const include = normalizeInclude(payload.include);
  const hyperbolize = payload.hyperbolize !== false;
  const backend = normalizeBackend(payload.backend || "webgpu");
  const sampleLimit = clampInt(payload.sampleLimit, 0, 25, DEFAULT_SAMPLE_LIMIT);

  const targets = collectScanTargets(scanPath, {
    recursive,
    include,
    maxFiles: config.ingress?.maxScanFiles || 300,
    maxFileBytes: config.ingress?.maxScanFileBytes || 2 * 1024 * 1024
  });

  const sample = [];
  for (const target of targets.files.slice(0, sampleLimit)) {
    const expanded = expandFileToS1({ filePath: target.path, hyperbolize, backend });
    sample.push({
      path: target.path,
      ext: target.ext,
      sizeBytes: target.sizeBytes,
      kind: expanded.kind,
      preview: expanded.preview,
      graph: {
        entityCount: Object.keys(expanded.entities || {}).length,
        relationCount: Array.isArray(expanded.relations) ? expanded.relations.length : 0
      },
      hyperbolic: summarizeHyperbolic(expanded.meta?.hyperbolic),
      structure: expanded.meta?.structure || null
    });
  }

  return {
    product: "epic1-geom-product",
    mode: "non_destructive_preview",
    v1_scan_compatible: true,
    writes: [],
    input: {
      path: path.resolve(scanPath),
      recursive,
      include,
      hyperbolize,
      backend,
      sampleLimit
    },
    scan: {
      totalFiles: targets.files.length,
      skipped: targets.skipped,
      includeExtensions: targets.includeExtensions
    },
    sample,
    geometry: {
      base: "hyperbolic repository manifold",
      consistency: "cellular sheaf preview",
      dynamics: "no Hamiltonian mutation in preview",
      transport: "compatible with V1 ingress scan payload"
    },
    substrate_target: SUBSTRATE_TARGET,
    guarantees: {
      does_not_enqueue_v1_scan: true,
      does_not_emit_packets: true,
      does_not_write_archive: true,
      does_not_mutate_source_files: true
    }
  };
}

function normalizeInclude(include) {
  if (Array.isArray(include)) return include;
  if (typeof include === "string") return include.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeBackend(value) {
  const input = String(value || "").toLowerCase();
  return ["webgpu", "tpu", "tyngpu"].includes(input) ? input : "webgpu";
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function summarizeHyperbolic(hyperbolic) {
  if (!hyperbolic) return null;
  const nodes = Array.isArray(hyperbolic.nodes) ? hyperbolic.nodes : [];
  const edges = Array.isArray(hyperbolic.edges) ? hyperbolic.edges : [];
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    curvature: hyperbolic.curvature ?? hyperbolic.metadata?.curvature ?? null,
    model: hyperbolic.model || hyperbolic.metadata?.model || "poincare-preview"
  };
}
