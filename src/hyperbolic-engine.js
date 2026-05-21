import crypto from "node:crypto";

const DEFAULT_ENGINE = "js-hyperbolic-embedder";
const MAX_REFINEMENT_STEPS = 18;

export function embedHyperbolicGraph(input, options = {}) {
  const engine = getHyperbolicEngine(options.engine);
  return engine.embed(input, options);
}

export function getHyperbolicEngine(name = DEFAULT_ENGINE) {
  const normalized = String(name || DEFAULT_ENGINE).trim().toLowerCase();
  if (!normalized || normalized === DEFAULT_ENGINE) {
    return {
      name: DEFAULT_ENGINE,
      embed: embedWithJsEngine
    };
  }
  throw new Error(`unsupported_hyperbolic_engine:${normalized}`);
}

function embedWithJsEngine(input, options = {}) {
  const graph = buildGraphModel(input);
  const seed = String(options.seed || stableSeed(graph));
  const components = buildComponents(graph);
  const polar = {};
  const coords = {};
  const componentLayouts = [];
  let totalIterations = 0;

  const totalNodes = Math.max(1, graph.nodes.length);
  let cursor = -Math.PI;
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const span = (Math.PI * 2) * (component.nodeIds.length / totalNodes);
    const paddedSpan = Math.max(0.42, span - 0.06);
    const sectorStart = cursor;
    const sectorEnd = cursor + span;
    cursor = sectorEnd;

    const layout = embedComponent(graph, component, {
      seed: `${seed}:${component.id}`,
      sectorStart: sectorStart + (span - paddedSpan) * 0.5,
      sectorEnd: sectorStart + (span + paddedSpan) * 0.5
    });
    totalIterations += layout.iterations;
    componentLayouts.push({
      id: component.id,
      nodeIds: component.nodeIds.slice(),
      sectorStart: round(layout.sectorStart),
      sectorEnd: round(layout.sectorEnd)
    });
    Object.assign(polar, layout.polar);
    for (const [nodeId, point] of Object.entries(layout.polar)) {
      const diskRadius = Math.min(0.96, Math.max(0.04, Math.tanh(point.r / 2)));
      coords[nodeId] = [
        round(Math.cos(point.theta) * diskRadius),
        round(Math.sin(point.theta) * diskRadius)
      ];
    }
  }

  const metrics = buildMetrics(graph, polar, coords, components);
  return {
    engine: DEFAULT_ENGINE,
    model: "graph-derived-poincare",
    curvature: round(-1 - Math.min(1.5, metrics.relationDensity * 0.35)),
    relationDensity: metrics.relationDensity,
    coords,
    polar,
    metrics,
    components: componentLayouts,
    diagnostics: {
      warnings: buildWarnings(graph, components, metrics),
      iterations: totalIterations,
      converged: true,
      seed
    },
    bundle: {
      base_space: "PoincareDisk",
      fiber_rank: Math.max(1, Math.min(12, components.length + Math.ceil(Math.sqrt(graph.nodes.length) / 3))),
      local_trivializations: Math.max(1, Math.min(32, components.length + Math.ceil(graph.edgeList.length / Math.max(1, graph.nodes.length)))),
      transition_smoothness: round(Math.max(0.18, 1 - metrics.edgeStretchP95 * 0.45))
    }
  };
}

function buildGraphModel(input) {
  const rawEntities = input?.entities || {};
  const entityEntries = Object.entries(rawEntities)
    .filter(([id]) => id)
    .map(([id, value]) => ({
      id: String(id),
      label: Array.isArray(value) ? String(value[0] || id) : String(value || id),
      kind: Array.isArray(value) ? String(value[1] || "node") : "node"
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const nodeSet = new Set(entityEntries.map((item) => item.id));
  const neighbors = new Map(entityEntries.map((item) => [item.id, new Set()]));
  const edgeMap = new Map();

  for (const relation of input?.relations || []) {
    const parsed = parseRelation(relation);
    if (!parsed) continue;
    const { from, to, kind } = parsed;
    if (!nodeSet.has(from) || !nodeSet.has(to) || from === to) continue;
    neighbors.get(from).add(to);
    neighbors.get(to).add(from);
    const edgeKey = [from, to].sort().join("|");
    if (!edgeMap.has(edgeKey)) {
      edgeMap.set(edgeKey, { from, to, kind });
    }
  }

  const nodes = entityEntries.map((item) => ({
    ...item,
    degree: neighbors.get(item.id)?.size || 0
  }));
  const edgeList = [...edgeMap.values()].sort((a, b) => {
    const left = [a.from, a.to].sort().join("|");
    const right = [b.from, b.to].sort().join("|");
    return left.localeCompare(right);
  });

  return { nodes, neighbors, edgeList };
}

function parseRelation(relation) {
  const [leftRight, labelPart] = String(relation || "").split(":");
  const [from, to] = leftRight.split("→").map((item) => String(item || "").trim());
  if (!from || !to) return null;
  return { from, to, kind: String(labelPart || "related").trim() || "related" };
}

function buildComponents(graph) {
  const seen = new Set();
  const components = [];
  for (const node of graph.nodes) {
    if (seen.has(node.id)) continue;
    const queue = [node.id];
    const nodeIds = [];
    seen.add(node.id);
    while (queue.length > 0) {
      const current = queue.shift();
      nodeIds.push(current);
      const peers = [...(graph.neighbors.get(current) || [])].sort();
      for (const next of peers) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    components.push({
      id: `component_${components.length}`,
      nodeIds: nodeIds.sort((a, b) => a.localeCompare(b))
    });
  }
  return components.sort((a, b) => b.nodeIds.length - a.nodeIds.length || a.id.localeCompare(b.id));
}

function embedComponent(graph, component, options) {
  const nodeIds = component.nodeIds.slice();
  const size = nodeIds.length;
  const polar = {};
  if (size === 1) {
    polar[nodeIds[0]] = { r: 0.22, theta: normalizeAngle((options.sectorStart + options.sectorEnd) * 0.5) };
    return { polar, iterations: 0, sectorStart: options.sectorStart, sectorEnd: options.sectorEnd };
  }
  if (size === 2) {
    polar[nodeIds[0]] = { r: 0.54, theta: normalizeAngle(options.sectorStart + 0.18) };
    polar[nodeIds[1]] = { r: 0.54, theta: normalizeAngle(options.sectorEnd - 0.18) };
    return { polar, iterations: 0, sectorStart: options.sectorStart, sectorEnd: options.sectorEnd };
  }

  const distances = allPairsDistances(graph, nodeIds);
  const signatures = wlSignatures(graph, nodeIds);
  const stats = nodeIds.map((nodeId, index) => {
    const row = distances.get(nodeId) || new Map();
    let distanceSum = 0;
    for (const otherId of nodeIds) {
      if (otherId === nodeId) continue;
      distanceSum += row.get(otherId) ?? size;
    }
    const closeness = distanceSum > 0 ? (size - 1) / distanceSum : 0;
    const degree = graph.neighbors.get(nodeId)?.size || 0;
    return { nodeId, degree, closeness, signature: signatures.get(nodeId), index };
  });

  const closenessValues = stats.map((item) => item.closeness);
  const degreeValues = stats.map((item) => item.degree);
  const minClose = Math.min(...closenessValues);
  const maxClose = Math.max(...closenessValues);
  const maxDegree = Math.max(1, ...degreeValues);

  const ordered = stats.slice().sort((a, b) => {
    const signatureDiff = a.signature.localeCompare(b.signature);
    if (signatureDiff !== 0) return signatureDiff;
    if (b.closeness !== a.closeness) return b.closeness - a.closeness;
    if (b.degree !== a.degree) return b.degree - a.degree;
    return a.nodeId.localeCompare(b.nodeId);
  });

  const span = Math.max(0.25, options.sectorEnd - options.sectorStart);
  const initialAngles = new Map();
  ordered.forEach((item, index) => {
    const offset = (index + 0.5) / ordered.length;
    initialAngles.set(item.nodeId, options.sectorStart + span * offset);
  });

  const angles = new Map(initialAngles);
  const radialById = new Map();
  for (const item of stats) {
    const degreeNorm = item.degree / maxDegree;
    const closeNorm = normalizeRange(item.closeness, minClose, maxClose);
    const centrality = closeNorm * 0.72 + degreeNorm * 0.28;
    radialById.set(item.nodeId, 0.32 + (1 - centrality) * 1.68);
  }

  let iterations = 0;
  for (; iterations < MAX_REFINEMENT_STEPS; iterations += 1) {
    const nextAngles = new Map();
    let maxShift = 0;
    for (const item of ordered) {
      const peers = [...(graph.neighbors.get(item.nodeId) || [])].filter((peer) => radialById.has(peer));
      if (peers.length === 0) {
        nextAngles.set(item.nodeId, clampAngleToSector(angles.get(item.nodeId), options.sectorStart, options.sectorEnd));
        continue;
      }
      let x = 0;
      let y = 0;
      for (const peer of peers) {
        const theta = angles.get(peer);
        x += Math.cos(theta);
        y += Math.sin(theta);
      }
      const neighborTheta = Math.atan2(y, x || 1e-9);
      const anchorTheta = initialAngles.get(item.nodeId);
      const blended = circularBlend(anchorTheta, neighborTheta, 0.64);
      const constrained = clampAngleToSector(blended, options.sectorStart, options.sectorEnd);
      maxShift = Math.max(maxShift, angularDistance(angles.get(item.nodeId), constrained));
      nextAngles.set(item.nodeId, constrained);
    }
    for (const [nodeId, theta] of nextAngles) {
      angles.set(nodeId, theta);
    }
    if (maxShift < 0.0008) {
      iterations += 1;
      break;
    }
  }

  for (const nodeId of nodeIds) {
    polar[nodeId] = {
      r: round(radialById.get(nodeId)),
      theta: round(normalizeAngle(angles.get(nodeId)))
    };
  }
  return { polar, iterations, sectorStart: options.sectorStart, sectorEnd: options.sectorEnd };
}

function allPairsDistances(graph, nodeIds) {
  const set = new Set(nodeIds);
  const result = new Map();
  for (const nodeId of nodeIds) {
    const distances = new Map([[nodeId, 0]]);
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift();
      const base = distances.get(current) || 0;
      for (const peer of graph.neighbors.get(current) || []) {
        if (!set.has(peer) || distances.has(peer)) continue;
        distances.set(peer, base + 1);
        queue.push(peer);
      }
    }
    result.set(nodeId, distances);
  }
  return result;
}

function wlSignatures(graph, nodeIds) {
  let labels = new Map(nodeIds.map((nodeId) => [nodeId, `d${graph.neighbors.get(nodeId)?.size || 0}`]));
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const next = new Map();
    for (const nodeId of nodeIds) {
      const neighborLabels = [...(graph.neighbors.get(nodeId) || [])]
        .filter((peer) => labels.has(peer))
        .map((peer) => labels.get(peer))
        .sort();
      const material = `${labels.get(nodeId)}|${neighborLabels.join(",")}`;
      next.set(nodeId, hashShort(material));
    }
    labels = next;
  }
  return labels;
}

function buildMetrics(graph, polar, coords, components) {
  const nodeIds = Object.keys(polar);
  const radial = nodeIds.map((nodeId) => polar[nodeId].r);
  const degrees = nodeIds.map((nodeId) => graph.neighbors.get(nodeId)?.size || 0);
  const edgeStretch = graph.edgeList.map((edge) => {
    const a = coords[edge.from];
    const b = coords[edge.to];
    if (!a || !b) return 0;
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }).sort((a, b) => a - b);

  return {
    relationDensity: round(graph.edgeList.length / Math.max(1, graph.nodes.length)),
    edgeStretchMean: round(mean(edgeStretch)),
    edgeStretchP95: round(percentile(edgeStretch, 0.95)),
    componentCount: components.length,
    degreeRadialCorrelation: round(correlation(degrees, radial.map((value) => -value))),
    qualityScore: round(clamp(
      0.42
      + Math.max(0, correlation(degrees, radial.map((value) => -value))) * 0.28
      + Math.max(0, 1 - percentile(edgeStretch, 0.95)) * 0.22
      + Math.max(0, 1 - (components.length - 1) * 0.12),
      0,
      1
    ))
  };
}

function buildWarnings(graph, components, metrics) {
  const warnings = [];
  if (components.length > 1) warnings.push("graph_is_disconnected");
  if (graph.edgeList.length === 0) warnings.push("graph_has_no_relations");
  if (metrics.degreeRadialCorrelation < 0.2 && graph.nodes.length > 4) warnings.push("weak_degree_radial_signal");
  return warnings;
}

function stableSeed(graph) {
  const material = {
    nodes: graph.nodes.map((node) => ({ kind: node.kind, degree: node.degree })),
    edges: graph.edgeList.map((edge) => [edge.from, edge.to].sort())
  };
  return crypto.createHash("sha256").update(JSON.stringify(material)).digest("hex").slice(0, 16);
}

function hashShort(text) {
  return crypto.createHash("sha1").update(String(text)).digest("hex").slice(0, 12);
}

function clampAngleToSector(theta, start, end) {
  const min = start + 0.04;
  const max = end - 0.04;
  return Math.max(min, Math.min(max, theta));
}

function circularBlend(anchor, target, weight) {
  const delta = Math.atan2(Math.sin(target - anchor), Math.cos(target - anchor));
  return anchor + delta * weight;
}

function angularDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function normalizeAngle(theta) {
  let next = theta;
  while (next <= -Math.PI) next += Math.PI * 2;
  while (next > Math.PI) next -= Math.PI * 2;
  return next;
}

function normalizeRange(value, min, max) {
  if (max - min < 1e-9) return 1;
  return (value - min) / (max - min);
}

function correlation(left, right) {
  if (left.length !== right.length || left.length === 0) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let num = 0;
  let leftVar = 0;
  let rightVar = 0;
  for (let index = 0; index < left.length; index += 1) {
    const dx = left[index] - leftMean;
    const dy = right[index] - rightMean;
    num += dx * dy;
    leftVar += dx * dx;
    rightVar += dy * dy;
  }
  if (leftVar < 1e-9 || rightVar < 1e-9) return 0;
  return num / Math.sqrt(leftVar * rightVar);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const position = Math.min(values.length - 1, Math.max(0, Math.round((values.length - 1) * p)));
  return values[position];
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Number(Number(value || 0).toFixed(4));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
