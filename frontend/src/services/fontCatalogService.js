const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const normalizeText = (value) => String(value || "").trim();

const buildFallbackStylesheetUrl = (family, variants = []) => {
  const encodedFamily = encodeURIComponent(normalizeText(family)).replace(/%20/g, "+");

  const weights = Array.from(
    new Set(
      (Array.isArray(variants) ? variants : [])
        .map((entry) => Number.parseInt(String(entry).replace(/[^0-9]/g, ""), 10))
        .filter((entry) => Number.isFinite(entry) && entry >= 100 && entry <= 900),
    ),
  )
    .sort((left, right) => left - right)
    .slice(0, 8);

  if (!weights.length) {
    return `https://fonts.googleapis.com/css2?family=${encodedFamily}&display=swap`;
  }

  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weights.join(";")}&display=swap`;
};

const buildFallbackDownloadUrl = (family) => {
  const encodedFamily = encodeURIComponent(normalizeText(family)).replace(/%20/g, "+");
  return `https://fonts.google.com/specimen/${encodedFamily}`;
};

export const getFontByFamily = async (family, signal) => {
  const normalizedFamily = normalizeText(family);
  if (!normalizedFamily) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/fonts/${encodeURIComponent(normalizedFamily)}`, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return payload?.item || null;
};

export const buildFontCardFallbacks = ({ family, variants }) => ({
  stylesheetUrl: buildFallbackStylesheetUrl(family, variants),
  downloadUrl: buildFallbackDownloadUrl(family),
});
