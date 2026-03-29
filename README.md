# Fontit

Interactive landing page with an AI typography assistant.

The app helps users describe a UI/UX context and receive structured font recommendations, rendered as visual cards with editable preview text and selectable font variants.

## Project structure

```text
hackaton-cubepath/
  frontend/    React + Vite + Tailwind SPA
  backend/     Express proxy + SSE + AI orchestration
  knowledge/   External knowledge documents (JSON/Markdown)
```

## Tech stack

- Package manager: pnpm only
- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express, OpenRouter SDK
- Streaming: Server-Sent Events (SSE)

## Features

- AI-driven typography recommendations with strict JSON contract.
- AI-only recommendation mode (no hardcoded recommendation fallback payload).
- Automatic JSON-repair pass via AI when model output is malformed.
- Font cards with:
  - Editable preview text.
  - Download link.
  - Interactive variant buttons (weight/style).
- RAG-lite context retrieval:
  - Internal typography corpus.
  - External ingestion from knowledge/ directory.
  - Intent-aware reranking (landing, dashboard, ecommerce, editorial).

## Prerequisites

- Node.js 20+
- pnpm 10+

## Quick start

1. Install dependencies:

```bash
pnpm install
```

2. Create local environment file from template:

```bash
cp .env.example .env
```

3. Fill required variables in .env:

- OPENROUTER_API_KEY
- OPENROUTER_MODEL (optional override)
- GOOGLE_FONTS_API_KEY (recommended)

4. Run frontend and backend together:

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Workspace scripts

- pnpm dev: run frontend and backend in parallel
- pnpm dev:frontend: run only frontend
- pnpm dev:backend: run only backend
- pnpm build: build all workspaces

## Environment variables

Use .env.example as source of truth.

### Backend

- OPENROUTER_API_KEY: OpenRouter API key.
- OPENROUTER_MODEL: model id (default openrouter/free).
- OPENROUTER_TIMEOUT_MS: timeout per model request.
- CHAT_MAX_MODEL_ATTEMPTS: max generation attempts before error.
- PORT: backend port.
- CORS_ORIGINS: comma-separated allowlist.
- FONT_PROVIDER: currently google-fonts.
- GOOGLE_FONTS_API_KEY: Google Webfonts API key.
- FONTS_CACHE_TTL_MS: Google font catalog cache TTL.
- TYPO_CONTEXT_MAX_ENTRIES: max context docs in prompt.
- TYPO_CONTEXT_MIN_SCORE: retrieval score threshold.
- KNOWLEDGE_DIR: path to external knowledge folder.
- KNOWLEDGE_CACHE_TTL_MS: external docs cache TTL.

### Frontend

- VITE_API_BASE_URL: backend base URL.

## API overview

- GET /health
- POST /api/chat/stream (SSE)
- GET /api/fonts/providers
- GET /api/fonts
- GET /api/fonts/:family
- GET /api/knowledge/search

For full backend details, see backend/README.md.

## Knowledge ingestion

Add JSON/Markdown files under knowledge/ to extend context without code changes.

- JSON: array or { "documents": [...] }
- Markdown: optional frontmatter + body content
- Supported intents: landing, dashboard, ecommerce, editorial

See knowledge/README.md for exact schema examples.

## Frontend behavior

The frontend consumes SSE events from /api/chat/stream:

- meta
- token
- usage
- diagnostics
- done
- error

Tokens are concatenated and parsed into structured recommendation objects.

## Deployment notes

- Keep secrets only in .env (never commit real keys).
- Configure CORS_ORIGINS to your production frontend domains.
- Build all workspaces with pnpm build before release.

See DEPLOY_CHECKLIST.md for deployment checklist.

## Additional documentation

- Frontend guide: frontend/README.md
- Backend guide: backend/README.md
- Knowledge format: knowledge/README.md
- Plan and phases: PLAN.md
