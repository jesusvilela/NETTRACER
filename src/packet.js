import crypto from "node:crypto";
import path from "node:path";
import { buildSectionEnvelope } from "./section-lang.js";
import { writeJsonFileSafely } from "./persistence.js";

export const S1_PACKET_TYPES = {
  INTENT: "intent",
  ROUTE_PLAN: "route-plan",
  ADMISSION: "admission",
  EXECUTION: "execution",
  PROOF: "proof",
  AUDIT: "audit",
  SNAPSHOT: "snapshot",
  POLICY: "policy",
  TOPOLOGY: "topology",
  ALERT: "alert"
};

export function buildS1Packet({
  packetType = S1_PACKET_TYPES.INTENT,
  clientId,
  actor = null,
  intent = "",
  analysis = null,
  route = "",
  model = "",
  metadata = {},
  parents = [],
  stage = null,
  sigma = null,
  kappa = null,
  topology = null,
  proof = null,
  security = null,
  labels = []
}) {
  const timestamp = new Date().toISOString();
  const id = `s1_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const payload = {
    intent,
    analysis,
    route,
    model,
    metadata,
    stage,
    sigma,
    kappa,
    topology,
    proof,
    security,
    labels
  };
  const digest = sha256({ clientId, actor, packetType, timestamp, parents, payload });
  const packet = {
    id,
    version: "s1",
    packetType,
    timestamp,
    clientId,
    actor,
    parents,
    digest,
    envelope: buildSectionEnvelope({
      id,
      kind: packetType,
      client: clientId,
      route,
      model,
      digest: digest.slice(0, 16),
      promptType: analysis?.promptType,
      stage: stage?.name,
      sigma: sigma?.summary,
      tags: analysis?.tags || [],
      labels
    }),
    payload
  };
  packet.signature = signPacket(packet, security?.signingKey || null);
  return packet;
}

export function buildProofBundle({ terminal, stageTrace = [], routePlan = [], sigma = null, kappa = null, gluing = null, notes = [] }) {
  const material = { terminal, stageTrace, routePlan, sigma, kappa, gluing, notes };
  return {
    terminal,
    routePlan,
    stageTrace,
    sigma,
    kappa,
    gluing,
    notes,
    traceHash: sha256(material)
  };
}

export function writeS1Packet(packet, outboxDir) {
  const filePath = path.join(outboxDir, `${packet.id}.s1`);
  writeJsonFileSafely(filePath, packet);
  return filePath;
}

export function sanitizePacket(packet) {
  const clone = JSON.parse(JSON.stringify(packet));
  if (clone.payload?.intent) {
    clone.payload.intent = summarize(clone.payload.intent, 160);
  }
  if (clone.payload?.metadata?.response) {
    clone.payload.metadata.response = summarize(clone.payload.metadata.response, 180);
  }
  return clone;
}

export function summarize(text, max = 160) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function signPacket(packet, signingKey) {
  if (!signingKey) {
    return null;
  }
  return crypto.createHmac("sha256", signingKey).update(JSON.stringify({ id: packet.id, digest: packet.digest, parents: packet.parents })).digest("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
