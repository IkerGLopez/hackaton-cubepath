const normalizeVariantValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized === "normal" || normalized === "regular") {
    return "400";
  }

  if (normalized === "italic") {
    return "italic";
  }

  const weightItalicMatch = normalized.match(/^([1-9]00)(italic)?$/);
  if (weightItalicMatch) {
    const [, weightText, italicToken] = weightItalicMatch;
    return italicToken ? `${weightText}italic` : weightText;
  }

  return normalized;
};

const normalizeVariants = (variants) => {
  const unique = [];
  const seen = new Set();

  for (const rawVariant of Array.isArray(variants) ? variants : []) {
    const variant = normalizeVariantValue(rawVariant);
    if (!variant || seen.has(variant)) {
      continue;
    }

    seen.add(variant);
    unique.push(variant);
  }

  return unique;
};

const dedupeRecommendationsByFamily = (recommendations) => {
  const unique = [];
  const seen = new Set();

  for (const recommendation of Array.isArray(recommendations) ? recommendations : []) {
    const familyKey = String(recommendation?.fontFamily || "").trim().toLowerCase();
    if (!familyKey || seen.has(familyKey)) {
      continue;
    }

    seen.add(familyKey);
    unique.push(recommendation);
  }

  return unique;
};

const buildFallbackRecommendations = ({
  primaryFont,
  secondaryFont,
  rationale,
  googleFontsLinks,
}) => {
  const safePrimary = String(primaryFont || "").trim();
  const safeSecondary = String(secondaryFont || "").trim();
  const safeRationale = String(rationale || "Balanced pairing for hierarchy and readability.").trim();

  if (!safePrimary || !safeSecondary) {
    return [];
  }

  const primaryLink = Array.isArray(googleFontsLinks) && googleFontsLinks[0]
    ? String(googleFontsLinks[0])
    : "";
  const secondaryLink = Array.isArray(googleFontsLinks) && googleFontsLinks[1]
    ? String(googleFontsLinks[1])
    : primaryLink;

  return dedupeRecommendationsByFamily([
    {
      fontFamily: safePrimary,
      role: "heading",
      shortRationale: safeRationale,
      sampleText: "Typography defines your first impression.",
      provider: "google-fonts",
      variants: ["400", "700"],
      downloadUrl: primaryLink,
      stylesheetUrl: "",
    },
    {
      fontFamily: safeSecondary,
      role: "body",
      shortRationale: "Readable body text supports conversion and trust.",
      sampleText: "Readable copy increases clarity and confidence.",
      provider: "google-fonts",
      variants: ["400", "500", "700"],
      downloadUrl: secondaryLink,
      stylesheetUrl: "",
    },
  ]);
};

const parseObject = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const recommendations = Array.isArray(value.recommendations)
    ? dedupeRecommendationsByFamily(
        value.recommendations
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => ({
            fontFamily: String(entry.fontFamily || entry.family || "").trim(),
            role: String(entry.role || "body").trim() || "body",
            shortRationale: String(entry.shortRationale || entry.rationale || "").trim(),
            sampleText: String(entry.sampleText || "").trim(),
            provider: String(entry.provider || "google-fonts").trim() || "google-fonts",
            variants: normalizeVariants(entry.variants),
            downloadUrl: String(entry.downloadUrl || "").trim(),
            stylesheetUrl: String(entry.stylesheetUrl || "").trim(),
          }))
          .filter((entry) => entry.fontFamily),
      )
    : [];

  const primaryFont = value.primaryFont || value.primary_font;
  const secondaryFont = value.secondaryFont || value.secondary_font;
  const rationale = value.rationale || value.reasoning || value.explanation;

  const derivedPrimary = primaryFont || recommendations[0]?.fontFamily;
  const derivedSecondary = secondaryFont || recommendations[1]?.fontFamily || derivedPrimary;
  const derivedRationale = rationale || recommendations[0]?.shortRationale;

  if (!derivedPrimary || !derivedSecondary || !derivedRationale) {
    return null;
  }

  const derivedLinks = recommendations
    .map((entry) => entry.downloadUrl)
    .filter(Boolean);

  const finalLinks = Array.isArray(value.googleFontsLinks)
    ? value.googleFontsLinks.map(String)
    : derivedLinks;

  const finalRecommendations = recommendations.length
    ? recommendations
    : buildFallbackRecommendations({
        primaryFont: derivedPrimary,
        secondaryFont: derivedSecondary,
        rationale: derivedRationale,
        googleFontsLinks: finalLinks,
      });

  return {
    primaryFont: String(derivedPrimary),
    secondaryFont: String(derivedSecondary),
    rationale: String(derivedRationale),
    useCases: Array.isArray(value.useCases) ? value.useCases.map(String) : [],
    googleFontsLinks: finalLinks,
    recommendations: finalRecommendations,
  };
};

export const parseAiRecommendation = (rawText) => {
  const text = String(rawText || "").trim();
  if (!text) {
    return null;
  }

  try {
    return parseObject(JSON.parse(text));
  } catch {
    // Continue with fallback extraction.
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    return null;
  }

  const possibleJson = text.slice(firstBrace, lastBrace + 1);

  try {
    return parseObject(JSON.parse(possibleJson));
  } catch {
    return null;
  }
};
