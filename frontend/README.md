# Frontend

React SPA for the interactive landing page and typography chat experience.

## Responsibilities

- Render marketing/hero content and feature sections.
- Send user prompt to backend chat stream endpoint.
- Consume SSE incrementally and render recommendation results.
- Parse structured AI output safely.
- Resolve and enrich recommended fonts from backend catalog.
- Render recommendation cards with:
	- Editable preview text.
	- Interactive variant buttons (weight/style).
	- Font download link.

## Stack

- React 19
- Vite 6
- Tailwind CSS 4
- Lucide React

## Run frontend

From repository root:

```bash
pnpm --filter frontend dev
```

Build:

```bash
pnpm --filter frontend build
```

Preview production build:

```bash
pnpm --filter frontend start
```

## Environment variable

- VITE_API_BASE_URL: backend base URL (default http://localhost:3001).

## Main flow

1. User submits context in chat panel.
2. useChatStream calls streamChat service.
3. streamChat consumes SSE events from /api/chat/stream.
4. token events are concatenated to response text.
5. parseAiRecommendation transforms response text into structured object.
6. useResolvedFontCards enriches each recommendation via /api/fonts/:family.
7. Font cards render preview, variant controls, and download links.

## SSE events handled

- token
- meta
- diagnostics
- usage
- done
- error

The UI currently uses token and error as core signals, and keeps meta/diagnostics in hook state for optional future use.

## Project structure

```text
frontend/
	src/
		components/
			ChatPanel.jsx
			FontRecommendationCard.jsx
			LandingHero.jsx
			FeatureList.jsx
		hooks/
			useChatStream.js
			useResolvedFontCards.js
		services/
			chatService.js
			fontCatalogService.js
		utils/
			parseAiRecommendation.js
		App.jsx
		main.jsx
```

## Key components

- ChatPanel: input, actions, loading/error/success states, card layout.
- FontRecommendationCard: visual card + variant buttons controlling preview weight/style.

## Error handling

- Stream request timeout handling.
- Abort handling when user stops a request.
- Friendly network/offline error messages.
- Safe JSON parse with object extraction fallback.

## Styling notes

- Tailwind utility-first styling.
- Mobile-first responsive behavior.
- Dynamic stylesheet injection for recommended font families.

## Developer notes

- Keep API keys out of frontend.
- Use backend endpoints only.
- Keep components modular; split files if component complexity grows.

## Related docs

- Root overview: ../README.md
- Backend details: ../backend/README.md
