# Map AI Command Bar — Design Spec

## Overview

Add an AI-powered command bar to the map page that lets users control the map with natural language. The AI (Ollama, qwen3.5) uses tool calling to trigger map actions: routing, zooming, filtering, highlighting POIs, and caching areas. Also: persist last known location so the map never opens to a zoomed-out world view.

The existing chat page at `/` remains unchanged — it serves a different purpose (survival guides).

---

## Features

### 1. Command Bar UI

- Full-width input bar pinned to bottom of map, terminal-style with green `▶` prompt
- AI responses appear as a toast overlay above the command bar, auto-fades after 5 seconds
- Existing map controls (LOCATE, SET START, etc.) shift up to sit above the command bar
- No chat history on screen — fire-and-forget command interface
- SEND button or Enter key to submit

### 2. AI Tool Calling (Ollama)

Five tools available to the AI:

| Tool | Parameters | Map Action |
|------|-----------|------------|
| `route_to` | `category?: string, name?: string` | Finds matching POI, computes and displays walking route |
| `zoom_to` | `category?: string, name?: string, lat?: number, lng?: number` | Flies map to a POI or coordinates |
| `toggle_categories` | `show?: string[], hide?: string[]` | Enables/disables POI category filters |
| `highlight_poi` | `category?: string, name?: string` | Opens popup on matching marker |
| `download_area` | *(none)* | Triggers tile + POI + road caching for current viewport |

### 3. Last Known Location Persistence

- Save user's position + zoom to localStorage on every map move (debounced 5s)
- On map mount: use GPS if available → else last known location → else default center
- Eliminates the zoomed-out world view on return visits

---

## Architecture

### API Layer

**New endpoint: `POST /api/map-chat`**

Separate from `/api/chat`. Different system prompt, different tools.

Request body:
```ts
{
  messages: UIMessage[];
  model?: string;
  locationContext?: string;  // formatted POI context string
}
```

Response: Streamed text + tool calls via Vercel AI SDK `streamText()`.

System prompt:
```
You are an emergency map assistant. You help users navigate to nearby resources.
Use your tools to control the map — don't just describe what you'd do, actually do it.
Be concise. One sentence max unless the user asks for detail.

NEARBY RESOURCES:
{locationContext}
```

Tool schemas defined using `zod` + AI SDK `tool()` helper. Ollama processes them via `ollama-ai-provider-v2` which supports tool use.

Model validation: same as existing chat — allow `qwen3.5:0.8b` and `qwen3.5:4b`, default to `4b`.

### Tool Execution: Frontend-Side

Tools control browser state (Leaflet map, React state, IndexedDB). Nothing to execute server-side. Flow:

1. User types command in command bar
2. `useMapChat` hook sends to `/api/map-chat` with POI context
3. Ollama returns streamed text + tool calls
4. AI SDK `onToolCall` callback in the hook receives tool call
5. Hook dispatches to map action callbacks (provided by MapView)
6. Toast displays AI's text response

### POI Resolution: `src/lib/poi/poiResolver.ts`

Shared logic for tools that target a POI (route_to, zoom_to, highlight_poi):

```ts
resolveNearestPOI(category, lat, lng, pois): POI | null
// Filters cached POIs by category, returns closest to given position

resolvePOIByName(name, pois): POI | null
// Case-insensitive substring match against cached POI names
// Returns first match (POIs already sorted by distance from formatPOIContext)
```

Both functions operate on the in-memory POI array from `usePOI` — no additional IndexedDB reads needed.

### Last Known Location: `src/lib/locationStore.ts`

```ts
saveLastLocation(lat: number, lng: number, zoom: number): void
// Writes to localStorage key "bitchat-last-location"
// Called on map moveend, debounced 5 seconds

getLastLocation(): { lat: number; lng: number; zoom: number } | null
// Reads from localStorage, returns null if not set
```

MapView initialization changes:
```
GPS available → use GPS, save as last location
GPS unavailable → getLastLocation() → use if exists
Neither → default center (current [20, 0] zoom 2 fallback)
```

### Hook: `src/hooks/useMapChat.ts`

```ts
useMapChat({
  pois: POI[],
  effectiveStart: [number, number] | null,
  onRouteTo: (lat: number, lng: number) => void,
  onZoomTo: (lat: number, lng: number) => void,
  onToggleCategories: (show?: string[], hide?: string[]) => void,
  onHighlightPOI: (lat: number, lng: number, name: string) => void,
  onDownloadArea: () => void,
})
→ {
  toast: { text: string; visible: boolean } | null,
  sendCommand: (text: string) => void,
  isProcessing: boolean,
}
```

- Maintains internal message array (not displayed, just for multi-turn context)
- Formats POI context from `pois` + `effectiveStart` on each send
- `onToolCall` resolves POI targets using `poiResolver`, then dispatches
- Manages toast visibility with 5-second auto-fade timer

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/map-chat/route.ts` | **new** | API endpoint with Ollama tool definitions |
| `src/lib/poi/poiResolver.ts` | **new** | POI resolution by category/name |
| `src/lib/locationStore.ts` | **new** | localStorage persistence for last position |
| `src/hooks/useMapChat.ts` | **new** | Chat hook with tool dispatch + toast state |
| `src/components/MapCommandBar.tsx` | **new** | Input bar + toast overlay component |
| `src/components/MapView.tsx` | **modify** | Integrate command bar, last location, action callbacks |

---

## Constraints

- **Phone-first**: Command bar must be usable on mobile. Full-width, large enough tap target.
- **Battery-friendly**: No polling, no auto-refresh. AI calls only when user submits a command.
- **Offline-aware**: Command bar should show "offline" state when navigator is offline. Ollama runs locally so it works offline if the model is loaded.
- **Model**: Uses same Ollama models as existing chat (qwen3.5:0.8b / 4b). Tool calling supported by ollama-ai-provider-v2.

## Non-Goals

- No chat history UI on the map page
- No voice input
- No auto-suggestions / autocomplete
- No changes to the existing `/` chat page
- No new AI models or providers
