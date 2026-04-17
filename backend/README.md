# Backend

Express backend that proxies AI calls, validates responses, and streams structured typography recommendations to the frontend.

## Responsibilities

- Protect API keys from the client.
- Validate and sanitize chat input.
- Retrieve typography context (RAG-lite).
- Call Groq with streaming enabled.
- Repair malformed JSON via a second AI pass.
- Stream SSE events to the frontend.
- Expose font catalog endpoints.
- Expose knowledge retrieval diagnostics endpoint.

## Stack

- Node.js (ESM)
- Express 5
- groq-sdk
- dotenv
- cors

## Run backend

From repository root:

```bash
pnpm --filter backend dev
```

Production mode:

```bash
pnpm --filter backend start
```

Backend listens on PORT (default 3001).

## Environment loading

The backend loads environment files in this order:

1. root .env
2. backend/.env (overrides root values if present)

This behavior is implemented in src/server.js.

## Environment variables

- GROQ_API_KEY: required for chat endpoint.
- GROQ_MODEL: model id (default openai/gpt-oss-20b).
- GROQ_MAX_COMPLETION_TOKENS: maximum tokens requested for model generation (default 3072).
- GROQ_TIMEOUT_MS: timeout for model requests (ms).
- CHAT_MAX_MODEL_ATTEMPTS: max generation attempts before returning format error.
- PORT: HTTP port.
- CORS_ORIGINS: comma-separated list of allowed origins.
- FONT_PROVIDER: active provider key (google-fonts).
- GOOGLE_FONTS_API_KEY: Google Webfonts API key.
- FONTS_CACHE_TTL_MS: font catalog cache TTL.
- TYPO_CONTEXT_MAX_ENTRIES: max number of retrieved docs sent in prompt.
- TYPO_CONTEXT_MIN_SCORE: minimum retrieval score.
- KNOWLEDGE_DIR: folder used for external knowledge ingestion.
- KNOWLEDGE_CACHE_TTL_MS: ingestion cache TTL.

Recommended value in this repository:

- KNOWLEDGE_DIR=backend/knowledge

## API endpoints

### Health

- GET /health

Response example:

```json
{ "ok": true, "service": "backend" }
```

### Chat streaming

- POST /api/chat/stream

Request body:

```json
{ "message": "Need typography for a fintech landing page" }
```

SSE events emitted:

- meta: request id and retrieval metadata.
- token: chunk of serialized JSON recommendation payload.
- usage: reasoning token metadata (if provided by model).
- diagnostics: generation attempts and whether repair was used.
- done: stream completion.
- error: controlled stream error.

Important behavior:

- AI-only mode: if valid structured JSON cannot be produced after attempts, backend sends SSE error and ends stream.
- JSON repair layer: after malformed generation, backend asks the model to repair output into strict JSON.

### Font catalog

- GET /api/fonts/providers
- GET /api/fonts?q=<query>&category=<category>&limit=<n>
- GET /api/fonts/:family

Notes:

- Uses Google Webfonts API when GOOGLE_FONTS_API_KEY is available.
- Falls back to embedded catalog when API key is missing or provider request fails.

### Knowledge search (debug/retrieval introspection)

- GET /api/knowledge/search?q=<query>

Response includes:

- tokenized query
- detected intent and confidence
- score details per item
- ingestion diagnostics
- formatted context preview

## Code structure

```text
backend/
  src/
    app.js
    server.js
    routes/
      chat.js
      fonts.js
      knowledge.js
    services/
      groqClient.js
      fonts/
      knowledge/
    utils/
      sanitizeChatInput.js
      structuredRecommendation.js
      typographyKnowledgeBase.js
    data/
      typographyKnowledgeDocuments.js
```

## Security and resilience

- CORS allowlist via CORS_ORIGINS.
- Security headers set at app level.
- Input sanitization and max message length checks.
- Controlled timeout and error messages.
- No secret values exposed to frontend.

## Troubleshooting

### GROQ_API_KEY warning

If you see GROQ_API_KEY is not set:

- Ensure .env exists at root or backend/.env.
- Ensure backend restarted after changing .env.

### GOOGLE_FONTS_API_KEY warning

If you see fallback to embedded font catalog:

- Verify GOOGLE_FONTS_API_KEY in .env.
- Confirm backend process is loading the expected .env file.

### Invalid AI response format

If chat ends with format error:

- Increase CHAT_MAX_MODEL_ATTEMPTS moderately.
- Review model selection in GROQ_MODEL.
- Check logs for repairUsed and attempt count.

## Related docs

- Root overview: ../README.md
- Knowledge schema: ../backend/knowledge/README.md
- Frontend details: ../frontend/README.md
