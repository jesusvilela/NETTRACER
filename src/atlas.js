import { sanitizePacket, summarize } from "./packet.js";

export function buildAtlas(controlPlane, traceStore) {
  const topology = controlPlane.getTopology();
  const policies = controlPlane.getPolicies();
  const packets = traceStore.getPackets().slice(-200).map((packet) => sanitizePacket(packet));
  const traces = traceStore.getTraces().slice(-50);
  const alerts = traceStore.getAlerts().slice(-50);

  return {
    generatedAt: new Date().toISOString(),
    topology,
    policies,
    packetCount: packets.length,
    traceCount: traces.length,
    alertCount: alerts.length,
    nodes: topology.nodes,
    edges: topology.edges,
    packets,
    traces,
    alerts,
    documents: buildDocuments(topology, policies, packets, alerts)
  };
}

function buildDocuments(topology, policies, packets, alerts) {
  const docs = [];
  docs.push({
    id: "atlas:overview",
    kind: "overview",
    title: "Topos orchestration overview",
    body: `nodes=${topology.nodes.length} edges=${topology.edges.length} packets=${packets.length} routePin=${policies.routePin || 'none'}`
  });

  for (const node of topology.nodes) {
    docs.push({
      id: `node:${node.id}`,
      kind: node.kind,
      title: node.label || node.id,
      body: summarize(JSON.stringify(node), 320)
    });
  }

  for (const packet of packets.slice(-50)) {
    docs.push({
      id: `packet:${packet.id}`,
      kind: packet.packetType,
      title: packet.envelope,
      body: summarize(JSON.stringify(packet.payload), 320)
    });
  }

  for (const alert of alerts.slice(-25)) {
    docs.push({
      id: `alert:${alert.id || alert.timestamp}`,
      kind: "alert",
      title: alert.title || alert.type || "alert",
      body: summarize(JSON.stringify(alert), 320)
    });
  }

  return docs;
}
