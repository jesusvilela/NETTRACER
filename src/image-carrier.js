import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_TEXT_TYPES = new Set(["tEXt", "zTXt", "iTXt"]);
const PNG_IEND = "IEND";
const PNG_ITXT = "iTXt";
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf
]);

export function extractPngCarrierData(buffer) {
  if (buffer.byteLength < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("invalid_png_signature");
  }
  const chunks = scanPngChunks(buffer);
  const textEntries = [];
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;

  for (const chunk of chunks) {
    if (chunk.type === "IHDR" && chunk.data.length >= 13) {
      width = chunk.data.readUInt32BE(0);
      height = chunk.data.readUInt32BE(4);
      bitDepth = chunk.data.readUInt8(8);
      colorType = chunk.data.readUInt8(9);
    }
    if (PNG_TEXT_TYPES.has(chunk.type)) {
      const decoded = decodePngTextChunk(chunk);
      if (decoded) {
        textEntries.push(decoded);
      }
    }
  }

  const carriers = detectS1CarrierEntries(textEntries);
  return {
    structure: {
      width,
      height,
      bitDepth,
      colorType,
      aspectRatio: Number((width / Math.max(1, height)).toFixed(4)),
      pixelCount: width * height,
      chunkCount: chunks.length
    },
    chunks: chunks.map((chunk) => ({ type: chunk.type, length: chunk.length })),
    textEntries,
    carrier: buildCarrierSummary("png", textEntries, carriers)
  };
}

export function extractJpegCarrierData(buffer) {
  if (buffer.byteLength < 4 || buffer.readUInt16BE(0) !== 0xffd8) {
    throw new Error("invalid_jpeg_signature");
  }

  let offset = 2;
  let width = 0;
  let height = 0;
  const comments = [];
  const appMarkers = [];
  const entries = [];

  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let marker = buffer[offset + 1];
    while (marker === 0xff && offset + 2 < buffer.length) {
      offset += 1;
      marker = buffer[offset + 1];
    }
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;

    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    const data = buffer.subarray(offset + 2, offset + length);

    if (SOF_MARKERS.has(marker) && data.length >= 5) {
      height = data.readUInt16BE(1);
      width = data.readUInt16BE(3);
    }

    if (marker === 0xfe) {
      const text = decodeTextPayload(data);
      comments.push(text);
      entries.push({
        type: "COM",
        keyword: "comment",
        languageTag: "",
        text,
        compressed: false
      });
    } else if (marker >= 0xe0 && marker <= 0xef) {
      const appName = `APP${marker - 0xe0}`;
      const text = decodeTextPayload(data.subarray(0, Math.min(data.length, 512)));
      appMarkers.push({ marker: appName, size: data.length, preview: summarizeText(text, 180) });
      entries.push({
        type: appName,
        keyword: appName.toLowerCase(),
        languageTag: "",
        text,
        compressed: false
      });
    }

    offset += length;
  }

  const carriers = detectS1CarrierEntries(entries);
  return {
    structure: {
      width,
      height,
      aspectRatio: Number((width / Math.max(1, height)).toFixed(4)),
      pixelCount: width * height,
      commentCount: comments.length,
      appMarkerCount: appMarkers.length
    },
    comments,
    appMarkers,
    carrier: buildCarrierSummary("jpeg", entries, carriers)
  };
}

export function embedS1Carrier({ filePath, payload, keyword = "s1.carrier" }) {
  const resolved = path.resolve(String(filePath || "").trim());
  const buffer = fs.readFileSync(resolved);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`carrier_embed_requires_png:${resolved}`);
  }

  const chunks = scanPngChunks(buffer);
  const filtered = chunks.filter((chunk) => {
    if (!PNG_TEXT_TYPES.has(chunk.type)) return true;
    const decoded = decodePngTextChunk(chunk);
    return !decoded || decoded.keyword !== keyword;
  });

  const out = [buffer.subarray(0, 8)];
  for (const chunk of filtered) {
    if (chunk.type === PNG_IEND) {
      out.push(buildPngITXtChunk(keyword, String(payload || "")));
    }
    out.push(serializePngChunk(chunk.type, chunk.data));
  }

  fs.writeFileSync(resolved, Buffer.concat(out));
  return {
    filePath: resolved,
    keyword,
    bytesWritten: Buffer.byteLength(String(payload || ""), "utf8")
  };
}

function scanPngChunks(buffer) {
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (crcEnd > buffer.length) {
      throw new Error("png_chunk_overflow");
    }
    chunks.push({
      type,
      length,
      data: buffer.subarray(dataStart, dataEnd)
    });
    offset = crcEnd;
    if (type === PNG_IEND) break;
  }
  return chunks;
}

function decodePngTextChunk(chunk) {
  if (chunk.type === "tEXt") {
    const nul = chunk.data.indexOf(0x00);
    if (nul <= 0) return null;
    return {
      type: chunk.type,
      keyword: chunk.data.subarray(0, nul).toString("latin1"),
      languageTag: "",
      text: chunk.data.subarray(nul + 1).toString("latin1"),
      compressed: false
    };
  }

  if (chunk.type === "zTXt") {
    const nul = chunk.data.indexOf(0x00);
    if (nul <= 0 || nul + 2 > chunk.data.length) return null;
    const keyword = chunk.data.subarray(0, nul).toString("latin1");
    const compressionMethod = chunk.data[nul + 1];
    if (compressionMethod !== 0) return null;
    const compressed = chunk.data.subarray(nul + 2);
    return {
      type: chunk.type,
      keyword,
      languageTag: "",
      text: zlib.inflateSync(compressed).toString("utf8"),
      compressed: true
    };
  }

  if (chunk.type === PNG_ITXT) {
    let cursor = 0;
    const keywordEnd = chunk.data.indexOf(0x00, cursor);
    if (keywordEnd <= 0) return null;
    const keyword = chunk.data.subarray(cursor, keywordEnd).toString("latin1");
    cursor = keywordEnd + 1;
    if (cursor + 2 > chunk.data.length) return null;
    const compressionFlag = chunk.data[cursor];
    const compressionMethod = chunk.data[cursor + 1];
    cursor += 2;

    const languageEnd = chunk.data.indexOf(0x00, cursor);
    if (languageEnd < 0) return null;
    const languageTag = chunk.data.subarray(cursor, languageEnd).toString("latin1");
    cursor = languageEnd + 1;

    const translatedEnd = chunk.data.indexOf(0x00, cursor);
    if (translatedEnd < 0) return null;
    cursor = translatedEnd + 1;

    const payload = chunk.data.subarray(cursor);
    const text = compressionFlag === 1 && compressionMethod === 0
      ? zlib.inflateSync(payload).toString("utf8")
      : payload.toString("utf8");

    return {
      type: chunk.type,
      keyword,
      languageTag,
      text,
      compressed: compressionFlag === 1
    };
  }

  return null;
}

function buildCarrierSummary(format, entries, carriers) {
  return {
    format,
    detected: carriers.length > 0,
    validS1: carriers.some((entry) => entry.validS1),
    entryCount: entries.length,
    carriers: carriers.map((entry) => ({
      keyword: entry.keyword,
      type: entry.type,
      validS1: entry.validS1,
      preview: summarizeText(entry.text, 220)
    }))
  };
}

function detectS1CarrierEntries(entries) {
  return entries
    .map((entry) => ({
      ...entry,
      validS1: looksLikeS1(entry.text)
    }))
    .filter((entry) => entry.validS1 || /(^|[._-])s1([._-]|$)/i.test(entry.keyword || ""));
}

function looksLikeS1(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (/§S1\{/.test(value)) return true;
  if (/§FRAME\{/.test(value)) return true;
  if (/§PACK\{/.test(value)) return true;
  if (/\"version\"\s*:\s*\"s1\"/i.test(value)) return true;
  return false;
}

function buildPngITXtChunk(keyword, text) {
  const keywordBuffer = Buffer.from(String(keyword || "s1.carrier"), "latin1");
  if (keywordBuffer.length === 0 || keywordBuffer.length > 79) {
    throw new Error("png_itxt_keyword_out_of_range");
  }
  const textBuffer = Buffer.from(String(text || ""), "utf8");
  const data = Buffer.concat([
    keywordBuffer,
    Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]),
    textBuffer
  ]);
  return serializePngChunk(PNG_ITXT, data);
}

function serializePngChunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, 4, "ascii");
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([header, data, crcBuffer]);
}

function decodeTextPayload(buffer) {
  try {
    return buffer.toString("utf8").replace(/\u0000/g, "").trim();
  } catch {
    return buffer.toString("latin1").replace(/\u0000/g, "").trim();
  }
}

function summarizeText(text, max) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

const CRC32_TABLE = buildCrc32Table();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}
