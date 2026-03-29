const TYPOGRAPHY_KEYWORDS = [
  "font",
  "fonts",
  "typeface",
  "type system",
  "typographic system",
  "font system",
  "typography",
  "google fonts",
  "serif",
  "sans",
  "sans-serif",
  "display",
  "headline",
  "body text",
  "fuente",
  "fuentes",
  "tipografia",
  "tipografias",
  "sistema tipografico",
  "sistema de fuentes",
  "tipografica",
  "tipografico",
  "tipograficas",
  "tipograficos",
  "pairing",
  "font pair",
  "lettering",
  "legibilidad",
  "jerarquia tipografica",
  "jerarquia",
];

const DISCRIMINATION_KEYWORDS = [
  "racismo",
  "racista",
  "machismo",
  "machista",
  "xenofobia",
  "xenofobo",
  "xenofoba",
  "homofobia",
  "homofobo",
  "homofoba",
  "discriminacion",
  "discriminatorio",
  "discriminatoria",
  "racism",
  "racist",
  "sexism",
  "sexist",
  "xenophobia",
  "homophobia",
  "discrimination",
  "supremacist",
  "supremacy",
  "nazi",
  "odio racial",
  "hate race",
  "nigga",
  "niggas",
  "nigger",
  "niggers",
  "faggot",
  "faggots",
  "maricon",
  "maricones",
  "sudaca",
  "sudacas",
  "moro de mierda",
];

const DISCRIMINATION_PATTERNS = [
  /\bn[i1]gg(?:a|er|as|ers)\b/i,
  /\bfag(?:got)?s?\b/i,
  /\bmaric[o0]n(?:es)?\b/i,
  /\bsudac(?:a|as)\b/i,
  /\b(odio|detesto|expulsar|eliminar|matar|inferior(?:es)?)\b.*\b(mujeres|gays|lesbianas|inmigrantes|negros|judios|musulmanes|trans)\b/i,
  /\b(hate|kill|eliminate|inferior)\b.*\b(women|gays|lesbians|immigrants|black|jews|muslims|trans)\b/i,
];

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesAnyKeyword = (text, keywords) =>
  keywords.some((keyword) => text.includes(normalizeText(keyword)));

const includesDiscriminatoryPatterns = (text) =>
  DISCRIMINATION_PATTERNS.some((pattern) => pattern.test(text));

export const evaluateChatPromptPolicy = (message) => {
  const normalized = normalizeText(message);

  if (!normalized) {
    return {
      ok: false,
      statusCode: 400,
      error: "Invalid input",
      details: "message must be a non-empty string",
    };
  }

  if (includesAnyKeyword(normalized, DISCRIMINATION_KEYWORDS) || includesDiscriminatoryPatterns(normalized)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Blocked discriminatory request",
      details: "Vete con tu mierda a otra parte, aquí se respetan los Derechos Humanos.",
    };
  }

  if (!includesAnyKeyword(normalized, TYPOGRAPHY_KEYWORDS)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Out-of-scope request",
      details: "Este asistente solo respondera mensajes relacionados con recomendaciones de fuentes de texto.",
    };
  }

  return {
    ok: true,
  };
};
