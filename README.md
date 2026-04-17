# Fontit

A polished landing page with an AI typography assistant that turns UI/UX briefs into structured font recommendations.

## What it does

Fontit helps product teams, designers, and content creators by:

- converting interface descriptions into typographic systems
- recommending Google Fonts families, weights, and usage rationale
- rendering recommendations as interactive font cards
- supporting editable preview text and selectable font variants
- handling malformed AI responses with an automatic repair pass

## Project structure

```text
hackaton-cubepath/
  frontend/          React + Vite + Tailwind SPA
  backend/           Express proxy + SSE + AI orchestration
  backend/knowledge/ External typography knowledge documents
```

## Technology stack

- Package manager: pnpm only
- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express, Groq SDK
- Streaming: Server-Sent Events (SSE)

## Key features

- AI-first typography recommendations with a strict JSON contract
- No hardcoded fallback recommendations in the UI
- Robust backend validation and JSON repair for malformed model output
- Interactive font cards with preview text and download links
- External knowledge ingestion from `backend/knowledge/`
- Intent-aware reranking for landing pages, dashboards, ecommerce, and editorial use cases

## Requirements

- Node.js 20+
- pnpm 10+

## Quick start

1. Install dependencies:

```bash
pnpm install
```

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Fill required variables in `.env`:

- `GROQ_API_KEY`
- `GROQ_MODEL` (optional)
- `GOOGLE_FONTS_API_KEY` (recommended)

4. Start both frontend and backend:

```bash
pnpm dev
```

5. Open the app:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Useful workspace scripts

- `pnpm dev` — run frontend and backend together
- `pnpm dev:frontend` — run only frontend
- `pnpm dev:backend` — run only backend
- `pnpm build` — build all workspaces

## Environment variables

Use `.env.example` as the source of truth.

### Backend variables

- `GROQ_API_KEY`: Groq API key
- `GROQ_MODEL`: model ID (default: `openai/gpt-oss-20b`)
- `GROQ_TIMEOUT_MS`: request timeout for model calls
- `CHAT_MAX_MODEL_ATTEMPTS`: retries before failing
- `PORT`: backend port
- `CORS_ORIGINS`: comma-separated allowed frontend origins
- `FONT_PROVIDER`: currently `google-fonts`
- `GOOGLE_FONTS_API_KEY`: Google Fonts API key
- `FONTS_CACHE_TTL_MS`: font catalog cache TTL
- `TYPO_CONTEXT_MAX_ENTRIES`: max documents included in prompt context
- `TYPO_CONTEXT_MIN_SCORE`: retrieval threshold for knowledge documents
- `KNOWLEDGE_DIR`: external knowledge folder path
- `KNOWLEDGE_CACHE_TTL_MS`: external docs cache TTL

### Frontend variables

- `VITE_API_BASE_URL`: backend base URL

## API overview

- `GET /health`
- `POST /api/chat/stream` — SSE chat stream
- `GET /api/fonts/providers`
- `GET /api/fonts`
- `GET /api/fonts/:family`
- `GET /api/knowledge/search`

For backend implementation details, see `backend/README.md`.

## Extending knowledge

Add new JSON or Markdown files under `backend/knowledge/` to expand the assistant's typography corpus.

- JSON: array or object with `documents`
- Markdown: optional front matter + content body
- Supported intents: `landing`, `dashboard`, `ecommerce`, `editorial`

See `backend/knowledge/README.md` for schema examples.

## Frontend behavior notes

The frontend consumes SSE events from `/api/chat/stream` and handles these event types:

- `meta`
- `token`
- `usage`
- `diagnostics`
- `done`
- `error`

Tokens are concatenated and parsed into structured recommendation objects.

## Deployment notes

- Never commit real secrets. Keep API keys in `.env` only.
- Set `CORS_ORIGINS` to production frontend domains.
- Run `pnpm build` for both frontend and backend before deployment.

See `DEPLOY_CHECKLIST.md` for deployment steps and validation.

## Additional documentation

- `frontend/README.md`
- `backend/README.md`
- `backend/knowledge/README.md`
- `PLAN.md`
