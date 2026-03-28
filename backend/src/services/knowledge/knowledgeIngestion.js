import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_KNOWLEDGE_CACHE_TTL_MS = 60 * 1000;
const SUPPORTED_EXTENSIONS = new Set([".json", ".md", ".markdown"]);

let cacheState = {
  expiresAt: 0,
  documents: [],
  diagnostics: {
    directoryPath: null,
    loadedFiles: 0,
    loadedDocuments: 0,
    loadedAt: null,
    warnings: [],
  },
};

const sanitizeText = (value, maxLength = 0) => {
  const normalized = String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!maxLength || normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength).trim();
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeText(item, 80).toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => sanitizeText(item, 80).toLowerCase())
      .filter(Boolean);
  }

  return [];
};

const readCacheTtlMs = () => {
  const parsed = Number.parseInt(String(process.env.KNOWLEDGE_CACHE_TTL_MS || DEFAULT_KNOWLEDGE_CACHE_TTL_MS), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_KNOWLEDGE_CACHE_TTL_MS;
  }

  return Math.min(Math.max(parsed, 1000), 5 * 60 * 1000);
};

const isDirectory = async (candidatePath) => {
  try {
    const stats = await fs.stat(candidatePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

const buildDirectoryCandidates = () => {
  const envDirectory = sanitizeText(process.env.KNOWLEDGE_DIR || "");

  if (envDirectory) {
    if (path.isAbsolute(envDirectory)) {
      return [envDirectory];
    }

    return [
      path.resolve(process.cwd(), envDirectory),
      path.resolve(process.cwd(), "..", envDirectory),
    ];
  }

  return [
    path.resolve(process.cwd(), "knowledge"),
    path.resolve(process.cwd(), "..", "knowledge"),
  ];
};

const resolveKnowledgeDirectory = async () => {
  const candidates = buildDirectoryCandidates();

  for (const candidate of candidates) {
    if (await isDirectory(candidate)) {
      return candidate;
    }
  }

  return null;
};

const listSupportedFiles = async (directoryPath) => {
  const queue = [directoryPath];
  const result = [];

  while (queue.length) {
    const current = queue.shift();
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      const baseName = path.basename(entry.name, extension).toLowerCase();
      const isReadme = baseName === "readme";

      if (SUPPORTED_EXTENSIONS.has(extension) && !isReadme) {
        result.push(absolutePath);
      }
    }
  }

  return result;
};

const normalizeDocument = ({ raw, filePath, index, diagnostics }) => {
  const idBase = sanitizeText(raw.id || "", 120) || `${path.basename(filePath)}-${index + 1}`;
  const id = slugify(idBase);

  const title = sanitizeText(raw.title, 160);
  const content = sanitizeText(raw.content, 3000);

  if (!id || !title || !content) {
    diagnostics.warnings.push(`Skipped invalid entry in ${filePath} (missing id/title/content)`);
    return null;
  }

  const tags = toStringArray(raw.tags);
  const intents = toStringArray(raw.intents);

  return {
    id,
    title,
    tags,
    intents,
    sourceName: sanitizeText(raw.sourceName, 120),
    sourceType: sanitizeText(raw.sourceType, 80),
    sourceUrl: sanitizeText(raw.sourceUrl, 300),
    content,
    filePath,
  };
};

const parseJsonDocuments = ({ rawText, filePath, diagnostics }) => {
  let payload;

  try {
    payload = JSON.parse(rawText);
  } catch {
    diagnostics.warnings.push(`Skipped invalid JSON file: ${filePath}`);
    return [];
  }

  const entries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.documents)
      ? payload.documents
      : [];

  return entries
    .map((entry, index) => normalizeDocument({ raw: entry || {}, filePath, index, diagnostics }))
    .filter(Boolean);
};

const parseMarkdownMetadata = (metadataBlock) => {
  const metadata = {};

  for (const rawLine of metadataBlock.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key) {
      metadata[key] = value;
    }
  }

  return metadata;
};

const parseMarkdownDocument = ({ rawText, filePath, diagnostics }) => {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) {
    diagnostics.warnings.push(`Skipped empty markdown file: ${filePath}`);
    return [];
  }

  let metadata = {};
  let body = trimmed;

  if (trimmed.startsWith("---\n")) {
    const closingIndex = trimmed.indexOf("\n---\n", 4);
    if (closingIndex !== -1) {
      const metadataBlock = trimmed.slice(4, closingIndex);
      metadata = parseMarkdownMetadata(metadataBlock);
      body = trimmed.slice(closingIndex + 5).trim();
    }
  }

  const headingMatch = body.match(/^#\s+(.+)$/m);
  const inferredTitle = headingMatch ? sanitizeText(headingMatch[1], 160) : "";

  const document = normalizeDocument({
    raw: {
      id: metadata.id || path.basename(filePath, path.extname(filePath)),
      title: metadata.title || inferredTitle || path.basename(filePath, path.extname(filePath)),
      tags: metadata.tags,
      intents: metadata.intents,
      sourceName: metadata.sourceName,
      sourceType: metadata.sourceType,
      sourceUrl: metadata.sourceUrl,
      content: body,
    },
    filePath,
    index: 0,
    diagnostics,
  });

  return document ? [document] : [];
};

const deduplicateById = (documents) => {
  const seenIds = new Set();
  const unique = [];

  for (const document of documents) {
    if (seenIds.has(document.id)) {
      continue;
    }

    seenIds.add(document.id);
    unique.push(document);
  }

  return unique;
};

const loadDocumentsFromDirectory = async (directoryPath) => {
  const diagnostics = {
    directoryPath,
    loadedFiles: 0,
    loadedDocuments: 0,
    loadedAt: new Date().toISOString(),
    warnings: [],
  };

  const files = await listSupportedFiles(directoryPath);
  diagnostics.loadedFiles = files.length;

  const documents = [];

  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();
    const rawText = await fs.readFile(filePath, "utf8");

    if (extension === ".json") {
      documents.push(...parseJsonDocuments({ rawText, filePath, diagnostics }));
      continue;
    }

    if (extension === ".md" || extension === ".markdown") {
      documents.push(...parseMarkdownDocument({ rawText, filePath, diagnostics }));
    }
  }

  const unique = deduplicateById(documents);
  diagnostics.loadedDocuments = unique.length;

  return {
    documents: unique,
    diagnostics,
  };
};

export const loadExternalKnowledgeDocuments = async () => {
  const now = Date.now();

  if (cacheState.expiresAt > now) {
    return cacheState;
  }

  const directoryPath = await resolveKnowledgeDirectory();
  const ttlMs = readCacheTtlMs();

  if (!directoryPath) {
    cacheState = {
      expiresAt: now + ttlMs,
      documents: [],
      diagnostics: {
        directoryPath: null,
        loadedFiles: 0,
        loadedDocuments: 0,
        loadedAt: new Date().toISOString(),
        warnings: ["Knowledge directory not found"],
      },
    };

    return cacheState;
  }

  try {
    const loaded = await loadDocumentsFromDirectory(directoryPath);

    cacheState = {
      expiresAt: now + ttlMs,
      documents: loaded.documents,
      diagnostics: loaded.diagnostics,
    };

    return cacheState;
  } catch (error) {
    cacheState = {
      expiresAt: now + ttlMs,
      documents: [],
      diagnostics: {
        directoryPath,
        loadedFiles: 0,
        loadedDocuments: 0,
        loadedAt: new Date().toISOString(),
        warnings: [error?.message || "Unknown ingestion error"],
      },
    };

    return cacheState;
  }
};
