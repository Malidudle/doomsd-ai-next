import type { Bounds, RoadWay } from './types';

function buildRoadQuery(bbox: string): string {
  const highway = 'footway|path|pedestrian|steps|residential|living_street|service|track|unclassified|tertiary|secondary|primary|trunk';
  return `[out:json][timeout:30];way["highway"~"^(${highway})$"](${bbox});out geom;`;
}

export async function fetchRoads(bounds: Bounds): Promise<RoadWay[]> {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query = buildRoadQuery(bbox);

  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) throw new Error(`Overpass road API error: ${resp.status}`);

  const data = await resp.json();
  const ways: RoadWay[] = [];

  for (const el of data.elements) {
    if (el.type !== 'way' || !el.geometry?.length) continue;
    const tags = el.tags || {};
    ways.push({
      id: el.id,
      highway: tags.highway || '',
      oneway: tags.oneway === 'yes' || tags.oneway === '1',
      geometry: el.geometry,
    });
  }

  return ways;
}
