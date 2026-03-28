import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getModelName, openrouter } from "../services/openRouterClient.js";
import { validateChatInput } from "../utils/sanitizeChatInput.js";
import { parseAndValidateStructuredRecommendation } from "../utils/structuredRecommendation.js";
import {
  formatTypographyContextBlock,
  retrieveTypographyContextDebug,
} from "../utils/typographyKnowledgeBase.js";

const chatRouter = Router();
const readMaxModelAttempts = () => {
  const parsed = Number.parseInt(String(process.env.CHAT_MAX_MODEL_ATTEMPTS || "3"), 10);
  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.min(Math.max(parsed, 1), 6);
};

const MAX_MODEL_ATTEMPTS = readMaxModelAttempts();
const OUTBOUND_TOKEN_CHUNK_SIZE = 72;

const SYSTEM_PROMPT = [
  "You are a senior UI/UX typography expert for web products.",
  "Return STRICT JSON only. Never include markdown fences.",
  "Do not use emojis or emoticons.",
  "Keep rationale concise and practical.",
  "Always return this exact top-level object shape:",
  '{"primaryFont":"","secondaryFont":"","rationale":"","useCases":[""],"googleFontsLinks":[""],"recommendations":[{"fontFamily":"","role":"heading|body|accent","shortRationale":"","sampleText":"","provider":"google-fonts","variants":["400","700"],"downloadUrl":"https://..."}]}',
  "Provide between 2 and 4 recommendation items.",
].join(" ");

const REPAIR_SYSTEM_PROMPT = [
  "You are a JSON repair assistant for structured typography recommendations.",
  "Your task is to convert malformed model output into strict JSON that matches the required schema.",
  "Do not invent markdown or explanation.",
  "Return JSON only.",
].join(" ");

const sendSseEvent = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const splitInChunks = (text, chunkSize) => {
  const chunks = [];

  for (let cursor = 0; cursor < text.length; cursor += chunkSize) {
    chunks.push(text.slice(cursor, cursor + chunkSize));
  }

  return chunks;
};

const requestModelCompletion = async ({ prompt, timeoutMs, systemPrompt = SYSTEM_PROMPT }) => {
  const stream = await openrouter.chat.send(
    {
      chatGenerationParams: {
        model: getModelName(),
        stream: true,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      },
    },
    {
      timeoutMs,
    },
  );

  let text = "";
  let reasoningTokens = 0;

  for await (const chunk of stream) {
    const token = chunk.choices?.[0]?.delta?.content;
    if (token) {
      text += token;
    }

    if (chunk.usage?.reasoningTokens) {
      reasoningTokens = chunk.usage.reasoningTokens;
    }
  }

  return {
    text,
    reasoningTokens,
  };
};

const buildUserPrompt = ({ message, contextBlock, correctionHint = "" }) => {
  const correctionBlock = correctionHint
    ? `\nCorrection requirements: ${correctionHint}\n`
    : "";

  return [
    "User request:",
    message,
    "\nRetrieved typography context:",
    contextBlock,
    correctionBlock,
    "Respond with concise structured JSON only.",
    "No emojis. No markdown. No prose outside JSON.",
  ].join("\n");
};

const buildRepairPrompt = ({ malformedOutput, correctionHint = "" }) => {
  const correctionBlock = correctionHint
    ? `\nValidation errors from parser: ${correctionHint}\n`
    : "";

  return [
    "Repair this malformed output into valid JSON.",
    "Required top-level shape:",
    '{"primaryFont":"","secondaryFont":"","rationale":"","useCases":[""],"googleFontsLinks":[""],"recommendations":[{"fontFamily":"","role":"heading|body|accent","shortRationale":"","sampleText":"","provider":"google-fonts","variants":["400","700"],"downloadUrl":"https://..."}]}',
    correctionBlock,
    "Malformed output:",
    malformedOutput,
    "Return repaired JSON only.",
  ].join("\n");
};

chatRouter.post("/stream", async (req, res) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const validation = validateChatInput(req.body?.message);

  if (!validation.ok) {
    console.warn(`[chat][${requestId}] invalid input: ${validation.details}`);
    return res.status(validation.statusCode).json({
      error: validation.error,
      details: validation.details,
      requestId,
    });
  }

  const message = validation.sanitized;
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 45000);

  let retrievedContext;
  try {
    retrievedContext = await retrieveTypographyContextDebug(message);
  } catch (error) {
    console.error(`[chat][${requestId}] failed to retrieve typography context:`, error?.message || error);
    retrievedContext = {
      queryTokens: [],
      minScore: 0,
      maxEntries: 0,
      detectedIntent: "general",
      intentConfidence: 0,
      intentScores: {
        landing: 0,
        dashboard: 0,
        ecommerce: 0,
        editorial: 0,
      },
      ingestion: {
        directoryPath: null,
        loadedFiles: 0,
        loadedDocuments: 0,
        warnings: ["Context retrieval failed"],
      },
      items: [],
    };
  }

  const contextEntries = retrievedContext.items.map((entry) => entry.item);
  const contextBlock = formatTypographyContextBlock(contextEntries);
  const contextMeta = retrievedContext.items.map((entry) => ({
    id: entry.item.id,
    title: entry.item.title,
    sourceName: entry.item.sourceName,
    sourceUrl: entry.item.sourceUrl,
    intents: entry.item.intents || [],
    score: entry.score,
    matchScore: entry.matchScore,
    intentBoost: entry.intentBoost,
  }));

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("X-Request-Id", requestId);
  res.flushHeaders?.();

  console.info(`[chat][${requestId}] stream started model=${getModelName()}`);
  sendSseEvent(res, "meta", {
    requestId,
    context: {
      queryTokens: retrievedContext.queryTokens,
      minScore: retrievedContext.minScore,
      maxEntries: retrievedContext.maxEntries,
      detectedIntent: retrievedContext.detectedIntent,
      intentConfidence: retrievedContext.intentConfidence,
      intentScores: retrievedContext.intentScores,
      ingestion: retrievedContext.ingestion,
      items: contextMeta,
    },
  });

  let clientClosed = false;
  res.on("close", () => {
    clientClosed = true;
    console.info(`[chat][${requestId}] connection closed by client after ${Date.now() - startedAt}ms`);
  });

  try {
    let correctionHint = "";
    let recommendationPayload = null;
    let reasoningTokens = 0;
    let repairUsed = false;
    let completedAttempt = 0;

    for (let attempt = 1; attempt <= MAX_MODEL_ATTEMPTS; attempt += 1) {
      const completion = await requestModelCompletion({
        prompt: buildUserPrompt({
          message,
          contextBlock,
          correctionHint,
        }),
        timeoutMs,
      });

      reasoningTokens = completion.reasoningTokens || reasoningTokens;

      const parsed = parseAndValidateStructuredRecommendation(completion.text);

      if (parsed.ok) {
        recommendationPayload = parsed.value;
        completedAttempt = attempt;
        break;
      }

      const repaired = await requestModelCompletion({
        prompt: buildRepairPrompt({
          malformedOutput: completion.text,
          correctionHint: parsed.details,
        }),
        timeoutMs: Math.min(timeoutMs, 25000),
        systemPrompt: REPAIR_SYSTEM_PROMPT,
      });

      reasoningTokens = repaired.reasoningTokens || reasoningTokens;

      const repairedParsed = parseAndValidateStructuredRecommendation(repaired.text);
      if (repairedParsed.ok) {
        recommendationPayload = repairedParsed.value;
        repairUsed = true;
        completedAttempt = attempt;
        console.info(`[chat][${requestId}] structured JSON repaired successfully on attempt ${attempt}`);
        break;
      }

      correctionHint = `${parsed.details} ${repairedParsed.details} Ensure valid JSON with all required fields.`;
      console.warn(`[chat][${requestId}] invalid model response on attempt ${attempt}: ${parsed.details}`);
    }

    if (!recommendationPayload) {
      const details = "The AI model did not return valid structured JSON after multiple attempts. Please retry.";
      console.warn(`[chat][${requestId}] ai-only mode: no valid structured output after ${MAX_MODEL_ATTEMPTS} attempts`);

      if (!clientClosed) {
        sendSseEvent(res, "error", {
          error: "Invalid AI response format",
          details,
          requestId,
        });
      }

      res.end();
      return;
    }

    const serializedPayload = JSON.stringify(recommendationPayload);

    for (const tokenChunk of splitInChunks(serializedPayload, OUTBOUND_TOKEN_CHUNK_SIZE)) {
      if (clientClosed) {
        break;
      }

      sendSseEvent(res, "token", { token: tokenChunk });
    }

    if (!clientClosed && reasoningTokens) {
      sendSseEvent(res, "usage", {
        reasoningTokens,
      });
    }

    if (!clientClosed) {
      sendSseEvent(res, "diagnostics", {
        requestId,
        attempts: completedAttempt || MAX_MODEL_ATTEMPTS,
        repairUsed,
      });
    }

    if (!clientClosed) {
      sendSseEvent(res, "done", { done: true });
      res.end();
      console.info(`[chat][${requestId}] stream completed in ${Date.now() - startedAt}ms`);
    }
  } catch (error) {
    console.error(`[chat][${requestId}] streaming error:`, error);

    const isTimeout = error?.name === "RequestTimeoutError" || /timeout/i.test(error?.message || "");
    const details = isTimeout
      ? "The AI provider took too long to respond. Please retry."
      : error?.message || "Unknown error";

    if (!res.headersSent) {
      return res.status(isTimeout ? 504 : 500).json({
        error: "Chat stream failed",
        details,
        requestId,
      });
    }

    sendSseEvent(res, "error", {
      error: "Chat stream failed",
      details,
      requestId,
    });
    res.end();
  }
});

export default chatRouter;
