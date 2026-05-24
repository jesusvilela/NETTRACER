import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_CANDIDATES = [
  "H:\\TRASGONET\\netracer\\data\\state\\s1-archive.sqlite",
  "H:\\TRASGONET\\netracer\\data-dashboard\\state\\s1-archive.sqlite",
  "H:\\TRASGONET\\netracer\\data\\state-backups\\visibility-20260421-104113\\state\\s1-archive.sqlite",
  "H:\\TRASGONET\\netracer\\data\\state-backups\\restart-20260421-100847\\s1-archive.sqlite",
  "H:\\TRASGONET\\netracer\\data\\state-backups\\relaunch-20260421-183401\\s1-archive.sqlite"
];

export function resolveV13ArchiveSource({ archive = null, hours = 168, cwd = process.cwd() } = {}) {
  const liveStatus = archive?.getStatus?.() || null;
  if (Number(liveStatus?.packetCount || 0) > 0) {
    return {
      source: "runtime",
      archiveStatus: liveStatus,
      archiveInsights: archive.getInsights({
        windowHours: hours,
        bucketCount: 32,
        sampleLimit: 18,
        decodeLimit: 220,
        topLimit: 12
      }),
      recentPackets: archive.getRecent(48)
    };
  }

  const fallback = findBestArchiveCandidate({ cwd });
  if (!fallback) {
    return {
      source: "runtime-empty",
      archiveStatus: liveStatus,
      archiveInsights: null,
      recentPackets: []
    };
  }

  return {
    source: "fallback-readonly",
    fallbackPath: fallback.path,
    ...readArchiveReadonly(fallback.path, { hours })
  };
}

export function findBestArchiveCandidate({ cwd = process.cwd(), candidates = null } = {}) {
  const envCandidates = String(process.env.V13_S1_ARCHIVE_DB || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const localCandidates = [
    path.resolve(cwd, "data-v4", "state", "s1-archive.sqlite"),
    path.resolve(cwd, "data-v3", "state", "s1-archive.sqlite"),
    path.resolve(cwd, "data-v2", "state", "s1-archive.sqlite")
  ];
  const all = [...envCandidates, ...(candidates || DEFAULT_CANDIDATES), ...localCandidates];
  const scored = [];
  for (const filePath of unique(all)) {
    const summary = inspectArchiveCandidate(filePath);
    if (summary?.count > 0) scored.push(summary);
  }
  return scored.sort((a, b) => b.count - a.count)[0] || null;
}

export function inspectArchiveCandidate(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  let db = null;
  try {
    db = new DatabaseSync(filePath, { readOnly: true });
    const hasTable = Number(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='s1_packets'").get().count || 0) > 0;
    if (!hasTable) return null;
    const row = db.prepare(`
      SELECT COUNT(*) AS count,
             COALESCE(MIN(ts), 0) AS oldestTs,
             COALESCE(MAX(ts), 0) AS latestTs,
             COALESCE(SUM(raw_bytes), 0) AS rawBytes,
             COALESCE(SUM(compressed_bytes), 0) AS compressedBytes
      FROM s1_packets
    `).get();
    return {
      path: filePath,
      count: Number(row.count || 0),
      oldestTs: Number(row.oldestTs || 0),
      latestTs: Number(row.latestTs || 0),
      rawBytes: Number(row.rawBytes || 0),
      compressedBytes: Number(row.compressedBytes || 0)
    };
  } catch {
    return null;
  } finally {
    db?.close?.();
  }
}

export function readArchiveReadonly(filePath, { hours = 168 } = {}) {
  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    const archiveStatus = getStatus(db, filePath);
    return {
      archiveStatus,
      archiveInsights: getInsights(db, { hours }),
      recentPackets: getRecent(db, 48)
    };
  } finally {
    db.close();
  }
}

function getStatus(db, filePath) {
  const row = db.prepare(`
    SELECT COUNT(*) AS packetCount,
           COALESCE(SUM(raw_bytes), 0) AS rawBytes,
           COALESCE(SUM(compressed_bytes), 0) AS compressedBytes,
           COALESCE(MAX(ts), 0) AS latestTs,
           COALESCE(MIN(ts), 0) AS oldestTs
    FROM s1_packets
  `).get();
  const rawBytes = Number(row.rawBytes || 0);
  const compressedBytes = Number(row.compressedBytes || 0);
  return {
    dbPath: filePath,
    source: "fallback-readonly",
    packetCount: Number(row.packetCount || 0),
    rawBytes,
    compressedBytes,
    compressionRatio: rawBytes > 0 ? round(compressedBytes / rawBytes) : 1,
    latestTs: Number(row.latestTs || 0),
    oldestTs: Number(row.oldestTs || 0),
    readOnly: true
  };
}

function getRecent(db, limit = 48) {
  return db.prepare(`
    SELECT id, ts, packet_type AS packetType, route, model, raw_bytes AS rawBytes, compressed_bytes AS compressedBytes
    FROM s1_packets
    ORDER BY ts DESC
    LIMIT ?
  `).all(limit);
}

function getInsights(db, { hours = 168 } = {}) {
  const latest = Number(db.prepare("SELECT COALESCE(MAX(ts), 0) AS latestTs FROM s1_packets").get().latestTs || Date.now());
  const sinceTs = Math.max(0, latest - Math.max(1, Number(hours) || 168) * 60 * 60 * 1000);
  const summary = db.prepare(`
    SELECT COUNT(*) AS packetCount,
           COALESCE(SUM(raw_bytes), 0) AS rawBytes,
           COALESCE(SUM(compressed_bytes), 0) AS compressedBytes,
           COALESCE(COUNT(DISTINCT packet_type), 0) AS packetTypes,
           COALESCE(COUNT(DISTINCT NULLIF(route, '')), 0) AS routes,
           COALESCE(COUNT(DISTINCT NULLIF(model, '')), 0) AS models
    FROM s1_packets
    WHERE ts >= ?
  `).get(sinceTs);
  const decodedRows = db.prepare(`
    SELECT id, ts, packet_type AS packetType, route, model, digest, raw_bytes AS rawBytes, compressed_bytes AS compressedBytes, payload_gzip AS payload
    FROM s1_packets
    WHERE ts >= ?
    ORDER BY ts DESC
    LIMIT 220
  `).all(sinceTs).map(decodePacketRow).filter(Boolean);

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
    const payload = packet.payload || {};
    const stageName = payload.stage?.name || "unstaged";
    const routeName = row.route || "unrouted";
    increment(stageCounts, stageName);
    increment(actorCounts, packet.actor || "anonymous");
    increment(clientCounts, packet.clientId || "unknown-client");
    increment(motifCounts, `${row.packetType} | ${routeName} | ${stageName}`);
    for (const label of Array.isArray(payload.labels) ? payload.labels.slice(0, 8) : []) increment(labelCounts, label);
    if (packet.signature) signedCount += 1;
    if (payload.proof || payload.metadata?.terminal) proofCount += 1;
    if (String(payload.intent || "").trim()) intentCount += 1;
  }

  const rawBytes = Number(summary.rawBytes || 0);
  const compressedBytes = Number(summary.compressedBytes || 0);
  return {
    quantitative: {
      packetCount: Number(summary.packetCount || 0),
      rawBytes,
      compressedBytes,
      compressionRatio: rawBytes > 0 ? round(compressedBytes / rawBytes) : 1,
      packetTypes: Number(summary.packetTypes || 0),
      routes: Number(summary.routes || 0),
      models: Number(summary.models || 0),
      byType: groupBy(db, "packet_type", "packetType", sinceTs, 12),
      byRoute: groupBy(db, "route", "route", sinceTs, 12, "route <> ''"),
      byModel: groupBy(db, "model", "model", sinceTs, 12, "model <> ''"),
      timeline: []
    },
    qualitative: {
      decodedWindow: decodedRows.length,
      signedRatio: ratio(signedCount, decodedRows.length),
      proofRatio: ratio(proofCount, decodedRows.length),
      intentRatio: ratio(intentCount, decodedRows.length),
      stages: top(stageCounts, 12),
      labels: top(labelCounts, 16),
      actors: top(actorCounts, 12),
      clients: top(clientCounts, 12),
      motifs: top(motifCounts, 14),
      cards: decodedRows.slice(0, 18).map(toCard)
    }
  };
}

function groupBy(db, column, alias, sinceTs, limit, extraWhere = null) {
  const where = extraWhere ? `ts >= ? AND ${extraWhere}` : "ts >= ?";
  return db.prepare(`
    SELECT ${column} AS value, COUNT(*) AS count,
           COALESCE(SUM(raw_bytes), 0) AS rawBytes,
           COALESCE(SUM(compressed_bytes), 0) AS compressedBytes
    FROM s1_packets
    WHERE ${where}
    GROUP BY ${column}
    ORDER BY count DESC, value ASC
    LIMIT ?
  `).all(sinceTs, limit).map((row) => ({
    [alias]: row.value || "",
    count: Number(row.count || 0),
    rawBytes: Number(row.rawBytes || 0),
    compressedBytes: Number(row.compressedBytes || 0)
  }));
}

function decodePacketRow(row) {
  try {
    return {
      ...row,
      packet: JSON.parse(zlib.gunzipSync(row.payload).toString("utf8"))
    };
  } catch {
    return null;
  }
}

function toCard(row) {
  const packet = row.packet || {};
  const payload = packet.payload || {};
  const stage = payload.stage || {};
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
    summary: `${row.packetType} :: ${stage.name || "unstaged"}${row.route ? ` · route ${row.route}` : ""}${payload.intent ? " · intentful payload" : ""}`
  };
}

function increment(map, key) {
  map.set(String(key || "unknown"), (map.get(String(key || "unknown")) || 0) + 1);
}

function top(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function ratio(part, total) {
  return total > 0 ? round(part / total) : 0;
}

function summarize(text, max) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}...` : compact;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function round(value) {
  return Number(Number(value || 0).toFixed(4));
}
