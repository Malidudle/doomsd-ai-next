import { openDB, type IDBPDatabase } from 'idb';
import type { CompressedGraph, Bounds } from './types';

interface StoredGraph {
  regionKey: string;
  nodes: number[];
  edges: number[];
  geom: number[];
  nodeCount: number;
  edgeCount: number;
  fetchedAt: number;
}

interface RoadRegion {
  north: number;
  south: number;
  east: number;
  west: number;
  fetchedAt: number;
}

const DB_NAME = 'bitchat-roads';
const DB_VERSION = 2;
const STALE_MS = 30 * 60 * 1000;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Clear old data on version upgrade (v1 used ArrayBuffer, v2 uses plain arrays)
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains('graph')) db.deleteObjectStore('graph');
          if (db.objectStoreNames.contains('roadRegions')) db.deleteObjectStore('roadRegions');
        }
        if (!db.objectStoreNames.contains('graph')) {
          db.createObjectStore('graph', { keyPath: 'regionKey' });
        }
        if (!db.objectStoreNames.contains('roadRegions')) {
          db.createObjectStore('roadRegions', { autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

function regionKey(bounds: Bounds): string {
  const q = (v: number) => (Math.round(v / 0.02) * 0.02).toFixed(2);
  return `${q(bounds.south)},${q(bounds.west)},${q(bounds.north)},${q(bounds.east)}`;
}

export async function saveGraph(bounds: Bounds, graph: CompressedGraph): Promise<void> {
  const db = await getDB();
  const stored: StoredGraph = {
    regionKey: regionKey(bounds),
    nodes: Array.from(graph.nodes),
    edges: Array.from(graph.edges),
    geom: Array.from(graph.geom),
    nodeCount: graph.nodeCount,
    edgeCount: graph.edgeCount,
    fetchedAt: Date.now(),
  };
  await db.put('graph', stored);
}

export async function loadGraphsForBounds(bounds: Bounds): Promise<CompressedGraph[]> {
  const db = await getDB();
  const all: StoredGraph[] = await db.getAll('graph');
  const results: CompressedGraph[] = [];

  for (const stored of all) {
    // Parse the region key back to bounds
    const parts = stored.regionKey.split(',').map(Number);
    const [south, west, north, east] = parts;

    // Check overlap
    if (north < bounds.south || south > bounds.north) continue;
    if (east < bounds.west || west > bounds.east) continue;

    results.push({
      nodes: new Float64Array(stored.nodes),
      edges: new Float64Array(stored.edges),
      geom: new Float64Array(stored.geom),
      nodeCount: stored.nodeCount,
      edgeCount: stored.edgeCount,
    });
  }

  return results;
}

export async function hasRoadRegionBeenFetched(bounds: Bounds): Promise<boolean> {
  const db = await getDB();
  const regions: RoadRegion[] = await db.getAll('roadRegions');
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

export async function saveRoadRegion(bounds: Bounds): Promise<void> {
  const db = await getDB();
  const region: RoadRegion = { ...bounds, fetchedAt: Date.now() };
  await db.put('roadRegions', region);
}

export async function getRoadStats(): Promise<{ regionCount: number; totalNodes: number; totalEdges: number }> {
  const db = await getDB();
  const all: StoredGraph[] = await db.getAll('graph');
  let totalNodes = 0;
  let totalEdges = 0;
  for (const g of all) {
    totalNodes += g.nodeCount;
    totalEdges += g.edgeCount;
  }
  return { regionCount: all.length, totalNodes, totalEdges };
}
