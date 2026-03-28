const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

const ROLE_FALLBACKS = ["heading", "body", "accent"];
const DEFAULT_SAMPLE_TEXT = "Typography builds trust before users read a single word.";

const toGoogleSpecimenUrl = (fontFamily) => {
  const encoded = encodeURIComponent(String(fontFamily || "").trim()).replace(/%20/g, "+");
  return `https://fonts.google.com/specimen/${encoded}`;
};

const sanitizeText = (value, maxLength) => {
  const normalized = String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(EMOJI_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!maxLength || normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength).trim();
};

const isValidUrl = (value) => {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const extractJsonPayload = (rawText) => {
  const withoutCodeFence = String(rawText || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!withoutCodeFence) {
    return null;
  }

  try {
    return JSON.parse(withoutCodeFence);
  } catch {
    // Try extracting the first object-like block.
  }

  const firstBrace = withoutCodeFence.indexOf("{");
  const lastBrace = withoutCodeFence.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    return null;
  }

  const candidate = withoutCodeFence.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
};

const normalizeRecommendationItem = (item, index) => {
  if (!item || typeof item !== "object") {
    return null;
  }

  const fontFamily = sanitizeText(item.fontFamily || item.family, 80);
  if (!fontFamily) {
    return null;
  }

  const role = sanitizeText(item.role, 20) || ROLE_FALLBACKS[index] || "body";
  const shortRationale = sanitizeText(item.shortRationale || item.rationale, 180);
  const sampleText = sanitizeText(item.sampleText, 120) || DEFAULT_SAMPLE_TEXT;
  const provider = sanitizeText(item.provider, 40) || "google-fonts";

  const variants = Array.isArray(item.variants)
    ? item.variants
        .map((variant) => sanitizeText(variant, 20))
        .filter(Boolean)
        .slice(0, 8)
    : ["400", "700"];

  const downloadUrl = isValidUrl(item.downloadUrl)
    ? String(item.downloadUrl)
    : toGoogleSpecimenUrl(fontFamily);

  return {
    fontFamily,
    role,
    shortRationale: shortRationale || "Balanced choice for readability and hierarchy.",
    sampleText,
    provider,
    variants,
    downloadUrl,
  };
};

const normalizePayload = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const recommendationSource = Array.isArray(value.recommendations) ? value.recommendations : [];
  const recommendations = recommendationSource
    .map((item, index) => normalizeRecommendationItem(item, index))
    .filter(Boolean)
    .slice(0, 5);

  if (!recommendations.length) {
    return null;
  }

  const primaryFont = sanitizeText(value.primaryFont, 80) || recommendations[0].fontFamily;
  const secondaryFont = sanitizeText(value.secondaryFont, 80) || recommendations[1]?.fontFamily || primaryFont;

  const rationale = sanitizeText(
    value.rationale,
    280,
  ) || `${recommendations[0].shortRationale} ${recommendations[1]?.shortRationale || ""}`.trim();

  const useCases = Array.isArray(value.useCases)
    ? value.useCases.map((entry) => sanitizeText(entry, 100)).filter(Boolean).slice(0, 4)
    : recommendations.map((entry) => `${entry.role}: ${entry.shortRationale}`).slice(0, 3);

  const googleFontsLinks = Array.isArray(value.googleFontsLinks)
    ? value.googleFontsLinks.filter(isValidUrl).map(String).slice(0, 4)
    : recommendations.map((entry) => entry.downloadUrl).slice(0, 4);

  return {
    primaryFont,
    secondaryFont,
    rationale,
    useCases,
    googleFontsLinks,
    recommendations,
  };
};

export const parseAndValidateStructuredRecommendation = (rawText) => {
  const parsed = extractJsonPayload(rawText);
  const normalized = normalizePayload(parsed);

  if (!normalized) {
    return {
      ok: false,
      details: "Model output is not valid structured JSON for recommendations.",
    };
  }

  return {
    ok: true,
    value: normalized,
  };
};