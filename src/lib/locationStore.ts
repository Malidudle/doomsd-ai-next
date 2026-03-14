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
