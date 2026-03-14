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

function buildSystemPrompt(locationContext?: string): string {
  return `You are an emergency map command assistant. You control a map with tools.

RULES:
- ALWAYS call a tool. Never just reply with text explaining what you would do.
- Be very brief. One short sentence + tool call.
- If the user asks to go/navigate/route/walk to something, use route_to.
- If the user asks to see/show/find/where is something, use zoom_to.
- If the user asks to show only certain types or hide types, use toggle_categories.
- If the user asks which is closest or about a specific place, use route_to (always route, never just highlight).
- If the user asks to download/cache/save the area, use download_area.
- For category, use exact values: hospital, police, fire_station, pharmacy, emergency_shelter, bunker, assembly_point, weather_shelter, shelter, water, supermarket, fuel.
- "hospital" includes clinics. "water" means drinking water. "shelter" is generic shelters. "emergency_shelter" is for emergency/refugee shelters.
- If you are unsure which category, pick the closest match.
- If the user says "nearest X" or "closest X", use the category field (not name).
- If the user mentions a specific place name like "St Mary's", use the name field.

EXAMPLES:
- "take me to the nearest hospital" → route_to(category: "hospital")
- "navigate to pharmacy" → route_to(category: "pharmacy")
- "route to St Mary's" → route_to(name: "St Mary's")
- "show me hospitals" → zoom_to(category: "hospital")
- "where is the nearest water" → zoom_to(category: "water")
- "only show hospitals and pharmacies" → toggle_categories(show: ["hospital", "pharmacy"], hide: ["police", "fire_station", "emergency_shelter", "bunker", "assembly_point", "weather_shelter", "shelter", "water", "supermarket", "fuel"])
- "hide shelters" → toggle_categories(hide: ["shelter", "emergency_shelter", "weather_shelter"])
- "show everything" → toggle_categories(show: ["hospital", "police", "fire_station", "pharmacy", "emergency_shelter", "bunker", "assembly_point", "weather_shelter", "shelter", "water", "supermarket", "fuel"])
- "download this area" → download_area()
- "cache for offline" → download_area()
- "which hospital is closest" → route_to(category: "hospital")
- "find nearest water" → route_to(category: "water")

${locationContext || 'No nearby resource data loaded yet. If the user asks about nearby places, suggest they download the area first.'}`;
}

export async function POST(req: Request) {
  const {
    messages,
    model,
    locationContext,
  }: { messages: UIMessage[]; model?: string; locationContext?: string } =
    await req.json();

  const selectedModel =
    model && ALLOWED_MODELS.includes(model) ? model : 'qwen3.5:4b';

  const result = streamText({
    model: ollama(selectedModel),
    system: buildSystemPrompt(locationContext),
    messages: await convertToModelMessages(messages),
    tools: {
      route_to: tool({
        description: 'Navigate/route/walk to a POI. Use when user says: go to, take me to, navigate, route, walk to. Set category for nearest of a type OR name for a specific place.',
        inputSchema: z.object({
          category: CATEGORY_ENUM.optional().describe('POI category like "hospital", "pharmacy", "water" etc'),
          name: z.string().optional().describe('Exact or partial name of a specific place'),
        }),
      }),
      zoom_to: tool({
        description: 'Fly the map camera to show a POI or location. Use when user says: show me, where is, find, look at, zoom to.',
        inputSchema: z.object({
          category: CATEGORY_ENUM.optional().describe('POI category to fly to nearest of'),
          name: z.string().optional().describe('Exact or partial name of a specific place'),
          lat: z.number().optional().describe('Latitude if zooming to raw coordinates'),
          lng: z.number().optional().describe('Longitude if zooming to raw coordinates'),
        }),
      }),
      toggle_categories: tool({
        description: 'Show or hide POI categories on the map. Use when user says: only show, hide, filter, show everything. To show ONLY certain types, put those in show and ALL others in hide.',
        inputSchema: z.object({
          show: z.array(CATEGORY_ENUM).optional().describe('Categories to make visible'),
          hide: z.array(CATEGORY_ENUM).optional().describe('Categories to hide'),
        }),
      }),
      download_area: tool({
        description: 'Download/cache the current visible map area for offline use. Use when user says: download, cache, save for offline, prepare offline.',
        inputSchema: z.object({}),
      }),
    },
    toolChoice: 'required',
    providerOptions: {
      ollama: { think: false },
    },
  });

  return result.toUIMessageStreamResponse();
}
