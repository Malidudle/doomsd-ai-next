import { SHELTER_DETAIL_KEYS, type POI } from './categories';

const SHELTER_CATEGORIES = new Set([
  'emergency_shelter',
  'bunker',
  'assembly_point',
  'weather_shelter',
  'shelter',
]);

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function formatShelterDetails(tags: Record<string, string>): string {
  const parts: string[] = [];
  for (const key of SHELTER_DETAIL_KEYS) {
    const val = tags[key];
    if (val) parts.push(`${key.replace('social_facility:for', 'for')}=${val}`);
  }
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

export function formatPOIContext(
  lat: number,
  lng: number,
  pois: Array<POI & { distance: number }>,
): string {
  if (pois.length === 0) return '';

  const limited = pois.slice(0, 20);
  const lines = limited.map((p) => {
    const dir = bearing(lat, lng, p.lat, p.lng);
    const dist = p.distance < 1 ? `${Math.round(p.distance * 1000)}m` : `${p.distance.toFixed(1)}km`;
    const name = p.name || 'unnamed';
    const label = p.category.toUpperCase().replace('_', ' ');
    const extra = SHELTER_CATEGORIES.has(p.category) ? formatShelterDetails(p.tags) : '';
    return `- [${label}] ${name}, ${dist} ${dir}${extra}`;
  });

  return `NEARBY RESOURCES (within 10km):\n${lines.join('\n')}`;
}
