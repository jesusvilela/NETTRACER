/*
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import fs from "node:fs";
import { resolve } from "node:path";

const JV_SIGNATURE = [1, 1, -1, -1];
const CRC32_TABLE = buildCrc32Table();
const juRamdiskDir = "C:\\nnn-hyperbolic-ramdisk\\target\\nnn-ramdisk";
const JV_CUDA_MANIFEST_PATH = "C:\\nnn-hyperbolic-ramdisk\\target\\nnn-ramdisk\\jv_cuda_manifest.json";

export const SLANG_DIALECT_MAP = {
  1: "real",
  2: "complex",
  4: "quaternion",
  8: "octonion",
  16: "sedenion",
  32: "trigintaduonion"
};

export const BIO_ANALOGIES = {
  real: {
    bio_analogy: "concentration",
    geometric_property: "scalar magnitude",
    operator: "§EMIT_1"
  },
  complex: {
    bio_analogy: "rhythm/phase",
    geometric_property: "planar rotation",
    operator: "§EMIT_2"
  },
  quaternion: {
    bio_analogy: "orientation",
    geometric_property: "3D rotational frame",
    operator: "§EMIT_4"
  },
  octonion: {
    bio_analogy: "branching",
    geometric_property: "non-associative branching flow",
    operator: "§EMIT_8"
  },
  sedenion: {
    bio_analogy: "inhibition",
    geometric_property: "zero-divisor inhibitory web",
    operator: "§EMIT_16"
  },
  trigintaduonion: {
    bio_analogy: "ecology",
    geometric_property: "32D ecosystem coupling",
    operator: "§EMIT_32"
  }
};

export function buildJvCartridge(nodeId, slangType, coord = [], mindQualities = {}) {
  const bio = BIO_ANALOGIES[slangType];
  if (!bio) {
    throw new Error("invalid_slang_type");
  }
  const normalizedCoord = to22(hadamard4(Array.isArray(coord) ? coord.slice(0, 4) : []));
  const qualities = normalizeMindQualities(mindQualities);
  return {
    id: `jv::${nodeId}`,
    coord: normalizedCoord,
    tangent: null,
    fiber: { qualities },
    hamiltonian: computeJvHamiltonian(normalizedCoord, qualities),
    neighbors: [],
    timestamp_ms: Date.now(),
    payload_ref: null,
    payload_inline: {
      node_id: nodeId,
      absorption: "jv-protocol",
      source: "jv-slang-bridge",
      mind_qualities: qualities
    },
    slang_type: slangType,
    bio_analogy: bio.bio_analogy,
    geometric_property: bio.geometric_property,
    operator: bio.operator
  };
}

export function absorbJvPayload({ node_id: nodeId, slang_type: slangType, coord = [], cuda_manifest = null, telemetry = {} } = {}) {
  if (!nodeId) {
    throw new Error("node_id_required");
  }
  if (!BIO_ANALOGIES[slangType]) {
    throw new Error("invalid_slang_type");
  }
  const node = buildJvCartridge(nodeId, slangType, coord, telemetry?.mind_qualities ?? telemetry?.mindQualities ?? telemetry?.qualities ?? telemetry);
  node.payload_inline = {
    ...node.payload_inline,
    coord,
    telemetry,
    cuda_manifest
  };
  const shardId = writeJvShardRecord(node);
  return { ok: true, shard_id: shardId, node };
}

export function getJvCudaManifest() {
  if (!fs.existsSync(JV_CUDA_MANIFEST_PATH)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(JV_CUDA_MANIFEST_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function getJvStats() {
  const shards = {};
  const slangTypes = {};
  let totalNodes = 0;
  for (let shardId = 0; shardId < 4; shardId += 1) {
    const logPath = resolve(juRamdiskDir, "shards", String(shardId), "jv_append.log");
    let count = 0;
    if (fs.existsSync(logPath)) {
      const rows = fs.readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean);
      count = rows.length;
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row);
          const slangType = parsed?.node?.slang_type;
          if (BIO_ANALOGIES[slangType]) {
            slangTypes[slangType] = (slangTypes[slangType] || 0) + 1;
          }
        } catch {
        }
      }
    }
    shards[String(shardId)] = count;
    totalNodes += count;
  }
  return { jvProtocol: { shards, total_nodes: totalNodes, slang_types: slangTypes } };
}

function normalizeMindQualities(mindQualities = {}) {
  const entries = flattenNumericMetrics(mindQualities);
  if (!entries.length) {
    return {};
  }
  return Object.fromEntries(entries.map(([key, value]) => [key.split(".").pop(), valueOrDefault(value)]));
}

function computeJvHamiltonian(coord, qualities) {
  const coordEnergy = coord.length ? coord.reduce((sum, value) => sum + Math.abs(value), 0) / coord.length : 0.5;
  const qualityValues = Object.values(qualities).map((value) => Math.abs(Number(value) || 0));
  const qualityEnergy = qualityValues.length ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length : 0.5;
  return (coordEnergy + qualityEnergy) / 2;
}

function shardIdFor(nodeId, coord) {
  const p = Math.abs(coord[0] || 0) + Math.abs(coord[1] || 0);
  const n = Math.abs(coord[2] || 0) + Math.abs(coord[3] || 0);
  const base = p >= n ? 0 : 2;
  return base + (String(nodeId).length % 2);
}

function writeJvShardRecord(node) {
  const nodeJson = JSON.stringify(node);
  const checksum = crc32(nodeJson);
  const shardId = shardIdFor(node.id, node.coord);
  const shardDir = resolve(juRamdiskDir, "shards", String(shardId));
  fs.mkdirSync(shardDir, { recursive: true });
  fs.appendFileSync(resolve(shardDir, "jv_append.log"), `${JSON.stringify({ checksum, node })}\n`, "utf8");
  return shardId;
}

function hadamard4(coord) {
  const [a0, a1, a2, a3] = [0, 0, 0, 0].map((value, index) => Number(coord[index] ?? value) || 0);
  const b0 = a0 + a2;
  const b1 = a1 + a3;
  const b2 = a0 - a2;
  const b3 = a1 - a3;
  return [(b0 + b1) / 2, (b0 - b1) / 2, (b2 + b3) / 2, (b2 - b3) / 2];
}

function to22(coord) {
  const signedNorm = Math.abs(coord.reduce((sum, value, index) => sum + ((Number(value) || 0) ** 2 * JV_SIGNATURE[index]), 0));
  const scale = Math.max(Math.sqrt(signedNorm), 1e-9);
  return coord.map((value) => (Number(value) || 0) / scale);
}

function flattenNumericMetrics(value, prefix = "") {
  const rows = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      rows.push(...flattenNumericMetrics(entry, `${prefix}[${index}]`));
    });
    return rows;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value).sort()) {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      rows.push(...flattenNumericMetrics(value[key], childPrefix));
    }
    return rows;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    rows.push([prefix || "value", numeric]);
  }
  return rows;
}

function valueOrDefault(value, fallback = 0.5) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function crc32(text) {
  let crc = 0 ^ -1;
  const buffer = Buffer.from(text, "utf8");
  for (let index = 0; index < buffer.length; index += 1) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buffer[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function buildCrc32Table() {
  const table = [];
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }
  return table;
}
