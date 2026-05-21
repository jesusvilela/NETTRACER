import crypto from "node:crypto";
import { detectPromptType, extractSectionTags, summarizeSectionText } from "./section-lang.js";

export function analyzePrompt({ messages = [], packet = null }) {
  const joined = messages
    .map((message) => `${message.role || "user"}:${message.content || ""}`)
    .join("\n");
  const sourceText = packet?.payload?.intent || joined;
  const tags = extractSectionTags(sourceText);
  const promptType = detectPromptType(sourceText);
  const riskFlags = [];

  if (/bind|unbind|hypervisor|broker/i.test(sourceText)) {
    riskFlags.push("control-plane");
  }
  if (/axiom|proof|glue|stabilize|rollback|block/i.test(sourceText)) {
    riskFlags.push("formal-check");
  }
  if (sourceText.length > 6000) {
    riskFlags.push("oversized");
  }

  return {
    promptType,
    tags,
    riskFlags,
    summary: summarizeSectionText(sourceText, 220),
    digest: crypto.createHash("sha256").update(sourceText).digest("hex").slice(0, 16),
    routeHint: chooseRoute(promptType, tags, riskFlags)
  };
}

function chooseRoute(promptType, tags, riskFlags) {
  if (riskFlags.includes("control-plane")) {
    return "strict";
  }
  if (promptType === "EMBEDDING") {
    return "embedding";
  }
  if (tags.some((tag) => tag.startsWith("9|") || tag.startsWith("10|"))) {
    return "reflective";
  }
  if (promptType === "VIBE") {
    return "lightweight";
  }
  return "semantic";
}
