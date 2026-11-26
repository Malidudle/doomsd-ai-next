# DoomsdAI

**Winner at the Wordsmith hackathon.**

An emergency preparedness terminal that keeps working when the network does
not. A local LLM answers survival questions, an offline map routes you to the
nearest hospital, water point or shelter, and a Bluetooth mesh panel lets you
message people nearby.

## What it does

- **SOS dashboard** (`/`) — pick a crisis type (earthquake, flood, war zone,
  wilderness, medical) and a quick action. Each action opens the chat with a
  prepared question.
- **SurviveChat** (`/survive`) — chat with a local Qwen model through
  [Ollama](https://ollama.com). No request leaves the machine.
- **Nearby** (`/map`) — a Leaflet map of emergency points of interest from
  OpenStreetMap: hospitals, police, pharmacies, shelters, drinking water,
  fuel and more. You can type a command such as "take me to the nearest
  hospital" and the model drives the map with tool calls: `route_to`,
  `zoom_to`, `toggle_categories`, `download_area`.
- **Mesh** (`/mesh`) — send and receive messages over a local Bluetooth mesh
  through a BitChat bridge.
- **Breathe** (`/breathe`) — a guided 4-7-8 breathing exercise.

## How the offline part works

Everything below runs in the browser and is stored on the device:

1. **Points of interest** — fetched from the Overpass API while online and
   cached in IndexedDB.
2. **Roads and routing** — OSM road data is compressed into a graph and
   cached in IndexedDB. Routes come from an A* search on that graph, so
   routing needs no server.
3. **Map tiles** — a service worker (`public/sw.js`) caches CartoDB tiles.
   "Download area" fetches the tiles for the visible area ahead of time.

Download an area while you are online. After that, the map, the points of
interest, the routing and the chat all work with no connection.

## Run it

You need Node.js 20 or later and [Ollama](https://ollama.com).

```bash
ollama pull qwen3.5:4b
npm install
npm run dev
```

Open http://localhost:3000.

The mesh page needs a BitChat bridge, which is not part of this repository.
The app proxies `/api/mesh/*` to `http://127.0.0.1:8787` by default. Set
`MESH_UPSTREAM` to point it somewhere else. Without a bridge the rest of the
app still works and the sidebar shows `NO MESH`.

## Tests

```bash
npx playwright test
```

## Limitations

This is a hackathon prototype. The sources panel in SurviveChat shows
placeholder data: retrieval over an offline archive is not built. A small
local model can give wrong answers, so do not rely on it for medical or
safety decisions.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Vercel AI SDK
with `ollama-ai-provider-v2`, Leaflet, IndexedDB via `idb`, Playwright.
