const CACHE_NAME = "bitchat-map-tiles";
const TILE_URL = "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";
const MAX_TILES = 1000;
const CONCURRENCY = 6;

interface TileCoord {
  x: number;
  y: number;
  z: number;
}

function lng2tile(lng: number, zoom: number) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number) {
  return Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) +
          1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
      Math.pow(2, zoom)
  );
}

export function getTileBounds(
  bounds: { north: number; south: number; east: number; west: number },
  minZoom: number,
  maxZoom: number
): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lng2tile(bounds.west, z);
    const xMax = lng2tile(bounds.east, z);
    const yMin = lat2tile(bounds.north, z);
    const yMax = lat2tile(bounds.south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ x, y, z });
      }
    }
    if (tiles.length > MAX_TILES) break;
  }
  return tiles.slice(0, MAX_TILES);
}

function tileUrl(t: TileCoord) {
  return TILE_URL.replace("{z}", String(t.z))
    .replace("{x}", String(t.x))
    .replace("{y}", String(t.y));
}

export async function downloadTiles(
  tiles: TileCoord[],
  onProgress?: (done: number, total: number) => void
) {
  const cache = await caches.open(CACHE_NAME);
  let done = 0;
  const total = tiles.length;

  const queue = [...tiles];

  async function worker() {
    while (queue.length > 0) {
      const tile = queue.shift()!;
      const url = tileUrl(tile);
      const existing = await cache.match(url);
      if (!existing) {
        try {
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        } catch {
          // skip failed tiles
        }
      }
      done++;
      onProgress?.(done, total);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
}

export async function getCachedTileCount(): Promise<number> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

export async function clearTileCache(): Promise<void> {
  await caches.delete(CACHE_NAME);
}
