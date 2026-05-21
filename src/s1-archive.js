import path from "node:path";
import zlib from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { summarize } from "./packet.js";

export class S1Archive {
  constructor({ config, traceStore, controlPlane }) {
    this.config = config;
    this.traceStore = traceStore;
    this.controlPlane = controlPlane;
    this.dbPath = path.join(config.stateDir, "s1-archive.sqlite");
    this.db = new DatabaseSync(this.dbPath);
    this.stats = {
      lastIngestAt: 0,
      lastError: null,
      ingestedPackets: 0
    };
    this.initSchema();
    this.unsubscribe = this.traceStore.registerPacketSink((packet) => this.onPacket(packet));
  }

  initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS s1_packets (
        id TEXT PRIMARY KEY,
        ts INTEGER NOT NULL,
        packet_type TEXT NOT NULL,
        route TEXT,
        model TEXT,
        digest TEXT,
        raw_bytes INTEGER NOT NULL,
        compressed_bytes INTEGER NOT NULL,
        payload_gzip BLOB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_s1_packets_ts ON s1_packets(ts DESC);
      CREATE INDEX IF NOT EXISTS idx_s1_packets_type ON s1_packets(packet_type, ts DESC);
      CREATE INDEX IF NOT EXISTS idx_s1_packets_route ON s1_packets(route, ts DESC);
    `);
  }

  getPolicy() {
    return this.controlPlane.getPolicies().archive || {
      enabled: true,
      autoIngest: true,
      compression: "gzip",
      compressionLevel: 9
    };
  }

  onPacket(packet) {
    const policy = this.getPolicy();
    if (!policy.enabled || !policy.autoIngest) return;
    this.insertPacket(packet, policy, false);
  }

  insertPacket(packet, policy, overwrite = false) {
    const json = JSON.stringify(packet);
    const raw = Buffer.from(json, "utf8");
    const compressed = zlib.gzipSync(raw, { level: Number(policy.compressionLevel || 9) });
    const ts = Number(Date.parse(packet.timestamp || "")) || Date.now();
    const statement = overwrite
      ? this.db.prepare(`
          INSERT INTO s1_packets (id, ts, packet_type, route, model, digest, raw_bytes, compressed_bytes, payload_gzip)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            ts=excluded.ts,
            packet_type=excluded.packet_type,
            route=excluded.route,
            model=excluded.model,
            digest=excluded.digest,
            raw_bytes=excluded.raw_bytes,
            compressed_bytes=excluded.compressed_bytes,
            payload_gzip=excluded.payload_gzip
        `)
      : this.db.prepare(`
          INSERT OR IGNORE INTO s1_packets (id, ts, packet_type, route, model, digest, raw_bytes, compressed_bytes, payload_gzip)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

    try {
      const result = statement.run(
        String(packet.id || `s1_${Date.now()}`),
        ts,
        String(packet.packetType || ""),
        String(packet.payload?.route || ""),
        String(packet.payload?.model || ""),
        String(packet.digest || ""),
        raw.byteLength,
        compressed.byteLength,
        compressed
      );
      if (result.changes > 0) {
        this.stats.lastIngestAt = Date.now();
        this.stats.ingestedPackets += 1;
      }
      return result.changes;
    } catch (error) {
      this.stats.lastError = error.message;
      return 0;
    }
  }

  compactFromTrace(limit = 1000) {
    const policy = this.getPolicy();
    const packets = this.traceStore.getPackets().slice(-Math.max(1, Math.min(10000, Number(limit) || 1000)));
    let inserted = 0;
    for (const packet of packets) {
      inserted += this.insertPacket(packet, policy, false);
    }
    return {
      requested: packets.length,
      inserted,
      skipped: Math.max(0, packets.length - inserted)
    };
  }

  prune(keepLatest = 5000) {
    const keep = Math.max(100, Math.min(250000, Number(keepLatest) || 5000));
    const result = this.db.prepare(`
      DELETE FROM s1_packets
      WHERE id IN (
        SELECT id FROM s1_packets
        ORDER BY ts DESC
        LIMIT -1 OFFSET ?
      )
    `).run(keep);
    return { keepLatest: keep, deleted: result.changes || 0 };
  }

  getRecent(limit = 40) {
    const max = Math.max(1, Math.min(400, Number(limit) || 40));
    const rows = this.db.prepare(`
      SELECT id, ts, packet_type AS packetType, route, model, raw_bytes AS rawBytes, compressed_bytes AS compressedBytes
      FROM s1_packets
      ORDER BY ts DESC
      LIMIT ?
    `).all(max);
    return rows.map((row) => ({
      ...row,
      compressionRatio: row.rawBytes > 0 ? Number((row.compressedBytes / row.rawBytes).toFixed(4)) : 1
    }));
  }

  getPacket(id) {
    const row = this.db.prepare(`
      SELECT id, ts, packet_type AS packetType, route, model, digest, raw_bytes AS rawBytes, compressed_bytes AS compressedBytes, payload_gzip AS payload
      FROM s1_packets
      WHERE id = ?
    `).get(String(id || ""));
    if (!row) return null;
    const decompressed = zlib.gunzipSync(row.payload);
    const packet = JSON.parse(decompressed.toString("utf8"));
    return {
      id: row.id,
      ts: row.ts,
      packetType: row.packetType,
      route: row.route,
      model: row.model,
      digest: row.digest,
      rawBytes: row.rawBytes,
      compressedBytes: row.compressedBytes,
      compressionRatio: row.rawBytes > 0 ? Number((row.compressedBytes / row.rawBytes).toFixed(4)) : 1,
      packet
    };
  }

  getInsights(options = {}) {
    const windowHours = clampNumber(options.windowHours, 168, 1, 24 * 90);
    const bucketCount = clampNumber(options.bucketCount, 28, 6, 96);
    const sampleLimit = clampNumber(options.sampleLimit, 14, 4, 48);
    const decodeLimit = clampNumber(options.decodeLimit, 160, sampleLimit, 320);
    const topLimit = clampNumber(options.topLimit, 8, 3, 24);
    const now = Date.now();
    const sinceTs = Math.max(0, now - (windowHours * 60 * 60 * 1000));
    const totalWindowMs = Math.max(60 * 60 * 1000, now - sinceTs);
    const bucketMs = Math.max(5 * 60 * 1000, Math.ceil(totalWindowMs / bucketCount / (5 * 60 * 1000)) * (5 * 60 * 1000));
    const summary = this.db.prepare(`
      SELECT
        COUNT(*) AS packetCount,
        COALESCE(SUM(raw_bytes), 0) AS rawBytes,
        COALESCE(SUM(compressed_bytes), 0) AS compressedBytes,
        COALESCE(COUNT(DISTINCT packet_type), 0) AS packetTypes,
        COALESCE(COUNT(DISTINCT NULLIF(route, '')), 0) AS routes,
        COALESCE(COUNT(DISTINCT NULLIF(model, '')), 0) AS models,
        COALESCE(COUNT(DISTINCT digest), 0) AS digests
      FROM s1_packets
      WHERE ts >= ?
    `).get(sinceTs);
    const fullRange = this.db.prepare(`
      SELECT
        COUNT(*) AS packetCount,
        COALESCE(MIN(ts), 0) AS oldestTs,
        COALESCE(MAX(ts), 0) AS latestTs
      FROM s1_packets
    `).get();

    const byType = this.queryGrouped("packet_type", sinceTs, topLimit, "packetType");
    const byRoute = this.queryGrouped("route", sinceTs, topLimit, "route", "route <> ''");
    const byModel = this.queryGrouped("model", sinceTs, topLimit, "model", "model <> ''");
    const timelineRows = this.db.prepare(`
      SELECT
        CAST(ts / ? AS INTEGER) * ? AS bucketTs,
        COUNT(*) AS count,
        COALESCE(SUM(raw_bytes), 0) AS rawBytes,
        COALESCE(SUM(compressed_bytes), 0) AS compressedBytes
      FROM s1_packets
      WHERE ts >= ?
      GROUP BY bucketTs
      ORDER BY bucketTs ASC
    `).all(bucketMs, bucketMs, sinceTs);

    const decodedRows = this.db.prepare(`
      SELECT id, ts, packet_type AS packetType, route, model, digest, raw_bytes AS rawBytes, compressed_bytes AS compressedBytes, payload_gzip AS payload
      FROM s1_packets
      WHERE ts >= ?
      ORDER BY ts DESC
      LIMIT ?
    `).all(sinceTs, decodeLimit).map((row) => this.decodePacketRow(row)).filter(Boolean);

    const stageCounts = new Map();
    const labelCounts = new Map();
    const actorCounts = new Map();
    const clientCounts = new Map();
    const motifCounts = new Map();
    let signedCount = 0;
    let proofCount = 0;
    let intentCount = 0;

    for (const row of decodedRows) {
      const packet = row.packet || {};
      const stageName = packet.payload?.stage?.name || "unstaged";
      const routeName = row.route || "unrouted";
      const motif = `${row.packetType} | ${routeName} | ${stageName}`;
      incrementMap(stageCounts, stageName);
      incrementMap(actorCounts, packet.actor || "anonymous");
      incrementMap(clientCounts, packet.clientId || "unknown-client");
      incrementMap(motifCounts, motif);
      if (Array.isArray(packet.payload?.labels)) {
        for (const label of packet.payload.labels.slice(0, 8)) {
          incrementMap(labelCounts, String(label || "").trim() || "unlabeled");
        }
      }
      if (packet.signature) signedCount += 1;
      if (packet.payload?.proof || (packet.payload?.metadata && packet.payload.metadata.terminal)) proofCount += 1;
      if (String(packet.payload?.intent || "").trim()) intentCount += 1;
    }

    const qualitativeCards = decodedRows.slice(0, sampleLimit).map((row) => {
      const packet = row.packet || {};
      const payload = packet.payload || {};
      const stage = payload.stage || {};
      const metadataKeys = payload.metadata ? Object.keys(payload.metadata).slice(0, 6) : [];
      const proofKeys = payload.proof ? Object.keys(payload.proof).slice(0, 6) : [];
      return {
        id: row.id,
        ts: row.ts,
        packetType: row.packetType,
        route: row.route || "unrouted",
        model: row.model || "unmodelled",
        actor: packet.actor || "anonymous",
        clientId: packet.clientId || "unknown-client",
        stageName: stage.name || "unstaged",
        stageDetail: stage.detail || "",
        labels: Array.isArray(payload.labels) ? payload.labels.slice(0, 5) : [],
        intentExcerpt: summarize(payload.intent || "", 220),
        metadataKeys,
        proofKeys,
        summary: buildPacketSummary(row.packetType, stage, payload, metadataKeys, proofKeys)
      };
    });

    const packetCount = Number(summary.packetCount || 0);
    const rawBytes = Number(summary.rawBytes || 0);
    const compressedBytes = Number(summary.compressedBytes || 0);
    return {
      window: {
        now,
        sinceTs,
        windowHours,
        bucketCount,
        bucketMs
      },
      availableRange: {
        packetCount: Number(fullRange.packetCount || 0),
        oldestTs: Number(fullRange.oldestTs || 0),
        latestTs: Number(fullRange.latestTs || 0)
      },
      quantitative: {
        packetCount,
        rawBytes,
        compressedBytes,
        compressionRatio: rawBytes > 0 ? Number((compressedBytes / rawBytes).toFixed(4)) : 1,
        packetTypes: Number(summary.packetTypes || 0),
        routes: Number(summary.routes || 0),
        models: Number(summary.models || 0),
        digests: Number(summary.digests || 0),
        byType,
        byRoute,
        byModel,
        timeline: timelineRows.map((row) => ({
          bucketTs: Number(row.bucketTs || 0),
          count: Number(row.count || 0),
          rawBytes: Number(row.rawBytes || 0),
          compressedBytes: Number(row.compressedBytes || 0),
          compressionRatio: Number(row.rawBytes || 0) > 0 ? Number((Number(row.compressedBytes || 0) / Number(row.rawBytes || 0)).toFixed(4)) : 1
        }))
      },
      qualitative: {
        decodedWindow: decodedRows.length,
        signedRatio: decodedRows.length > 0 ? Number((signedCount / decodedRows.length).toFixed(4)) : 0,
        proofRatio: decodedRows.length > 0 ? Number((proofCount / decodedRows.length).toFixed(4)) : 0,
        intentRatio: decodedRows.length > 0 ? Number((intentCount / decodedRows.length).toFixed(4)) : 0,
        stages: topEntries(stageCounts, topLimit),
        labels: topEntries(labelCounts, topLimit + 4),
        actors: topEntries(actorCounts, topLimit),
        clients: topEntries(clientCounts, topLimit),
        motifs: topEntries(motifCounts, topLimit + 2),
        cards: qualitativeCards
      }
    };
  }

  getStatus() {
    const summary = this.db.prepare(`
      SELECT
        COUNT(*) AS packetCount,
        COALESCE(SUM(raw_bytes), 0) AS rawBytes,
        COALESCE(SUM(compressed_bytes), 0) AS compressedBytes,
        COALESCE(MAX(ts), 0) AS latestTs,
        COALESCE(MIN(ts), 0) AS oldestTs
      FROM s1_packets
    `).get();
    const policy = this.getPolicy();
    const packetCount = Number(summary.packetCount || 0);
    const rawBytes = Number(summary.rawBytes || 0);
    const compressedBytes = Number(summary.compressedBytes || 0);
    return {
      dbPath: this.dbPath,
      policy,
      packetCount,
      rawBytes,
      compressedBytes,
      compressionRatio: rawBytes > 0 ? Number((compressedBytes / rawBytes).toFixed(4)) : 1,
      latestTs: Number(summary.latestTs || 0),
      oldestTs: Number(summary.oldestTs || 0),
      lastIngestAt: this.stats.lastIngestAt,
      ingestedPackets: this.stats.ingestedPackets,
      lastError: this.stats.lastError
    };
  }

  queryGrouped(column, sinceTs, limit, alias, extraWhere = null) {
    const where = extraWhere ? `ts >= ? AND ${extraWhere}` : "ts >= ?";
    const rows = this.db.prepare(`
      SELECT
        ${column} AS value,
        COUNT(*) AS count,
        COALESCE(SUM(raw_bytes), 0) AS rawBytes,
        COALESCE(SUM(compressed_bytes), 0) AS compressedBytes
      FROM s1_packets
      WHERE ${where}
      GROUP BY ${column}
      ORDER BY count DESC, value ASC
      LIMIT ?
    `).all(sinceTs, limit);
    return rows.map((row) => ({
      [alias]: row.value || "",
      count: Number(row.count || 0),
      rawBytes: Number(row.rawBytes || 0),
      compressedBytes: Number(row.compressedBytes || 0),
      compressionRatio: Number(row.rawBytes || 0) > 0 ? Number((Number(row.compressedBytes || 0) / Number(row.rawBytes || 0)).toFixed(4)) : 1
    }));
  }

  decodePacketRow(row) {
    try {
      const decompressed = zlib.gunzipSync(row.payload);
      return {
        ...row,
        packet: JSON.parse(decompressed.toString("utf8"))
      };
    } catch (error) {
      this.stats.lastError = error.message;
      return null;
    }
  }
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function incrementMap(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function topEntries(map, limit) {
  return [...map.entries()]
    .sort((left, right) => (right[1] - left[1]) || String(left[0]).localeCompare(String(right[0])))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function buildPacketSummary(packetType, stage, payload, metadataKeys, proofKeys) {
  const phrases = [];
  if (stage?.name) phrases.push(`${stage.name}${stage.detail ? `:${stage.detail}` : ""}`);
  if (payload.route) phrases.push(`route ${payload.route}`);
  if (payload.model) phrases.push(`model ${payload.model}`);
  if (metadataKeys.length) phrases.push(`metadata ${metadataKeys.join(", ")}`);
  if (proofKeys.length) phrases.push(`proof ${proofKeys.join(", ")}`);
  if (String(payload.intent || "").trim()) phrases.push("intentful payload");
  return `${packetType} :: ${phrases.join(" · ") || "opaque packet"}`;
}
