import type { POI } from './categories';

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
