import { TYPOGRAPHY_KNOWLEDGE_DOCUMENTS } from "../data/typographyKnowledgeDocuments.js";
import { loadExternalKnowledgeDocuments } from "../services/knowledge/knowledgeIngestion.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "your",
  "you",
]);

const SUPPORTED_INTENTS = ["landing", "dashboard", "ecommerce", "editorial"];

const INTENT_KEYWORDS = {
  landing: ["landing", "hero", "homepage", "marketing", "cta", "conversion", "lead"],
  dashboard: ["dashboard", "analytics", "metric", "table", "data", "chart", "admin"],
  ecommerce: ["ecommerce", "shop", "store", "catalog", "product", "cart", "checkout"],
  editorial: ["editorial", "magazine", "article", "news", "story", "long-form", "blog"],
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stemToken = (token) => {
  if (token.length <= 4) {
    return token;
  }

  if (token.endsWith("ing") && token.length > 6) {
    return token.slice(0, -3);
  }

  if (token.endsWith("ed") && token.length > 5) {
    return token.slice(0, -2);
  }

  if (token.endsWith("ly") && token.length > 5) {
    return token.slice(0, -2);
  }

  if (token.endsWith("s") && token.length > 4) {
    return token.slice(0, -1);
  }

  return token;
};

const tokenize = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map((token) => stemToken(token))
    .filter((token) => token && !STOP_WORDS.has(token) && token.length >= 2);
};

const toStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  return [];
};

const sanitizeDocument = (entry) => {
  const id = normalizeText(entry?.id).replace(/\s+/g, "-");
  const title = String(entry?.title || "").trim();
  const content = String(entry?.content || "").trim();

  if (!id || !title || !content) {
    return null;
  }

  const tags = toStringArray(entry?.tags);
  const intents = toStringArray(entry?.intents).filter((intent) => SUPPORTED_INTENTS.includes(intent));

  return {
    id,
    title,
    tags,
    intents,
    sourceName: String(entry?.sourceName || "").trim(),
    sourceType: String(entry?.sourceType || "").trim(),
    sourceUrl: String(entry?.sourceUrl || "").trim(),
    content,
    filePath: String(entry?.filePath || "").trim(),
  };
};

const deduplicateDocuments = (documents) => {
  const seen = new Set();
  const result = [];

  for (const document of documents) {
    if (!document || seen.has(document.id)) {
      continue;
    }

    seen.add(document.id);
    result.push(document);
  }

  return result;
};

const inferIntentFromText = (rawText) => {
  const tokens = tokenize(rawText);
  const scores = {
    landing: 0,
    dashboard: 0,
    ecommerce: 0,
    editorial: 0,
  };

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (tokens.includes(stemToken(keyword))) {
        scores[intent] += 1;
      }
    }
  }

  return scores;
};

const detectIntent = (queryTokens) => {
  if (!queryTokens.length) {
    return {
      intent: "general",
      confidence: 0,
      scores: {
        landing: 0,
        dashboard: 0,
        ecommerce: 0,
        editorial: 0,
      },
    };
  }

  const scoreByIntent = {
    landing: 0,
    dashboard: 0,
    ecommerce: 0,
    editorial: 0,
  };

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      const normalizedKeyword = stemToken(normalizeText(keyword));
      const hitCount = queryTokens.filter((token) => token === normalizedKeyword).length;
      if (hitCount > 0) {
        scoreByIntent[intent] += hitCount;
      }
    }
  }

  const ranked = Object.entries(scoreByIntent).sort((left, right) => right[1] - left[1]);
  const [topIntent, topScore] = ranked[0];

  if (!topScore) {
    return {
      intent: "general",
      confidence: 0,
      scores: scoreByIntent,
    };
  }

  const total = Object.values(scoreByIntent).reduce((sum, value) => sum + value, 0);
  const confidence = total > 0 ? Number((topScore / total).toFixed(2)) : 0;

  return {
    intent: topIntent,
    confidence,
    scores: scoreByIntent,
  };
};

const countTokenFrequency = (tokens) => {
  const frequencyMap = new Map();

  for (const token of tokens) {
    frequencyMap.set(token, (frequencyMap.get(token) || 0) + 1);
  }

  return frequencyMap;
};

const buildIndexedDocuments = (documents) =>
  documents.map((entry) => {
    const inferredIntentScores = inferIntentFromText(
      `${entry.title} ${entry.tags.join(" ")} ${entry.content}`,
    );

    const inferredIntents = Object.entries(inferredIntentScores)
      .filter(([, score]) => score > 0)
      .map(([intent]) => intent);

    const finalIntents = entry.intents.length ? entry.intents : inferredIntents;
    const titleTokens = tokenize(entry.title);
    const tagTokens = tokenize(entry.tags.join(" "));
    const contentTokens = tokenize(entry.content);

    return {
      ...entry,
      intents: finalIntents,
      _titleTokens: new Set(titleTokens),
      _tagTokens: new Set(tagTokens),
      _contentFrequency: countTokenFrequency(contentTokens),
      _normalizedText: normalizeText(`${entry.title} ${entry.tags.join(" ")} ${entry.content}`),
      _intentSet: new Set(finalIntents),
    };
  });

const scoreEntry = ({ entry, queryTokens, normalizedQuery, detectedIntent }) => {
  if (!queryTokens.length) {
    return {
      score: 0,
      matchScore: 0,
      intentBoost: 0,
    };
  }

  let matchScore = 0;

  for (const token of queryTokens) {
    if (entry._tagTokens.has(token)) {
      matchScore += 4;
    }

    if (entry._titleTokens.has(token)) {
      matchScore += 3;
    }

    const contentMatches = entry._contentFrequency.get(token) || 0;
    if (contentMatches > 0) {
      matchScore += Math.min(contentMatches, 4);
    }
  }

  if (normalizedQuery && entry._normalizedText.includes(normalizedQuery)) {
    matchScore += 3;
  }

  let intentBoost = 0;
  if (detectedIntent.intent !== "general" && entry._intentSet.has(detectedIntent.intent)) {
    intentBoost = Math.max(2, Math.round(6 * (detectedIntent.confidence || 0.5)));
  }

  return {
    score: matchScore + intentBoost,
    matchScore,
    intentBoost,
  };
};

const readMinScore = () => {
  const parsed = Number.parseInt(String(process.env.TYPO_CONTEXT_MIN_SCORE || "2"), 10);
  if (!Number.isFinite(parsed)) {
    return 2;
  }

  return Math.min(Math.max(parsed, 1), 20);
};

const toPublicEntry = (entry) => {
  const {
    _titleTokens,
    _tagTokens,
    _contentFrequency,
    _normalizedText,
    _intentSet,
    ...publicEntry
  } = entry;

  return publicEntry;
};

const readMaxEntries = () => {
  const parsed = Number.parseInt(String(process.env.TYPO_CONTEXT_MAX_ENTRIES || "4"), 10);
  if (!Number.isFinite(parsed)) {
    return 4;
  }

  return Math.min(Math.max(parsed, 2), 8);
};

const loadAllKnowledgeDocuments = async () => {
  const external = await loadExternalKnowledgeDocuments();

  const staticDocuments = TYPOGRAPHY_KNOWLEDGE_DOCUMENTS
    .map((entry) => sanitizeDocument(entry))
    .filter(Boolean);

  const externalDocuments = external.documents
    .map((entry) => sanitizeDocument(entry))
    .filter(Boolean);

  return {
    documents: deduplicateDocuments([...externalDocuments, ...staticDocuments]),
    ingestionDiagnostics: external.diagnostics,
  };
};

export const retrieveTypographyContextDebug = async (query) => {
  const tokens = tokenize(query);
  const normalizedQuery = normalizeText(query);
  const maxEntries = readMaxEntries();
  const minScore = readMinScore();
  const detectedIntent = detectIntent(tokens);

  const loaded = await loadAllKnowledgeDocuments();
  const indexedDocuments = buildIndexedDocuments(loaded.documents);

  const ranked = indexedDocuments
    .map((entry) => ({
      item: toPublicEntry(entry),
      ...scoreEntry({
        entry,
        queryTokens: tokens,
        normalizedQuery,
        detectedIntent,
      }),
    }))
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));

  const selected = ranked
    .filter((entry) => entry.score >= minScore)
    .slice(0, maxEntries);

  if (!selected.length) {
    const defaults = indexedDocuments
      .slice(0, Math.min(3, maxEntries))
      .map((entry) => ({
        item: toPublicEntry(entry),
        score: 0,
      }));

    return {
      query,
      normalizedQuery,
      queryTokens: tokens,
      minScore,
      maxEntries,
      detectedIntent: detectedIntent.intent,
      intentConfidence: detectedIntent.confidence,
      intentScores: detectedIntent.scores,
      ingestion: loaded.ingestionDiagnostics,
      items: defaults,
    };
  }

  return {
    query,
    normalizedQuery,
    queryTokens: tokens,
    minScore,
    maxEntries,
    detectedIntent: detectedIntent.intent,
    intentConfidence: detectedIntent.confidence,
    intentScores: detectedIntent.scores,
    ingestion: loaded.ingestionDiagnostics,
    items: selected,
  };
};

export const retrieveTypographyContext = async (query) => {
  const debug = await retrieveTypographyContextDebug(query);
  return debug.items.map((entry) => entry.item);
};

export const formatTypographyContextBlock = (entries) => {
  if (!Array.isArray(entries) || !entries.length) {
    return "";
  }

  return entries
    .map((entry, index) => {
      const source = entry.sourceName ? ` Source: ${entry.sourceName}.` : "";
      const link = entry.sourceUrl ? ` URL: ${entry.sourceUrl}.` : "";
      return `Context ${index + 1}: ${entry.title}. ${entry.content}.${source}${link}`;
    })
    .join("\n");
};
