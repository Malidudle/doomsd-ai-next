import { CATEGORIES, type POI, type POICategory } from './categories';

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Walk CATEGORIES in order (specific before generic) and return the first match.
 * This ensures e.g. emergency_shelter is picked over the generic shelter fallback.
 */
function determineCategoryFromTags(tags: Record<string, string>): POICategory | null {
  for (const cat of CATEGORIES) {
    if (cat.matchTags(tags)) return cat.category;
  }
  return null;
}

/**
 * Build a single Overpass QL union from every category's filters.
 * Deduplicates identical filter strings so we don't query amenity=shelter
 * multiple times (the specific subtypes add extra filters on top).
 */
function buildQuery(bbox: string): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const cat of CATEGORIES) {
    for (const filter of cat.overpassFilters) {
      if (seen.has(filter)) continue;
      seen.add(filter);
      parts.push(`node[${filter}](${bbox});way[${filter}](${bbox});`);
    }
  }

  return `[out:json][timeout:15];(${parts.join('')});out center;`;
}

export async function fetchPOIs(bounds: Bounds): Promise<POI[]> {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query = buildQuery(bbox);

  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`Overpass API error: ${resp.status}`);

  const data = await resp.json();
  const now = Date.now();
  const pois: POI[] = [];

  for (const el of data.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    const tags = el.tags || {};
    const category = determineCategoryFromTags(tags);
    if (!category) continue;

    pois.push({
      id: `${el.type}/${el.id}`,
      lat,
      lng,
      category,
      name: tags.name || tags['name:en'] || '',
      tags,
      fetchedAt: now,
    });
  }

  return pois;
}
