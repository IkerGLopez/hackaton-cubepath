import { Router } from "express";
import {
  formatTypographyContextBlock,
  retrieveTypographyContextDebug,
} from "../utils/typographyKnowledgeBase.js";

const knowledgeRouter = Router();

const sanitizeQueryText = (value) =>
  String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

knowledgeRouter.get("/search", async (req, res) => {
  const query = sanitizeQueryText(req.query.q || req.query.query || "");

  if (!query) {
    return res.status(400).json({
      error: "Missing query",
      details: "Use ?q=<text> or ?query=<text>",
    });
  }

  try {
    const debug = await retrieveTypographyContextDebug(query);

    return res.status(200).json({
      query: debug.query,
      normalizedQuery: debug.normalizedQuery,
      queryTokens: debug.queryTokens,
      detectedIntent: debug.detectedIntent,
      intentConfidence: debug.intentConfidence,
      intentScores: debug.intentScores,
      minScore: debug.minScore,
      maxEntries: debug.maxEntries,
      ingestion: debug.ingestion,
      total: debug.items.length,
      contextPreview: formatTypographyContextBlock(debug.items.map((entry) => entry.item)),
      items: debug.items,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Knowledge search failed",
      details: error?.message || "Unknown error",
    });
  }
});

export default knowledgeRouter;
