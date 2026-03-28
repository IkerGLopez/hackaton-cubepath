const GOOGLE_WEBFONTS_ENDPOINT = "https://www.googleapis.com/webfonts/v1/webfonts";
const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;

const FALLBACK_FONTS = [
  { family: "Inter", category: "sans-serif", variants: ["300", "400", "500", "700"], subsets: ["latin"] },
  { family: "Playfair Display", category: "serif", variants: ["400", "500", "700"], subsets: ["latin"] },
  { family: "Manrope", category: "sans-serif", variants: ["400", "500", "700"], subsets: ["latin"] },
  { family: "Merriweather", category: "serif", variants: ["300", "400", "700"], subsets: ["latin"] },
  { family: "Montserrat", category: "sans-serif", variants: ["400", "500", "700"], subsets: ["latin"] },
  { family: "Lora", category: "serif", variants: ["400", "500", "700"], subsets: ["latin"] },
  { family: "Source Sans 3", category: "sans-serif", variants: ["400", "600", "700"], subsets: ["latin"] },
  { family: "Space Grotesk", category: "sans-serif", variants: ["400", "500", "700"], subsets: ["latin"] },
  { family: "Poppins", category: "sans-serif", variants: ["400", "500", "600", "700"], subsets: ["latin"] },
  { family: "IBM Plex Serif", category: "serif", variants: ["400", "500", "700"], subsets: ["latin"] },
];

let cacheState = {
  expiresAt: 0,
  fonts: [],
};

let hasLoggedMissingKey = false;

const toFamilyId = (family) =>
  String(family || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toSpecimenUrl = (family) => {
  const encoded = encodeURIComponent(String(family || "").trim()).replace(/%20/g, "+");
  return `https://fonts.google.com/specimen/${encoded}`;
};

const toStylesheetUrl = (family, variants) => {
  const encodedFamily = encodeURIComponent(String(family || "").trim()).replace(/%20/g, "+");

  const weights = Array.from(
    new Set(
      (Array.isArray(variants) ? variants : [])
        .map((value) => Number.parseInt(String(value).replace(/[^0-9]/g, ""), 10))
        .filter((value) => Number.isFinite(value) && value >= 100 && value <= 900),
    ),
  )
    .sort((left, right) => left - right)
    .slice(0, 8);

  if (!weights.length) {
    return `https://fonts.googleapis.com/css2?family=${encodedFamily}&display=swap`;
  }

  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weights.join(";")}&display=swap`;
};

const normalizeGoogleItem = (item) => {
  const family = String(item?.family || "").trim();

  if (!family) {
    return null;
  }

  const variants = Array.isArray(item?.variants)
    ? item.variants.map((entry) => String(entry)).filter(Boolean)
    : ["400", "700"];

  const subsets = Array.isArray(item?.subsets)
    ? item.subsets.map((entry) => String(entry)).filter(Boolean)
    : ["latin"];

  const files = item?.files && typeof item.files === "object" ? item.files : {};

  return {
    id: toFamilyId(family),
    family,
    category: String(item?.category || "sans-serif"),
    variants,
    subsets,
    files,
    provider: "google-fonts",
    specimenUrl: toSpecimenUrl(family),
    downloadUrl: toSpecimenUrl(family),
    stylesheetUrl: toStylesheetUrl(family, variants),
  };
};

const toFallbackCatalog = () =>
  FALLBACK_FONTS.map((entry) => normalizeGoogleItem(entry)).filter(Boolean);

const readCacheTtlMs = () => {
  const parsed = Number(process.env.FONTS_CACHE_TTL_MS || DEFAULT_CACHE_TTL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CACHE_TTL_MS;
};

const fetchGoogleFontsCatalog = async () => {
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;

  if (!apiKey) {
    if (!hasLoggedMissingKey) {
      hasLoggedMissingKey = true;
      console.warn("GOOGLE_FONTS_API_KEY is not set. Falling back to embedded font catalog.");
    }

    return toFallbackCatalog();
  }

  const url = `${GOOGLE_WEBFONTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}&sort=popularity`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Google Fonts API request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  const catalog = items.map((entry) => normalizeGoogleItem(entry)).filter(Boolean);

  if (!catalog.length) {
    throw new Error("Google Fonts API returned an empty catalog");
  }

  return catalog;
};

export const listGoogleFonts = async () => {
  const now = Date.now();

  if (cacheState.expiresAt > now && cacheState.fonts.length) {
    return cacheState.fonts;
  }

  const ttlMs = readCacheTtlMs();

  try {
    const fonts = await fetchGoogleFontsCatalog();
    cacheState = {
      fonts,
      expiresAt: now + ttlMs,
    };
    return fonts;
  } catch (error) {
    console.error("Google Fonts provider failed, using fallback catalog:", error?.message || error);

    const fallback = toFallbackCatalog();
    cacheState = {
      fonts: fallback,
      expiresAt: now + ttlMs,
    };

    return fallback;
  }
};

export const getGoogleFontByFamily = async (family) => {
  const normalizedQuery = String(family || "").trim().toLowerCase();
  if (!normalizedQuery) {
    return null;
  }

  const catalog = await listGoogleFonts();
  return (
    catalog.find((entry) => entry.family.toLowerCase() === normalizedQuery) ||
    catalog.find((entry) => entry.id === toFamilyId(normalizedQuery)) ||
    null
  );
};
