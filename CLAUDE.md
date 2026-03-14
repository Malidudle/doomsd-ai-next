# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx playwright test  # Run all E2E tests (requires dev server running)
npx playwright test tests/map.spec.ts  # Run a single test file
```

## Architecture

**bitchat** is an offline-capable emergency preparedness app built with Next.js 16 (App Router) + TypeScript. It combines a terminal-themed AI chat interface with an interactive survival map.

### Two main routes

- `/` — Chat page. Terminal-style UI that streams responses from a local Ollama LLM (Qwen models). Automatically fetches user geolocation and nearby POIs to inject as location context into the AI system prompt.
- `/map` — Offline-capable Leaflet map. Displays POIs (hospitals, shelters, water, fuel, etc.), supports A* routing on cached road graphs, and downloads map tiles for offline use.

### AI chat (`src/app/api/chat/route.ts`)

Uses Vercel AI SDK (`ai` + `@ai-sdk/react`) with `ollama-ai-provider-v2` for local LLM inference. The chat API accepts an optional `locationContext` string (formatted POI data) that gets prepended to the system prompt.

### Offline data pipeline (`src/lib/`)

Three-layer offline system, all client-side:

1. **POI system** (`lib/poi/`) — Queries Overpass API for emergency-relevant points of interest, caches in IndexedDB (`bitchat-poi`), 30-minute staleness window. 12 categories defined in `categories.ts`.
2. **Road/routing system** (`lib/roads/`) — Fetches OSM road data via Overpass, compresses into a graph (nodes=intersections, edges=segments), stores in IndexedDB (`bitchat-roads`). A* pathfinding with 200ms timeout guard and 500m snap tolerance.
3. **Tile caching** (`lib/tileCache.ts` + `public/sw.js`) — Service worker caches CartoDB dark tiles via Cache API (1000 tile max). Network-first strategy with cache fallback.

### Map components (`src/components/`)

`MapView.tsx` is the main map orchestrator — handles tile caching, geolocation, download-area, and routing controls. `POIMarkers.tsx` renders clustered markers with category filtering. `RouteLayer.tsx` draws computed routes.

### Hooks (`src/hooks/`)

`usePOI` and `useRoute` manage data fetching and caching for their respective systems. `useOnlineStatus` tracks connectivity for offline mode.

### Styling

CRT terminal aesthetic via CSS custom properties in `globals.css`. Green-on-black theme with scanline effects. Tailwind v4. Fonts: IBM Plex Mono + Space Mono.

### Path alias

`@/*` maps to `./src/*` (configured in tsconfig).

## Testing

Playwright E2E tests in `tests/`. Tests run against Chromium with dev server on port 3000. No unit test framework is configured.
