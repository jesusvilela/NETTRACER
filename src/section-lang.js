export function extractSectionTags(text) {
  if (!text) {
    return [];
  }
  const matches = [...text.matchAll(/§([A-Za-z0-9_|.+-]+)/gu)];
  return [...new Set(matches.map((match) => match[1]))];
}

export function summarizeSectionText(text, maxLen = 160) {
  const compact = (text || "").replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }
  return compact.length > maxLen ? `${compact.slice(0, maxLen - 1)}…` : compact;
}

export function detectPromptType(text) {
  const input = text || "";
  if (input.startsWith("HYPERVISOR_PROMPT:") || input.includes("§9|HYPERVISOR")) {
    return "HYPERVISOR";
  }
  if (input.startsWith("VIBE_CHECK_PROMPT:") || /vibe|affect|arousal/i.test(input)) {
    return "VIBE";
  }
  if (input.includes("§1|DMN_DAYDREAM") || /\bdaydream\b/i.test(input)) {
    return "DMN";
  }
  if (/reflection|introspect|self[- ]model/i.test(input)) {
    return "REFLECTION";
  }
  if (/embedding|vector|manifold/i.test(input)) {
    return "EMBEDDING";
  }
  return "SEMANTIC";
}

export function buildSectionEnvelope(fields) {
  const ordered = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `§S1{${ordered.map(([key, value]) => `${key}=${encodeSectionValue(value)}`).join(",")}}`;
}

function encodeSectionValue(value) {
  if (value === null) {
    return "nil";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => encodeSectionValue(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const inner = Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${key}=${encodeSectionValue(item)}`)
      .join(",");
    return `{${inner}}`;
  }
  if (typeof value === "string") {
    if (/^[A-Za-z0-9_|.+:/-]+$/.test(value)) {
      return value;
    }
    return JSON.stringify(value);
  }
  return String(value);
}
