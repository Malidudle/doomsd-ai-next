import { openDB, type IDBPDatabase } from 'idb';
import type { POI, POICategory } from './categories';

interface FetchRegion {
  north: number;
  south: number;
  east: number;
  west: number;
  fetchedAt: number;
}

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const DB_NAME = 'bitchat-poi';
const DB_VERSION = 1;
const STALE_MS = 30 * 60 * 1000; // 30 minutes

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pois')) {
          const store = db.createObjectStore('pois', { keyPath: 'id' });
          store.createIndex('category', 'category');
          store.createIndex('fetchedAt', 'fetchedAt');
        }
        if (!db.objectStoreNames.contains('fetchRegions')) {
          db.createObjectStore('fetchRegions', { autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function savePOIs(pois: POI[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('pois', 'readwrite');
  for (const poi of pois) {
    await tx.store.put(poi);
  }
  await tx.done;
}

export async function getPOIsByBounds(
  bounds: Bounds,
  categories?: Set<POICategory>,
): Promise<POI[]> {
  const db = await getDB();
  const all: POI[] = await db.getAll('pois');
  return all.filter((p) => {
    if (p.lat < bounds.south || p.lat > bounds.north) return false;
    if (p.lng < bounds.west || p.lng > bounds.east) return false;
    if (categories && !categories.has(p.category)) return false;
    return true;
  });
}

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

export async function getPOIsNearPoint(
  lat: number,
  lng: number,
  radiusKm: number,
  categories?: Set<POICategory>,
): Promise<(POI & { distance: number })[]> {
  const db = await getDB();
  const all: POI[] = await db.getAll('pois');
  const results: (POI & { distance: number })[] = [];

  for (const p of all) {
    if (categories && !categories.has(p.category)) continue;
    const d = haversineKm(lat, lng, p.lat, p.lng);
    if (d <= radiusKm) {
      results.push({ ...p, distance: d });
    }
  }

  results.sort((a, b) => a.distance - b.distance);
  return results;
}

export async function hasRegionBeenFetched(bounds: Bounds): Promise<boolean> {
  const db = await getDB();
  const regions: FetchRegion[] = await db.getAll('fetchRegions');
  const now = Date.now();

  return regions.some(
    (r) =>
      now - r.fetchedAt < STALE_MS &&
      r.south <= bounds.south &&
      r.north >= bounds.north &&
      r.west <= bounds.west &&
      r.east >= bounds.east,
  );
}

export async function saveRegion(bounds: Bounds): Promise<void> {
  const db = await getDB();
  const region: FetchRegion = { ...bounds, fetchedAt: Date.now() };
  await db.put('fetchRegions', region);
}

export async function getCachedPOICount(): Promise<number> {
  const db = await getDB();
  return db.count('pois');
}

export async function getAllCachedPOIs(): Promise<POI[]> {
  const db = await getDB();
  return db.getAll('pois');
}
