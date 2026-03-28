import { getGoogleFontByFamily, listGoogleFonts } from "./providers/googleFontsProvider.js";

const DEFAULT_PROVIDER = "google-fonts";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 60;

const providers = {
  "google-fonts": {
    list: listGoogleFonts,
    getByFamily: getGoogleFontByFamily,
  },
};

const sanitizeText = (value) => String(value || "")
  .replace(/[\u0000-\u001F\u007F]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const readProviderName = () => {
  const fromEnv = sanitizeText(process.env.FONT_PROVIDER).toLowerCase();
  return fromEnv && providers[fromEnv] ? fromEnv : DEFAULT_PROVIDER;
};

const clampLimit = (value) => {
  const parsed = Number.parseInt(String(value || DEFAULT_LIMIT), 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
};

const matchesQuery = (font, query) => {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return (
    font.family.toLowerCase().includes(normalized)
    || font.category.toLowerCase().includes(normalized)
    || font.id.includes(normalized)
  );
};

const matchesCategory = (font, category) => {
  if (!category) {
    return true;
  }

  return font.category.toLowerCase() === category.toLowerCase();
};

export const listFonts = async ({ query, category, limit } = {}) => {
  const providerName = readProviderName();
  const provider = providers[providerName];

  const normalizedQuery = sanitizeText(query);
  const normalizedCategory = sanitizeText(category);
  const safeLimit = clampLimit(limit);

  const catalog = await provider.list();

  const filtered = catalog
    .filter((font) => matchesQuery(font, normalizedQuery))
    .filter((font) => matchesCategory(font, normalizedCategory));

  return {
    provider: providerName,
    total: filtered.length,
    items: filtered.slice(0, safeLimit),
  };
};

export const getFontByFamily = async (family) => {
  const providerName = readProviderName();
  const provider = providers[providerName];

  const normalizedFamily = sanitizeText(family);
  if (!normalizedFamily) {
    return null;
  }

  const item = await provider.getByFamily(normalizedFamily);
  if (!item) {
    return null;
  }

  return {
    provider: providerName,
    item,
  };
};

export const listFontProviders = () => ({
  defaultProvider: readProviderName(),
  providers: Object.keys(providers),
});
