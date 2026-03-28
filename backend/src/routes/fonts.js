import { Router } from "express";
import {
  getFontByFamily,
  listFontProviders,
  listFonts,
} from "../services/fonts/fontCatalogService.js";

const fontsRouter = Router();

const sanitizeQueryText = (value) => String(value || "")
  .replace(/[\u0000-\u001F\u007F]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

fontsRouter.get("/providers", (_req, res) => {
  res.status(200).json(listFontProviders());
});

fontsRouter.get("/", async (req, res) => {
  try {
    const query = sanitizeQueryText(req.query.query || req.query.q);
    const category = sanitizeQueryText(req.query.category);
    const limit = req.query.limit;

    const result = await listFonts({
      query,
      category,
      limit,
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to load font catalog",
      details: error?.message || "Unknown error",
    });
  }
});

fontsRouter.get("/:family", async (req, res) => {
  try {
    const family = sanitizeQueryText(decodeURIComponent(req.params.family || ""));
    const result = await getFontByFamily(family);

    if (!result) {
      return res.status(404).json({
        error: "Font not found",
        details: "No font matched the provided family name",
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load font details",
      details: error?.message || "Unknown error",
    });
  }
});

export default fontsRouter;
