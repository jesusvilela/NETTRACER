import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { ControlPlane } from "../src/control-plane.js";
import { SlangControlPlane } from "../src/slang-control-plane.js";
import { buildS1Packet, S1_PACKET_TYPES } from "../src/packet.js";

function makeFixture() {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-slang-cp-"));
  const packets = [];
  const traffic = [];
  const events = new EventEmitter();
  const config = {
    stateDir,
    appName: "netracer",
    network: {
      httpUrls: ["http://192.168.1.44:8787/", "http://localhost:8787/"],
      wsUrls: ["ws://192.168.1.44:8787/ws/slang", "ws://localhost:8787/ws/slang"],
      lanIps: ["192.168.1.44"],
      preferredLanIp: "192.168.1.44",
      publicHost: "192.168.1.44",
      hostname: "trasgo-host"
    }
  };
  const traceStore = {
    addAudit() {},
    getPackets: () => packets,
    getTraffic: () => traffic,
    events
  };
  const broker = {
    emitPacket(input) {
      const packet = { id: `pkt_${packets.length + 1}`, ...input };
      packets.push(packet);
      return packet;
    }
  };
  const controlPlane = new ControlPlane(config, traceStore);
  controlPlane.updateTopology({
    upstreams: [{ id: "lmstudio", healthy: true, priority: 100 }],
    models: [{ id: "qwen", provider: "lmstudio", broker_default: false }]
  });
  return {
    config,
    traceStore,
    controlPlane,
    broker,
    packets,
    traffic,
    plane: new SlangControlPlane({ config, traceStore, controlPlane, broker })
  };
}

function writeV3Pack(root) {
  fs.mkdirSync(path.join(root, "mnt", "user-data", "outputs", "slang_packs_toe_v3_0"), { recursive: true });
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
    family: "§-LANG",
    version: "3.0.0-ToE-Prime",
    codename: "prime",
    files: [
      "LANG.ToE.Prime.SelfCompressed.lang",
      "LANG.Ops.dialect.lang",
      "LANG.Pipeline.dialect.lang",
      "LANG.ToE.Prime.SKILL.md"
    ],
    verified: {
      prime_roundtrip_N7_q1: "OK",
      sigma_prime_dual: "OK"
    }
  }, null, 2));
  fs.writeFileSync(path.join(root, "LANG.ToE.Prime.SelfCompressed.lang"), "§|LANG|TOE_HEADER{\nversion = v3\n}\nprime body");
  fs.writeFileSync(path.join(root, "LANG.Ops.dialect.lang"), "§|LANG|OPS_HEADER{\ntier = Formation\n}\nops body");
  fs.writeFileSync(path.join(root, "LANG.Pipeline.dialect.lang"), [
    "§|LANG|PIPELINE_HEADER{",
    "  tier = Formation",
    "}",
    "# SlangPackLoader parses the first §PIPELINE{...} block it finds across all .lang files.",
    "§PIPELINE{",
    "    flow = reservoir -> collapse -> tower -> atlas -> loeb -> prime",
    "    levels = 3",
    "    ringDepth = 4",
    "    reservoirSize = 128",
    "}"
  ].join("\n"));
  fs.writeFileSync(path.join(root, "LANG.ToE.Prime.SKILL.md"), "# prime");
  fs.writeFileSync(path.join(root, "mnt", "user-data", "outputs", "slang_packs_toe_v3_0", "manifest.json"), JSON.stringify({
    family: "§-LANG",
    version: "3.0.0-ToE",
    codename: "matter",
    files: ["LANG.ToE.SelfCompressed.lang"],
    verified: {
      sigma_81_q1: "OK"
    }
  }, null, 2));
}

test("SlangControlPlane installs v2.4 pack and exposes interpreter language", () => {
  const fixture = makeFixture();
  const sourcePath = path.resolve(process.cwd(), "..", "tools", "slang_packs");
  const result = fixture.plane.applyPackUpgrade({ sourcePath, nodeIds: ["lmstudio"], actor: "tester" });

  assert.equal(result.ok, true);
  assert.ok(result.pack.version);
  assert.ok(result.relays.length >= 1);
  assert.equal(fixture.plane.getActivePack().id, result.pack.id);
  const lang = fixture.plane.getInterpreterLang();
  assert.equal(lang.version, result.pack.version);
  assert.ok(lang.blocks.includes("SOURCE"));
  assert.ok(fixture.packets.length >= 3);
  assert.match(fixture.plane.getNodeBinding("lmstudio").envelope, /§NEGOTIATE/);
});

test("SlangControlPlane embeds and validates png .s1 carrier during multimodal send", () => {
  const fixture = makeFixture();
  fixture.plane.applyPackUpgrade({ sourcePath: path.resolve(process.cwd(), "..", "tools", "slang_packs"), nodeIds: [], actor: "tester" });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-slang-img-"));
  const pngPath = path.join(root, "carrier.png");
  fs.writeFileSync(
    pngPath,
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+1f8AAAAASUVORK5CYII=", "base64")
  );

  const result = fixture.plane.sendMultimodal({
    nodeId: "lmstudio",
    filePath: pngPath,
    actor: "tester",
    embedCarrier: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.inspection.carrier.validS1, true);
  assert.equal(result.message.nodeId, "lmstudio");
  assert.ok(result.packet?.metadata?.multimodal?.carrier?.validS1);
  assert.ok(fixture.plane.getNodeMessages("lmstudio", 10).some((message) => message.type === "multimodal-send"));
});

test("SlangControlPlane installs v3 self-compressed pack schema with pipeline metadata", () => {
  const fixture = makeFixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-slang-v3-"));
  writeV3Pack(root);

  const result = fixture.plane.applyPackUpgrade({ sourcePath: root, nodeIds: ["lmstudio"], actor: "tester" });

  assert.equal(result.ok, true);
  assert.match(result.pack.version, /3\.0\.0-ToE-Prime/);
  assert.equal(result.pack.manifestSchema, "self-compressed");
  assert.ok(result.pack.protocolNames.includes("Pipeline"));
  assert.ok(result.pack.protocolNames.includes("ToE.Prime.SelfCompressed"));
  assert.equal(result.pack.pipeline.flow.join("->"), "reservoir->collapse->tower->atlas->loeb->prime");
  assert.equal(result.pack.relatedPacks.length, 1);
  const lang = fixture.plane.getInterpreterLang();
  assert.match(lang.version, /3\.0\.0-ToE-Prime/);
  assert.ok(lang.blocks.includes("TOE_HEADER"));
  assert.equal(fixture.plane.getNodeBinding("lmstudio").pack.flow.length, 6);
});

test("SlangControlPlane builds bidirectional graph map with section cuts and binds", () => {
  const fixture = makeFixture();
  fixture.plane.applyPackUpgrade({ sourcePath: path.resolve(process.cwd(), "..", "tools", "slang_packs"), nodeIds: [], actor: "tester" });

  const forward = buildS1Packet({
    packetType: S1_PACKET_TYPES.EXECUTION,
    clientId: "tester",
    intent: "Forward substrate push",
    route: "lmstudio",
    analysis: { routeHint: "semantic", tags: ["§TOPO"], summary: "forward" },
    sigma: { summary: "σ[3/4]" },
    stage: { name: "CMT" }
  });
  const reverse = buildS1Packet({
    packetType: S1_PACKET_TYPES.PROOF,
    clientId: "tester",
    intent: "Return witness",
    route: "lmstudio",
    analysis: { routeHint: "semantic", tags: ["§PROOF"], summary: "reverse" },
    stage: { name: "RLB" }
  });
  fixture.packets.push(forward, reverse);
  fixture.traffic.push(
    { packetId: forward.id, route: "lmstudio", direction: "TO_SUBSTRATE" },
    { packetId: reverse.id, route: "lmstudio", direction: "FROM_SUBSTRATE" }
  );

  const graph = fixture.plane.buildGraphMap({ nodeId: "lmstudio", direction: "all", limit: 12 });

  assert.equal(graph.selectedNodeId, "lmstudio");
  assert.ok(graph.bind.httpUrl.includes("192.168.1.44"));
  assert.ok(graph.sections.some((item) => item.id === "execution"));
  assert.ok(graph.strands.some((item) => item.direction === "forward"));
  assert.ok(graph.strands.some((item) => item.direction === "reverse"));
  assert.ok(Array.isArray(graph.reservoirBundles));
  assert.ok(graph.reservoirBundles.some((item) => item.layers.some((layer) => layer.count > 0)));
  assert.ok(Array.isArray(graph.layerComposition));
  assert.ok(Array.isArray(graph.matrixPayload.countMatrix));
  assert.equal(graph.matrixPayload.countMatrix.length, graph.reservoirBundles.length);
  assert.equal(graph.matrixPayload.layerOrder.length, graph.layerComposition.length);
  assert.ok(graph.metrics.connectedBundleCount >= 1);
});

test("SlangControlPlane exposes topology-wide SLANG coverage and prunes stale bindings", () => {
  const fixture = makeFixture();
  fixture.plane.applyPackUpgrade({ sourcePath: path.resolve(process.cwd(), "..", "tools", "slang_packs"), nodeIds: [], actor: "tester" });

  const snapshot = fixture.plane.getTopologySnapshot();
  assert.equal(snapshot.metrics.totalNodes, fixture.controlPlane.getTopology().nodes.length);
  assert.equal(snapshot.metrics.boundNodes, snapshot.metrics.totalNodes);
  assert.equal(snapshot.metrics.unboundNodes, 0);
  assert.equal(snapshot.metrics.orphanedBindings.length, 0);
  assert.ok(snapshot.nodes.every((node) => node.negotiated === true));
  assert.ok(snapshot.nodes.some((node) => node.id === "netracer" && node.packVersion));
  assert.equal(snapshot.activePack.version, fixture.plane.getActivePack().version);

  fixture.controlPlane.updateTopology({
    upstreams: [{ id: "lmstudio", healthy: true, priority: 100 }],
    models: []
  });

  const after = fixture.plane.getTopologySnapshot();
  assert.equal(after.metrics.totalNodes, fixture.controlPlane.getTopology().nodes.length);
  assert.equal(fixture.plane.getNodeBinding("model:lmstudio:qwen"), null);
  assert.equal(after.metrics.orphanedBindings.length, 0);
  assert.ok(after.nodes.every((node) => node.negotiated === true));
  assert.ok(!after.nodes.some((node) => node.id === "model:lmstudio:qwen"));
});

test("SlangControlPlane propagates peer reachability for live nodes", () => {
  const fixture = makeFixture();
  fixture.plane.applyPackUpgrade({ sourcePath: path.resolve(process.cwd(), "..", "tools", "slang_packs"), nodeIds: [], actor: "tester" });

  fixture.controlPlane.updateTopology({
    upstreams: [
      { id: "lmstudio", healthy: true, priority: 100 },
      { id: "ollama", healthy: true, priority: 80 }
    ],
    models: [{ id: "qwen", provider: "lmstudio", broker_default: false }],
    clients: [{
      id: "node-alpha",
      label: "node-alpha",
      healthy: true,
      transport: "ws/slang",
      remoteAddress: "127.0.0.1",
      userAgent: "node-alpha/1.0",
      subscriptions: ["lmstudio", "ollama"],
      paths: ["/ws/slang"],
      methods: ["GET"],
      lastSeenAt: new Date().toISOString()
    }]
  });

  const snapshot = fixture.plane.getTopologySnapshot();
  const nodeMessages = fixture.plane.getNodeMessages("lmstudio", 20);

  assert.ok(snapshot.nodes.some((node) => node.id === "node-alpha" && node.kind === "client"));
  assert.ok(snapshot.nodes.every((node) => node.id === "netracer" || node.peerCount >= 1));
  assert.ok(nodeMessages.some((message) => message.type === "peer-reachability"));
});

test("SlangControlPlane pack upgrade preserves prior installs instead of deleting them", () => {
  const fixture = makeFixture();
  const sourcePath = path.resolve(process.cwd(), "..", "tools", "slang_packs");
  const first = fixture.plane.applyPackUpgrade({ sourcePath, nodeIds: [], actor: "tester" });
  const second = fixture.plane.applyPackUpgrade({ sourcePath, nodeIds: [], actor: "tester" });

  assert.notEqual(first.pack.installDir, second.pack.installDir);
  assert.ok(fs.existsSync(first.pack.installDir));
  assert.ok(fs.existsSync(second.pack.installDir));
  assert.equal(fixture.plane.getActivePack().installDir, second.pack.installDir);
});

test("SlangControlPlane computes cognitive reflection and persists bounded memory", () => {
  const fixture = makeFixture();
  fixture.plane.applyPackUpgrade({ sourcePath: path.resolve(process.cwd(), "..", "tools", "slang_packs"), nodeIds: [], actor: "tester" });
  fixture.packets.push(buildS1Packet({
    packetType: S1_PACKET_TYPES.AUDIT,
    clientId: "tester",
    intent: "self reflection over sheaf gluing and mutual resonance",
    route: "lmstudio",
    analysis: { routeHint: "reflective", tags: ["self", "sheaf", "mutual"], summary: "reflective audit" },
    labels: ["self", "mutual", "sheaf"]
  }));

  const snapshot = fixture.plane.getCognitiveSnapshot({ persist: true, limit: 24 });
  const memory = fixture.plane.getCognitiveMemory(4);

  assert.equal(snapshot.version, "cognitive-reflection.v1");
  assert.equal(snapshot.totalCount, 24);
  assert.ok(snapshot.qualities.some((quality) => quality.id === "self_reflection"));
  assert.ok(snapshot.qualities.some((quality) => quality.id === "multi_angle_epistemics"));
  assert.ok(Array.isArray(snapshot.nodeReflections));
  assert.equal(snapshot.matrix.length, snapshot.totalCount);
  assert.ok(snapshot.evidence.topologyNodes >= 2);
  assert.equal(memory.length, 1);
  assert.equal(memory[0].score, snapshot.score);
  assert.ok(Array.isArray(memory[0].nodeReflections));
});

test("SlangControlPlane installs manifestless SLANG repository", () => {
  const fixture = makeFixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-slang-manifestless-"));
  fs.writeFileSync(path.join(root, "LANG.v5.topos_ai_cosmos_synthesis.lang"), "§|LANG|COSMOS{\nlayer = n-cosmo\n}\ncosmos body");
  fs.writeFileSync(path.join(root, "LANG.ToE.SelfCompressed.lang"), "§|LANG|SELF{\nkind = godelian\n}\nself body");
  fs.writeFileSync(path.join(root, "SKILL.md"), "# manifestless");

  const result = fixture.plane.applyPackUpgrade({ sourcePath: root, nodeIds: ["lmstudio"], actor: "tester" });
  const lang = fixture.plane.getInterpreterLang();

  assert.equal(result.ok, true);
  assert.equal(result.pack.manifestSchema, "self-compressed");
  assert.equal(result.pack.validation.manifest_synthesized, "OK");
  assert.match(result.pack.version, /v5/);
  assert.ok(result.pack.protocolNames.some((name) => /SelfCompressed|topos/i.test(name)));
  assert.ok(lang.blocks.includes("SELF") || lang.blocks.includes("COSMOS"));
});

test("SlangControlPlane bootstraps UTAI and Bunny core learners on IGBundle substrate", () => {
  const fixture = makeFixture();
  const utaiRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-utai-"));
  const bunnyRoot = path.join(path.dirname(utaiRoot), "Bunny");
  const igRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-igbundle-"));
  fs.mkdirSync(bunnyRoot, { recursive: true });
  fs.mkdirSync(path.join(igRoot, "memory"), { recursive: true });
  fs.mkdirSync(path.join(igRoot, "checkpoint-42"), { recursive: true });
  fs.writeFileSync(path.join(igRoot, "checkpoint-42", "adapter_weights.pt"), "adapter");
  fs.writeFileSync(path.join(igRoot, "memory", "model_state.json"), JSON.stringify({
    checkpoint: { path: path.join(igRoot, "checkpoint-42", "adapter_weights.pt"), step: 42, adapter_type: "geometric" },
    telemetry_snapshot: { curvature: -5.8, entropy: 2.3, active_fiber: "Bundle-5", lipschitz_ratio: 0.13 }
  }, null, 2));
  fs.writeFileSync(path.join(utaiRoot, "true_falsifiable_utai.json"), JSON.stringify({
    exact_claims: [{ id: "T1" }, { id: "T2" }],
    envelope_claims: [{ id: "E1" }],
    nonclaims: [{ id: "N1" }]
  }));
  fs.writeFileSync(path.join(utaiRoot, "classifying_core_report.json"), "{}");
  fs.writeFileSync(path.join(bunnyRoot, "README.md"), "# Bunny");
  fs.writeFileSync(path.join(bunnyRoot, "solver.py"), "print('ok')");

  const result = fixture.plane.bootstrapCoreLearners({ utaiRoot, igbundleRoot: igRoot, actor: "tester" });
  const learners = fixture.plane.getLearners();
  const topology = fixture.plane.getTopologySnapshot();
  const cycle = fixture.plane.runMetaLearningCycle({ actor: "tester", reason: "test" });
  const reservoir = fixture.plane.getReservoirComputingScheme({ persist: true, reason: "test" });
  const cognitive = fixture.plane.getCognitiveSnapshot({ persist: true, limit: 24 });

  assert.equal(result.ok, true);
  assert.equal(learners.substrate.checkpoint.step, 42);
  assert.ok(learners.learners.some((learner) => learner.id === "learner:utai"));
  assert.ok(learners.learners.some((learner) => learner.id === "learner:bunny"));
  assert.ok(topology.nodes.some((node) => node.id === "learner:utai" && node.negotiated));
  assert.ok(topology.nodes.some((node) => node.id === "igbundle-substrate"));
  assert.ok(cycle.score > 0);
  assert.ok(cycle.reservoirScore >= 0);
  assert.ok(cognitive.nodeReflections.some((node) => node.nodeId === "learner:utai"));
  assert.ok(cognitive.nodeReflections.some((node) => node.nodeId === "learner:bunny"));
  assert.ok(reservoir.roles.inputs.includes("learner:utai"));
  assert.ok(reservoir.roles.inputs.includes("learner:bunny"));
  assert.ok(reservoir.roles.reservoir.includes("igbundle-substrate"));
  assert.equal(reservoir.roles.memory, "memory:slang-recurrent");
  assert.ok(reservoir.transitions.some((transition) => transition.kind === "feedback"));
});
