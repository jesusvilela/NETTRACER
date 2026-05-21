import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { embedHyperbolicGraph } from "./hyperbolic-engine.js";
import { embedS1Carrier, extractJpegCarrierData, extractPngCarrierData } from "./image-carrier.js";

const SUPPORTED_EXTENSIONS = new Set([".s1", ".ss1", ".txt", ".md", ".lang", ".png", ".jpg", ".jpeg", ".apk"]);
const MAX_RELATIONS = 220;
const MAX_ENTITIES = 140;

export function normalizeIncludeExtensions(include = []) {
  if (!Array.isArray(include) || include.length === 0) {
    return [...SUPPORTED_EXTENSIONS];
  }
  const normalized = [];
  for (const item of include) {
    const value = String(item || "").trim().toLowerCase();
    if (!value) continue;
    const ext = value.startsWith(".") ? value : `.${value}`;
    if (SUPPORTED_EXTENSIONS.has(ext)) {
      normalized.push(ext);
    }
  }
  return normalized.length > 0 ? [...new Set(normalized)] : [...SUPPORTED_EXTENSIONS];
}

export function collectScanTargets(targetPath, { recursive = true, include = [], maxFiles = 300, maxFileBytes = 2 * 1024 * 1024 } = {}) {
  const resolved = path.resolve(String(targetPath || "").trim());
  if (!resolved) throw new Error("invalid_scan_path");
  if (!fs.existsSync(resolved)) throw new Error(`scan_path_not_found:${resolved}`);

  const includeExtensions = new Set(normalizeIncludeExtensions(include));
  const files = [];
  const skipped = [];

  const walk = (current) => {
    if (files.length >= maxFiles) {
      return;
    }
    const stats = fs.statSync(current);
    if (stats.isDirectory()) {
      if (!recursive && current !== resolved) {
        return;
      }
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        walk(path.join(current, entry.name));
        if (files.length >= maxFiles) break;
      }
      return;
    }
    if (!stats.isFile()) {
      return;
    }
    const ext = path.extname(current).toLowerCase();
    if (!includeExtensions.has(ext)) {
      skipped.push({ path: current, reason: "extension_filtered" });
      return;
    }
    if (stats.size > maxFileBytes) {
      skipped.push({ path: current, reason: "file_too_large", sizeBytes: stats.size });
      return;
    }
    files.push({ path: current, ext, sizeBytes: stats.size });
  };

  walk(resolved);
  return { files, skipped, includeExtensions: [...includeExtensions] };
}

export function expandFileToS1({ filePath, hyperbolize = true, backend = "webgpu" }) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);
  const sha = crypto.createHash("sha256").update(buffer).digest("hex");
  const baseMeta = {
    source: filePath,
    extension: ext,
    sha256: sha,
    sizeBytes: buffer.byteLength,
    backend
  };

  if (ext === ".png") {
    const parsed = parsePng(buffer, filePath, baseMeta);
    if (hyperbolize) {
      parsed.meta.hyperbolic = buildHyperbolicProjection(parsed.entities, parsed.relations, sha, parsed.meta.structure);
    }
    return parsed;
  }

  if (ext === ".jpg" || ext === ".jpeg") {
    const parsed = parseJpeg(buffer, filePath, baseMeta);
    if (hyperbolize) {
      parsed.meta.hyperbolic = buildHyperbolicProjection(parsed.entities, parsed.relations, sha, parsed.meta.structure);
    }
    return parsed;
  }

  if (ext === ".apk") {
    const parsed = parseApk(buffer, filePath, baseMeta);
    if (hyperbolize) {
      parsed.meta.hyperbolic = buildHyperbolicProjection(parsed.entities, parsed.relations, sha, parsed.meta.structure);
    }
    return parsed;
  }

  const text = buffer.toString("utf8");
  const parsed = parseTextLike(text, filePath, ext, baseMeta);
  if (hyperbolize) {
    parsed.meta.hyperbolic = buildHyperbolicProjection(parsed.entities, parsed.relations, sha, parsed.meta.structure);
  }
  return parsed;
}

export { embedS1Carrier };

function parseTextLike(content, filePath, ext, baseMeta) {
  const normalized = content.replace(/\r\n?/g, "\n");
  const compact = normalized.replace(/\s+/g, " ").trim();
  const tokens = compact.match(/[A-Za-z0-9_'-]+/g) || [];
  const clauses = normalized
    .split(/(?:\n\s*\n|(?<=[.!?;:])\s+)/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const headings = ext === ".md"
    ? normalized
      .split("\n")
      .map((line) => line.match(/^#{1,6}\s+(.*)$/))
      .filter(Boolean)
      .map((match) => match[1].trim())
    : [];

  const markdownLinks = ext === ".md"
    ? [...normalized.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((match) => ({ label: match[1].trim(), url: match[2].trim() }))
    : [];

  const sectionTags = [...new Set((normalized.match(/§[A-Za-z0-9_|.+-]+/g) || []).map((item) => item.slice(1)))];
  const rewrites = normalized.match(/(?:->|=>|::=|→)/g) || [];

  const digestPrefix = baseMeta.sha256.slice(0, 8);
  const entities = {};
  const relations = [];
  const docId = `doc_${digestPrefix}`;
  entities[docId] = [path.basename(filePath), "document"];

  const limitedHeadings = headings.slice(0, 24);
  const limitedClauses = clauses.slice(0, 48);
  const limitedTags = sectionTags.slice(0, 24);

  limitedHeadings.forEach((heading, index) => {
    const id = `h_${digestPrefix}_${index}`;
    entities[id] = [heading, "heading"];
    relations.push(`${docId}→${id}:contains`);
  });

  limitedClauses.forEach((clause, index) => {
    const id = `c_${digestPrefix}_${index}`;
    entities[id] = [summarize(clause, 120), "clause"];
    relations.push(`${docId}→${id}:contains`);
    if (index > 0) {
      const prevId = `c_${digestPrefix}_${index - 1}`;
      relations.push(`${prevId}→${id}:rewrites`);
    }
  });

  limitedTags.forEach((tag, index) => {
    const id = `t_${digestPrefix}_${index}`;
    entities[id] = [tag, "section-tag"];
    relations.push(`${docId}→${id}:annotates`);
  });

  markdownLinks.slice(0, 24).forEach((link, index) => {
    const id = `l_${digestPrefix}_${index}`;
    entities[id] = [link.label || link.url, "link"];
    relations.push(`${docId}→${id}:references`);
  });

  trimGraph(entities, relations);

  const clauseLengths = limitedClauses.map((clause) => (clause.match(/[A-Za-z0-9_'-]+/g) || []).length);
  const avgClauseLength = clauseLengths.length > 0
    ? clauseLengths.reduce((sum, value) => sum + value, 0) / clauseLengths.length
    : 0;
  const headingDensity = limitedHeadings.length / Math.max(1, limitedClauses.length);
  const rewriteDensity = rewrites.length / Math.max(1, limitedClauses.length);
  const branchEstimate = Number((1 + headingDensity * 2 + rewriteDensity * 3).toFixed(3));

  const structure = {
    tokenCount: tokens.length,
    clauseCount: clauses.length,
    headingCount: headings.length,
    sectionTagCount: sectionTags.length,
    markdownLinkCount: markdownLinks.length,
    avgClauseLength: Number(avgClauseLength.toFixed(2)),
    rewriteDensity: Number(rewriteDensity.toFixed(4)),
    branchFactor: branchEstimate,
    phraseDepth: estimatePhraseDepth(normalized)
  };

  return {
    kind: ext === ".s1" || ext === ".ss1" ? "script" : ext === ".md" ? "markdown" : ext === ".lang" ? "lang" : "text",
    entities,
    relations,
    preview: summarize(compact, 260),
    meta: {
      ...baseMeta,
      modality: "textual",
      structure,
      chomsky: {
        normalFormHint: structure.rewriteDensity > 0 ? "rewrite-rich" : "free-form",
        nonTerminalEstimate: Math.min(structure.clauseCount, 96),
        terminalEstimate: structure.tokenCount,
        branchingEntropy: Number((Math.log2(Math.max(2, structure.branchFactor + 1))).toFixed(4))
      }
    }
  };
}

function parsePng(buffer, filePath, baseMeta) {
  const parsed = extractPngCarrierData(buffer);
  const { width, height, bitDepth, colorType } = parsed.structure;
  const digestPrefix = baseMeta.sha256.slice(0, 8);

  const imgId = `img_${digestPrefix}`;
  const rasterId = `ras_${digestPrefix}`;
  const entities = {
    [imgId]: [path.basename(filePath), "optical"],
    [rasterId]: [`${width}x${height}`, "raster"]
  };
  const relations = [`${imgId}→${rasterId}:encodes`];

  const structure = { ...parsed.structure };

  parsed.textEntries.slice(0, 16).forEach((entry, index) => {
    const textId = `pngtxt_${digestPrefix}_${index}`;
    entities[textId] = [entry.keyword || `text-${index}`, "png-text"];
    relations.push(`${imgId}→${textId}:annotates`);
  });

  parsed.carrier.carriers.slice(0, 8).forEach((entry, index) => {
    const carrierId = `pngc_${digestPrefix}_${index}`;
    entities[carrierId] = [summarize(entry.preview || entry.keyword || "carrier", 96), entry.validS1 ? "s1-carrier" : "carrier"];
    relations.push(`${imgId}→${carrierId}:steganographic-carrier`);
  });

  return {
    kind: "image",
    entities,
    relations,
    preview: `${path.basename(filePath)} ${width}x${height} png`,
    meta: {
      ...baseMeta,
      modality: "vision",
      extraction: parsed.carrier.detected ? "png-structural-scan+carrier" : "png-structural-scan",
      structure,
      carrier: parsed.carrier,
      textChunks: parsed.textEntries.map((entry) => ({
        type: entry.type,
        keyword: entry.keyword,
        preview: summarize(entry.text, 180)
      }))
    }
  };
}

function parseJpeg(buffer, filePath, baseMeta) {
  const parsed = extractJpegCarrierData(buffer);
  const { width, height } = parsed.structure;
  const digestPrefix = baseMeta.sha256.slice(0, 8);

  const imgId = `jpg_${digestPrefix}`;
  const rasterId = `jras_${digestPrefix}`;
  const entities = {
    [imgId]: [path.basename(filePath), "optical"],
    [rasterId]: [`${width}x${height}`, "raster"]
  };
  const relations = [`${imgId}→${rasterId}:encodes`];

  parsed.comments.slice(0, 8).forEach((comment, index) => {
    const commentId = `jpgc_${digestPrefix}_${index}`;
    entities[commentId] = [summarize(comment, 96), "jpeg-comment"];
    relations.push(`${imgId}→${commentId}:annotates`);
  });

  parsed.carrier.carriers.slice(0, 6).forEach((entry, index) => {
    const carrierId = `jpgs1_${digestPrefix}_${index}`;
    entities[carrierId] = [summarize(entry.preview || entry.keyword || "carrier", 96), entry.validS1 ? "s1-carrier" : "carrier"];
    relations.push(`${imgId}→${carrierId}:steganographic-carrier`);
  });

  return {
    kind: "image",
    entities,
    relations,
    preview: `${path.basename(filePath)} ${width}x${height} jpeg`,
    meta: {
      ...baseMeta,
      modality: "vision",
      extraction: parsed.carrier.detected ? "jpeg-structural-scan+carrier" : "jpeg-structural-scan",
      structure: parsed.structure,
      carrier: parsed.carrier,
      comments: parsed.comments.slice(0, 12).map((comment) => summarize(comment, 180)),
      appMarkers: parsed.appMarkers.slice(0, 8)
    }
  };
}

function parseApk(buffer, filePath, baseMeta) {
  if (buffer.byteLength < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`invalid_apk:${filePath}`);
  }

  const entries = [];
  let offset = 0;
  while (offset + 30 <= buffer.length && entries.length < 96) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) break;
    const name = buffer.subarray(nameStart, nameEnd).toString("utf8");
    entries.push({
      name,
      compressedSize,
      uncompressedSize
    });
    offset = nameEnd + extraLength + compressedSize;
  }

  const digestPrefix = baseMeta.sha256.slice(0, 8);
  const apkId = `apk_${digestPrefix}`;
  const entities = {
    [apkId]: [path.basename(filePath), "apk"]
  };
  const relations = [];
  const packageHints = new Set();
  const permissionHints = new Set();

  for (const [index, entry] of entries.slice(0, 40).entries()) {
    const entryId = `apkf_${digestPrefix}_${index}`;
    entities[entryId] = [entry.name, classifyApkEntry(entry.name)];
    relations.push(`${apkId}→${entryId}:contains`);
    if (entry.name.startsWith("lib/")) {
      const abi = entry.name.split("/")[1];
      if (abi) packageHints.add(`abi:${abi}`);
    }
    if (entry.name.startsWith("res/xml/") || entry.name.includes("manifest")) {
      permissionHints.add(entry.name);
    }
    if (entry.name.startsWith("classes")) {
      packageHints.add("dex:present");
    }
  }

  [...packageHints].slice(0, 12).forEach((hint, index) => {
    const id = `apkh_${digestPrefix}_${index}`;
    entities[id] = [hint, "apk-hint"];
    relations.push(`${apkId}→${id}:annotates`);
  });

  [...permissionHints].slice(0, 8).forEach((hint, index) => {
    const id = `apkp_${digestPrefix}_${index}`;
    entities[id] = [hint, "apk-signal"];
    relations.push(`${apkId}→${id}:references`);
  });

  trimGraph(entities, relations);

  return {
    kind: "apk",
    entities,
    relations,
    preview: `${path.basename(filePath)} apk entries=${entries.length}`,
    meta: {
      ...baseMeta,
      modality: "archive",
      extraction: "apk-zip-structural-scan",
      structure: {
        entryCount: entries.length,
        dexCount: entries.filter((entry) => /^classes\d*\.dex$/i.test(entry.name)).length,
        nativeLibCount: entries.filter((entry) => entry.name.startsWith("lib/")).length,
        resourceCount: entries.filter((entry) => entry.name.startsWith("res/")).length,
        manifestPresent: entries.some((entry) => /AndroidManifest\.xml$/i.test(entry.name)),
        totalUncompressedBytes: entries.reduce((sum, entry) => sum + Number(entry.uncompressedSize || 0), 0)
      }
    }
  };
}

function estimatePhraseDepth(text) {
  const segments = text
    .split(/[\n.!?;:]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 120);
  if (segments.length === 0) return 1;
  const depths = segments.map((segment) => {
    const commas = (segment.match(/,/g) || []).length;
    const parens = (segment.match(/[()\[\]{}]/g) || []).length;
    return 1 + commas + Math.ceil(parens / 2);
  });
  return Math.max(...depths);
}

function buildHyperbolicProjection(entities, relations, digest, structure = {}) {
  return embedHyperbolicGraph(
    { entities, relations, structure },
    { seed: digest, engine: "js-hyperbolic-embedder" }
  );
}

function trimGraph(entities, relations) {
  const ids = Object.keys(entities);
  if (ids.length > MAX_ENTITIES) {
    for (const id of ids.slice(MAX_ENTITIES)) {
      delete entities[id];
    }
  }
  if (relations.length > MAX_RELATIONS) {
    relations.length = MAX_RELATIONS;
  }
}

function summarize(text, max) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function classifyApkEntry(name) {
  const value = String(name || "");
  if (/AndroidManifest\.xml$/i.test(value)) return "manifest";
  if (/^classes\d*\.dex$/i.test(value)) return "dex";
  if (value.startsWith("lib/")) return "native-lib";
  if (value.startsWith("res/")) return "resource";
  if (value.startsWith("META-INF/")) return "signature";
  return "apk-entry";
}
