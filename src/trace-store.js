import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { sanitizePacket } from "./packet.js";
import { writeJsonFileSafely } from "./persistence.js";

export class TraceStore {
  constructor(config) {
    this.config = config;
    this.events = new EventEmitter();
    this.traffic = [];
    this.traces = [];
    this.packets = [];
    this.packetIndex = new Map();
    this.alerts = [];
    this.audit = [];
    this.packetSinks = [];
  }

  addTraffic(entry) {
    this.traffic.push(entry);
    while (this.traffic.length > this.config.trafficLimit) {
      this.traffic.shift();
    }
    this.events.emit("traffic", entry);
  }

  addPacket(packet) {
    const safe = packet;
    this.packets.push(safe);
    this.packetIndex.set(safe.id, safe);
    while (this.packets.length > this.config.packetLimit) {
      const removed = this.packets.shift();
      if (removed) {
        this.packetIndex.delete(removed.id);
      }
    }
    const filePath = path.join(this.config.packetDir, `${safe.id}.json`);
    let persistedPath = filePath;
    try {
      writeJsonFileSafely(filePath, safe);
    } catch (error) {
      persistedPath = null;
      this.addAlert({
        id: `alert_packet_persist_${Date.now()}`,
        title: "Packet persistence degraded",
        type: "packet-persist-failed",
        detail: error.message,
        packetId: safe.id,
        timestamp: Date.now()
      });
    }
    for (const sink of this.packetSinks) {
      try {
        sink(safe);
      } catch {
      }
    }
    this.events.emit("packet", sanitizePacket(safe));
    return persistedPath;
  }

  registerPacketSink(callback) {
    if (typeof callback !== "function") return () => {};
    this.packetSinks.push(callback);
    return () => {
      this.packetSinks = this.packetSinks.filter((item) => item !== callback);
    };
  }

  addTrace(trace) {
    this.traces.push(trace);
    while (this.traces.length > this.config.traceLimit) {
      this.traces.shift();
    }
    const filePath = path.join(this.config.traceDir, `${trace.id}.json`);
    try {
      writeJsonFileSafely(filePath, trace);
    } catch (error) {
      this.addAlert({
        id: `alert_trace_persist_${Date.now()}`,
        title: "Trace persistence degraded",
        type: "trace-persist-failed",
        detail: error.message,
        traceId: trace.id,
        timestamp: Date.now()
      });
    }
    this.events.emit("trace", trace);
  }

  addAlert(alert) {
    this.alerts.push(alert);
    while (this.alerts.length > this.config.alertLimit) {
      this.alerts.shift();
    }
    this.events.emit("alert", alert);
  }

  addAudit(entry) {
    this.audit.push(entry);
    while (this.audit.length > this.config.auditLimit) {
      this.audit.shift();
    }
    this.events.emit("audit", entry);
  }

  getTraffic() {
    return [...this.traffic];
  }

  getTraces() {
    return [...this.traces];
  }

  getPackets() {
    return [...this.packets];
  }

  getPacket(id) {
    return this.packetIndex.get(id) || null;
  }

  getPacketLineage(id) {
    const lineage = [];
    const seen = new Set();
    const walk = (packetId) => {
      if (!packetId || seen.has(packetId)) {
        return;
      }
      seen.add(packetId);
      const packet = this.packetIndex.get(packetId);
      if (!packet) {
        return;
      }
      lineage.push(packet);
      for (const parent of packet.parents || []) {
        walk(parent);
      }
    };
    walk(id);
    return lineage;
  }

  getAlerts() {
    return [...this.alerts];
  }

  getAudit() {
    return [...this.audit];
  }
}
