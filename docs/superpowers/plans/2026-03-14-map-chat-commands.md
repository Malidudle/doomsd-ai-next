# Map AI Command Bar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI command bar to the map page that uses Ollama tool calling to control the map (route, zoom, filter, highlight, download), plus persist last known location.

**Architecture:** New `/api/map-chat` endpoint defines 5 tools via AI SDK + zod. Frontend `useMapChat` hook streams responses, catches tool calls via `onToolCall`, resolves POI targets, and dispatches to map action callbacks. `MapCommandBar` component renders a pinned input bar + auto-fading toast. `locationStore` persists last position to localStorage.

**Tech Stack:** Next.js 16, React 19, Ollama via `ollama-ai-provider-v2`, Vercel AI SDK (`ai` + `@ai-sdk/react`), `zod` (already installed as transitive dep), Leaflet, IndexedDB via `idb`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/locationStore.ts` | **create** | localStorage read/write for last known position + zoom |
| `src/lib/poi/poiResolver.ts` | **create** | Resolve POIs by category (nearest) or name (fuzzy match) |
| `src/app/api/map-chat/route.ts` | **create** | API endpoint: Ollama streamText with 5 tool schemas |
| `src/hooks/useMapChat.ts` | **create** | Chat transport, tool call dispatch, toast state management |
| `src/components/MapCommandBar.tsx` | **create** | Input bar + toast overlay UI component |
| `src/components/MapView.tsx` | **modify** | Integrate command bar, last location, action callbacks, highlight state |
| `src/components/POIMarkers.tsx` | **modify** | Accept `highlightedPOI` prop to programmatically open popup |

---

## Chunk 1: Foundation Layer

### Task 1: Last Known Location Store

**Files:**
- Create: `src/lib/locationStore.ts`

- [ ] **Step 1: Create locationStore.ts**

```ts
// src/lib/locationStore.ts
const STORAGE_KEY = 'bitchat-last-location';

interface LastLocation {
  lat: number;
  lng: number;
  zoom: number;
}

export function saveLastLocation(lat: number, lng: number, zoom: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, zoom }));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function getLastLocation(): LastLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && typeof parsed.zoom === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add src/lib/locationStore.ts
git commit -m "feat: add localStorage persistence for last known map location"
```

---

### Task 2: POI Resolver

**Files:**
- Create: `src/lib/poi/poiResolver.ts`

- [ ] **Step 1: Create poiResolver.ts**

```ts
// src/lib/poi/poiResolver.ts
import type { POI, POICategory } from './categories';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function resolveNearestPOI(
  category: string,
  lat: number,
  lng: number,
  pois: POI[],
): POI | null {
  let best: POI | null = null;
  let bestDist = Infinity;

  for (const p of pois) {
    if (p.category !== category) continue;
    const d = haversineKm(lat, lng, p.lat, p.lng);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }

  return best;
}

export function resolvePOIByName(
  name: string,
  pois: POI[],
): POI | null {
  const lower = name.toLowerCase();
  return pois.find((p) => p.name.toLowerCase().includes(lower)) ?? null;
}

export function resolvePOI(
  opts: { category?: string; name?: string },
  lat: number,
  lng: number,
  pois: POI[],
): POI | null {
  if (opts.name) {
    const byName = resolvePOIByName(opts.name, pois);
    if (byName) return byName;
  }
  if (opts.category) {
    return resolveNearestPOI(opts.category, lat, lng, pois);
  }
  return null;
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add src/lib/poi/poiResolver.ts
git commit -m "feat: add POI resolver for category/name lookup"
```

---

### Task 3: Map Chat API Endpoint

**Files:**
- Create: `src/app/api/map-chat/route.ts`

- [ ] **Step 1: Create the API route with tool definitions**

```ts
// src/app/api/map-chat/route.ts
import { convertToModelMessages, streamText, tool, type UIMessage } from 'ai';
import { ollama } from 'ollama-ai-provider-v2';
import { z } from 'zod';

export const maxDuration = 60;

const ALLOWED_MODELS = ['qwen3.5:0.8b', 'qwen3.5:4b'];

const CATEGORY_ENUM = z.enum([
  'hospital', 'police', 'fire_station', 'pharmacy',
  'emergency_shelter', 'bunker', 'assembly_point',
  'weather_shelter', 'shelter', 'water', 'supermarket', 'fuel',
]);

export async function POST(req: Request) {
  const {
    messages,
    model,
    locationContext,
  }: { messages: UIMessage[]; model?: string; locationContext?: string } =
    await req.json();

  const selectedModel =
    model && ALLOWED_MODELS.includes(model) ? model : 'qwen3.5:4b';

  const system = `You are an emergency map assistant. You help users navigate to nearby resources.
Use your tools to control the map — don't just describe what you'd do, actually do it.
Be concise. One sentence max unless the user asks for detail.
${locationContext ? `\n${locationContext}` : '\nNo nearby resource data available. Suggest the user download the area first.'}`;

  const result = streamText({
    model: ollama(selectedModel),
    system,
    messages: await convertToModelMessages(messages),
    tools: {
      route_to: tool({
        description: 'Route the user to a nearby POI. Use category for nearest of a type, or name for a specific place.',
        parameters: z.object({
          category: CATEGORY_ENUM.optional().describe('POI category to route to nearest of'),
          name: z.string().optional().describe('Specific POI name to route to'),
        }),
      }),
      zoom_to: tool({
        description: 'Fly the map to a POI or specific coordinates.',
        parameters: z.object({
          category: CATEGORY_ENUM.optional().describe('POI category to zoom to nearest of'),
          name: z.string().optional().describe('Specific POI name to zoom to'),
          lat: z.number().optional().describe('Latitude to zoom to'),
          lng: z.number().optional().describe('Longitude to zoom to'),
        }),
      }),
      toggle_categories: tool({
        description: 'Show or hide POI categories on the map. Use show to enable categories, hide to disable them.',
        parameters: z.object({
          show: z.array(CATEGORY_ENUM).optional().describe('Categories to show'),
          hide: z.array(CATEGORY_ENUM).optional().describe('Categories to hide'),
        }),
      }),
      highlight_poi: tool({
        description: 'Highlight a specific POI on the map by opening its popup.',
        parameters: z.object({
          category: CATEGORY_ENUM.optional().describe('POI category to highlight nearest of'),
          name: z.string().optional().describe('Specific POI name to highlight'),
        }),
      }),
      download_area: tool({
        description: 'Cache the current map area for offline use. Downloads tiles, POIs, and road data.',
        parameters: z.object({}),
      }),
    },
    providerOptions: {
      ollama: { think: false },
    },
  });

  return result.toUIMessageStreamResponse();
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully. New route `/api/map-chat` appears in output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/map-chat/route.ts
git commit -m "feat: add /api/map-chat endpoint with 5 Ollama tool schemas"
```

---

## Chunk 2: Frontend Integration

### Task 4: useMapChat Hook

**Files:**
- Create: `src/hooks/useMapChat.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/useMapChat.ts
'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { POI } from '@/lib/poi/categories';
import { formatPOIContext } from '@/lib/poi/formatContext';
import { resolvePOI } from '@/lib/poi/poiResolver';

interface MapActions {
  onRouteTo: (lat: number, lng: number) => void;
  onZoomTo: (lat: number, lng: number) => void;
  onToggleCategories: (show?: string[], hide?: string[]) => void;
  onHighlightPOI: (lat: number, lng: number, name: string) => void;
  onDownloadArea: () => void;
}

interface UseMapChatOptions extends MapActions {
  pois: POI[];
  effectiveStart: [number, number] | null;
}

export function useMapChat({
  pois,
  effectiveStart,
  onRouteTo,
  onZoomTo,
  onToggleCategories,
  onHighlightPOI,
  onDownloadArea,
}: UseMapChatOptions) {
  const [toast, setToast] = useState<{ text: string; visible: boolean } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build location context for the AI
  const locationContext = useMemo(() => {
    if (!effectiveStart || pois.length === 0) return '';
    const [lat, lng] = effectiveStart;
    // Add distance to each POI for formatPOIContext
    const withDist = pois.map((p) => {
      const R = 6371;
      const dLat = ((p.lat - lat) * Math.PI) / 180;
      const dLng = ((p.lng - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((p.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...p, distance };
    }).filter((p) => p.distance <= 10).sort((a, b) => a.distance - b.distance);
    return formatPOIContext(lat, lng, withDist);
  }, [effectiveStart, pois]);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/map-chat', body: { locationContext } }),
    [locationContext],
  );

  const showToast = useCallback((text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, visible: true });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => prev ? { ...prev, visible: false } : null);
    }, 5000);
  }, []);

  const handleToolCall = useCallback(
    async ({ toolCall }: { toolCall: { toolName: string; args: Record<string, unknown> } }) => {
      const [lat, lng] = effectiveStart || [0, 0];
      const args = toolCall.args;

      switch (toolCall.toolName) {
        case 'route_to': {
          const poi = resolvePOI(
            { category: args.category as string, name: args.name as string },
            lat, lng, pois,
          );
          if (poi) {
            onRouteTo(poi.lat, poi.lng);
            return `Routing to ${poi.name || poi.category} at ${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}`;
          }
          return 'Could not find matching POI';
        }
        case 'zoom_to': {
          if (typeof args.lat === 'number' && typeof args.lng === 'number') {
            onZoomTo(args.lat as number, args.lng as number);
            return `Zooming to ${args.lat}, ${args.lng}`;
          }
          const poi = resolvePOI(
            { category: args.category as string, name: args.name as string },
            lat, lng, pois,
          );
          if (poi) {
            onZoomTo(poi.lat, poi.lng);
            return `Zooming to ${poi.name || poi.category}`;
          }
          return 'Could not find matching POI';
        }
        case 'toggle_categories': {
          onToggleCategories(args.show as string[], args.hide as string[]);
          return 'Categories updated';
        }
        case 'highlight_poi': {
          const poi = resolvePOI(
            { category: args.category as string, name: args.name as string },
            lat, lng, pois,
          );
          if (poi) {
            onHighlightPOI(poi.lat, poi.lng, poi.name);
            return `Highlighting ${poi.name || poi.category}`;
          }
          return 'Could not find matching POI';
        }
        case 'download_area': {
          onDownloadArea();
          return 'Download started';
        }
        default:
          return 'Unknown tool';
      }
    },
    [effectiveStart, pois, onRouteTo, onZoomTo, onToggleCategories, onHighlightPOI, onDownloadArea],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onToolCall: handleToolCall,
  });

  const isProcessing = status === 'streaming';

  // Show toast when AI responds with text (via useEffect, not during render)
  const lastAssistantMsg = messages.filter((m) => m.role === 'assistant').at(-1);
  const lastTextRef = useRef('');
  useEffect(() => {
    if (!lastAssistantMsg) return;
    const text = lastAssistantMsg.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') || '';
    if (text && text !== lastTextRef.current) {
      lastTextRef.current = text;
      showToast(text);
    }
  }, [lastAssistantMsg, showToast]);

  const sendCommand = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendMessage({ text });
    },
    [sendMessage],
  );

  return { toast, sendCommand, isProcessing };
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMapChat.ts
git commit -m "feat: add useMapChat hook with tool dispatch and toast state"
```

---

### Task 5: MapCommandBar Component

**Files:**
- Create: `src/components/MapCommandBar.tsx`

- [ ] **Step 1: Create the command bar component**

```tsx
// src/components/MapCommandBar.tsx
'use client';

import { useState, useCallback } from 'react';

interface Props {
  onSend: (text: string) => void;
  isProcessing: boolean;
  toast: { text: string; visible: boolean } | null;
}

export default function MapCommandBar({ onSend, isProcessing, toast }: Props) {
  const [input, setInput] = useState('');

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isProcessing) return;
    onSend(input.trim());
    setInput('');
  }, [input, isProcessing, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <>
      {/* Toast overlay */}
      {toast && toast.visible && (
        <div
          className="absolute left-1/2 z-[1001] -translate-x-1/2 rounded border border-green bg-surface/95 px-3 py-2 font-mono text-[11px]"
          style={{
            bottom: '52px',
            maxWidth: '90vw',
            boxShadow: '0 0 12px rgba(51,204,51,0.15)',
            transition: 'opacity 0.3s',
          }}
        >
          <div className="text-green text-[10px] mb-0.5">▶ AI</div>
          <div className="text-foreground">{toast.text}</div>
        </div>
      )}

      {/* Command bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1001] flex items-center gap-2 border-t bg-background/95 px-3 py-2 font-mono text-[11px]"
        style={{ borderColor: 'var(--green)' }}
      >
        <span className="text-green">▶</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isProcessing ? 'processing...' : 'ask the map...'}
          disabled={isProcessing}
          className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={isProcessing || !input.trim()}
          className="border border-green px-2 py-0.5 text-green hover:bg-green hover:text-background disabled:opacity-30"
        >
          {isProcessing ? '...' : 'SEND'}
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/MapCommandBar.tsx
git commit -m "feat: add MapCommandBar component with input bar and toast"
```

---

### Task 6: Integrate into MapView

**Files:**
- Modify: `src/components/MapView.tsx`
- Modify: `src/components/POIMarkers.tsx`

This task wires everything together: command bar, last location, action callbacks, highlight state.

- [ ] **Step 1: Add highlightedPOI support to POIMarkers.tsx**

Update the imports at the top of `src/components/POIMarkers.tsx`:
```ts
// Change this line:
import { useMemo } from 'react';
// To:
import { useMemo, useEffect } from 'react';

// Change this line:
import { Marker, Popup, useMapEvents } from 'react-leaflet';
// To:
import { Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
```

Add `highlightedPOI` to the Props interface:
```ts
interface Props {
  pois: POI[];
  enabledCategories: Set<POICategory>;
  userPosition: [number, number] | null;
  onBoundsChange: (bounds: L.LatLngBounds) => void;
  onRoute?: (lat: number, lng: number) => void;
  highlightedPOI?: { lat: number; lng: number } | null;
}
```

Add a new child component above the `POIMarkers` default export:
```tsx
function HighlightHandler({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.eachLayer((layer: L.Layer) => {
      if (layer instanceof L.Marker) {
        const pos = layer.getLatLng();
        if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
          map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 1 });
          setTimeout(() => layer.openPopup(), 1100);
        }
      }
    });
  }, [map, lat, lng]);
  return null;
}
```

Update the component signature and add the render:
```tsx
export default function POIMarkers({ pois, enabledCategories, userPosition, onBoundsChange, onRoute, highlightedPOI }: Props) {
```

Add inside the return JSX, after `<BoundsTracker>`:
```tsx
{highlightedPOI && <HighlightHandler lat={highlightedPOI.lat} lng={highlightedPOI.lng} />}
```

- [ ] **Step 2: Modify MapView.tsx — imports and state**

Add new imports at the top of `MapView.tsx`:
```ts
import MapCommandBar from './MapCommandBar';
import { useMapChat } from '@/hooks/useMapChat';
import { saveLastLocation, getLastLocation } from '@/lib/locationStore';
```

Add new state inside the `MapView` component:
```ts
const [highlightedPOI, setHighlightedPOI] = useState<{ lat: number; lng: number } | null>(null);
```

- [ ] **Step 3: Modify MapView.tsx — last known location**

Add state initialized from last known location at the top of the `MapView` component (before existing state):
```ts
const [initialCenter] = useState<[number, number]>(() => {
  const last = getLastLocation();
  return last ? [last.lat, last.lng] : DEFAULT_CENTER;
});
const [initialZoom] = useState(() => {
  const last = getLastLocation();
  return last ? last.zoom : DEFAULT_ZOOM;
});
```

Update the `MapContainer` props:
```tsx
center={position || initialCenter}
zoom={position ? 14 : initialZoom}
```

Replace the geolocation useEffect:
```ts
// Geolocation with last-known-location fallback
useEffect(() => {
  const lastLoc = getLastLocation();
  if (lastLoc) {
    setPosition([lastLoc.lat, lastLoc.lng]);
    setZoom(lastLoc.zoom);
  }
  navigator.geolocation?.getCurrentPosition(
    (pos) => {
      const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setPosition(coords);
      saveLastLocation(coords[0], coords[1], 14);
    },
    () => {} // keep lastLoc or default
  );
}, []);
```

Add a debounced save on map movement. Add this effect after the zoom tracking effect:
```ts
// Save last location on map move (debounced 5s) + beforeunload
useEffect(() => {
  if (!mapRef) return;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    const center = mapRef.getCenter();
    saveLastLocation(center.lat, center.lng, mapRef.getZoom());
  };
  const handler = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 5000);
  };
  mapRef.on('moveend', handler);
  window.addEventListener('beforeunload', save);
  return () => {
    mapRef.off('moveend', handler);
    window.removeEventListener('beforeunload', save);
    if (timer) clearTimeout(timer);
  };
}, [mapRef]);
```

- [ ] **Step 4: Modify MapView.tsx — action callbacks for useMapChat**

Add action callback functions:

```ts
const handleZoomTo = useCallback((lat: number, lng: number) => {
  if (mapRef) mapRef.flyTo([lat, lng], Math.max(mapRef.getZoom(), 16), { duration: 1.5 });
}, [mapRef]);

const handleToggleCategories = useCallback((show?: string[], hide?: string[]) => {
  setEnabledCategories((prev) => {
    const next = new Set(prev);
    if (show) for (const c of show) next.add(c as POICategory);
    if (hide) for (const c of hide) next.delete(c as POICategory);
    return next;
  });
}, []);

const handleHighlightPOI = useCallback((lat: number, lng: number, _name: string) => {
  setHighlightedPOI({ lat, lng });
}, []);
```

Wire up `useMapChat`:

```ts
const { toast, sendCommand, isProcessing } = useMapChat({
  pois,
  effectiveStart,
  onRouteTo: handleRoute,
  onZoomTo: handleZoomTo,
  onToggleCategories: handleToggleCategories,
  onHighlightPOI: handleHighlightPOI,
  onDownloadArea: downloadArea,
});
```

- [ ] **Step 5: Modify MapView.tsx — render command bar and update layout**

Move the control overlay up to make room for the command bar. Change `bottom-4` to `bottom-14` on the control overlay div.

Add `highlightedPOI` prop to `POIMarkers`:
```tsx
<POIMarkers
  pois={pois}
  enabledCategories={enabledCategories}
  userPosition={effectiveStart}
  onBoundsChange={setMapBounds}
  onRoute={handleRoute}
  highlightedPOI={highlightedPOI}
/>
```

Add `MapCommandBar` outside the `MapContainer`, before the closing `</div>`:
```tsx
<MapCommandBar
  onSend={sendCommand}
  isProcessing={isProcessing}
  toast={toast}
/>
```

- [ ] **Step 6: Verify build**

Run: `npx next build`
Expected: Compiles successfully

- [ ] **Step 7: Run existing tests**

Run: `npx playwright test`
Expected: All 3 existing tests pass

- [ ] **Step 8: Commit**

```bash
git add src/components/MapView.tsx src/components/POIMarkers.tsx
git commit -m "feat: integrate command bar, last location, and action callbacks into MapView"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `npx next build` — compiles without errors
- [ ] `npx playwright test` — existing tests pass
- [ ] Manual: `/map` → verify map opens at last known location (not world view)
- [ ] Manual: type "show me hospitals only" → verify categories filter to hospitals
- [ ] Manual: type "route to nearest hospital" → verify route polyline appears
- [ ] Manual: type "download this area" → verify download starts
- [ ] Manual: type "zoom to nearest pharmacy" → verify map flies to pharmacy
- [ ] Manual: verify toast appears and fades after 5 seconds
- [ ] Manual: close tab, reopen `/map` → verify map opens at last position
