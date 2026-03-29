import { useEffect, useState } from "react";
import { buildFontCardFallbacks, getFontByFamily } from "../services/fontCatalogService";

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

  return unique.length ? unique : ["400", "700"];
};

const normalizeRecommendation = (entry) => {
  const fontFamily = String(entry?.fontFamily || "").trim();
  if (!fontFamily) {
    return null;
  }

  return {
    fontFamily,
    role: String(entry?.role || "body").trim() || "body",
    shortRationale:
      String(entry?.shortRationale || entry?.rationale || "").trim()
      || "Balanced choice for readability and hierarchy.",
    sampleText:
      String(entry?.sampleText || "").trim()
      || "Typography shapes trust before users read your copy.",
    provider: String(entry?.provider || "google-fonts").trim() || "google-fonts",
    variants: normalizeVariants(entry?.variants),
    downloadUrl: String(entry?.downloadUrl || "").trim(),
    stylesheetUrl: String(entry?.stylesheetUrl || "").trim(),
  };
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

export const useResolvedFontCards = (recommendations) => {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    const normalized = Array.isArray(recommendations)
      ? recommendations.map((entry) => normalizeRecommendation(entry)).filter(Boolean)
      : [];
    const deduped = dedupeRecommendationsByFamily(normalized);

    if (!deduped.length) {
      return undefined;
    }

    const abortController = new AbortController();

    const resolveCards = async () => {
      const resolved = await Promise.all(
        deduped.map(async (entry) => {
          const fallback = buildFontCardFallbacks({
            family: entry.fontFamily,
            variants: entry.variants,
          });

          const catalogItem = await getFontByFamily(entry.fontFamily, abortController.signal);

          return {
            ...entry,
            provider: catalogItem?.provider || entry.provider,
            variants: normalizeVariants(
              Array.isArray(catalogItem?.variants) && catalogItem.variants.length
                ? catalogItem.variants
                : entry.variants,
            ),
            stylesheetUrl: catalogItem?.stylesheetUrl || entry.stylesheetUrl || fallback.stylesheetUrl,
            downloadUrl: catalogItem?.downloadUrl || entry.downloadUrl || fallback.downloadUrl,
          };
        }),
      );

      if (!abortController.signal.aborted) {
        setCards(resolved);
      }
    };

    resolveCards().catch(() => {
      if (!abortController.signal.aborted) {
        setCards(deduped.map((entry) => ({
          ...entry,
          ...buildFontCardFallbacks({ family: entry.fontFamily, variants: entry.variants }),
        })));
      }
    });

    return () => {
      abortController.abort();
    };
  }, [recommendations]);

  return {
    cards: Array.isArray(recommendations) && recommendations.length ? cards : [],
  };
};
