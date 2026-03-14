import type { RoadWay, CompressedGraph, AdjacencyList } from './types';

function posKey(lat: number, lon: number): string {
  return `${Math.round(lat * 1e7)},${Math.round(lon * 1e7)}`;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildGraph(ways: RoadWay[]): CompressedGraph {
  // Step 1: Count node references to find intersections
  const refCount = new Map<string, number>();
  for (const way of ways) {
    for (const pt of way.geometry) {
      const key = posKey(pt.lat, pt.lon);
      refCount.set(key, (refCount.get(key) || 0) + 1);
    }
  }

  // Step 2: Mark intersections (referenced by 2+ ways, or first/last of any way)
  const intersections = new Set<string>();
  for (const way of ways) {
    const geom = way.geometry;
    if (geom.length < 2) continue;
    intersections.add(posKey(geom[0].lat, geom[0].lon));
    intersections.add(posKey(geom[geom.length - 1].lat, geom[geom.length - 1].lon));
  }
  for (const [key, count] of refCount) {
    if (count >= 2) intersections.add(key);
  }

  // Step 3: Assign sequential IDs to intersection nodes
  const nodeIdMap = new Map<string, number>();
  const nodeCoords: { lat: number; lng: number }[] = [];
  let nextId = 0;

  function getOrCreateNode(lat: number, lon: number): number {
    const key = posKey(lat, lon);
    let id = nodeIdMap.get(key);
    if (id === undefined) {
      id = nextId++;
      nodeIdMap.set(key, id);
      nodeCoords.push({ lat, lng: lon });
    }
    return id;
  }

  // Step 4: Build edges between consecutive intersections
  const edgeList: { from: number; to: number; cost: number; geomPts: number[] }[] = [];

  for (const way of ways) {
    const geom = way.geometry;
    if (geom.length < 2) continue;

    let segStart = 0;

    for (let i = 1; i < geom.length; i++) {
      const key = posKey(geom[i].lat, geom[i].lon);
      const isIntersection = intersections.has(key);
      const isLast = i === geom.length - 1;

      if (!isIntersection && !isLast) continue;

      const fromId = getOrCreateNode(geom[segStart].lat, geom[segStart].lon);
      const toId = getOrCreateNode(geom[i].lat, geom[i].lon);

      if (fromId === toId) {
        segStart = i;
        continue;
      }

      // Calculate cost and collect intermediate geometry
      let cost = 0;
      const pts: number[] = [];
      for (let j = segStart; j <= i; j++) {
        pts.push(geom[j].lat, geom[j].lon);
        if (j > segStart) {
          cost += haversineMeters(geom[j - 1].lat, geom[j - 1].lon, geom[j].lat, geom[j].lon);
        }
      }

      // Forward edge
      edgeList.push({ from: fromId, to: toId, cost, geomPts: pts });
      // Reverse edge (unless oneway)
      if (!way.oneway) {
        // Reverse coordinate pairs (not individual elements)
        const revPts: number[] = [];
        for (let k = pts.length - 2; k >= 0; k -= 2) {
          revPts.push(pts[k], pts[k + 1]);
        }
        edgeList.push({ from: toId, to: fromId, cost, geomPts: revPts });
      }

      segStart = i;
    }
  }

  // Step 5: Pack into typed arrays
  const nodeCount = nodeCoords.length;
  const edgeCount = edgeList.length;

  const nodes = new Float64Array(nodeCount * 3);
  for (let i = 0; i < nodeCount; i++) {
    nodes[i * 3] = i;
    nodes[i * 3 + 1] = nodeCoords[i].lat;
    nodes[i * 3 + 2] = nodeCoords[i].lng;
  }

  // Concatenate all edge geometries
  const allGeom: number[] = [];
  const edges = new Float64Array(edgeCount * 5);
  for (let i = 0; i < edgeCount; i++) {
    const e = edgeList[i];
    const geomOffset = allGeom.length / 2; // in coordinate pairs
    const geomLen = e.geomPts.length / 2;
    allGeom.push(...e.geomPts);

    edges[i * 5] = e.from;
    edges[i * 5 + 1] = e.to;
    edges[i * 5 + 2] = e.cost;
    edges[i * 5 + 3] = geomOffset;
    edges[i * 5 + 4] = geomLen;
  }

  return {
    nodes,
    edges,
    geom: new Float64Array(allGeom),
    nodeCount,
    edgeCount,
  };
}

export function mergeGraphs(graphs: CompressedGraph[]): CompressedGraph {
  if (graphs.length === 0) {
    return { nodes: new Float64Array(0), edges: new Float64Array(0), geom: new Float64Array(0), nodeCount: 0, edgeCount: 0 };
  }
  if (graphs.length === 1) return graphs[0];

  // Merge by re-indexing nodes by position
  const nodeIdMap = new Map<string, number>();
  const nodeCoords: { lat: number; lng: number }[] = [];
  let nextId = 0;

  function getOrCreateNode(lat: number, lng: number): number {
    const key = `${Math.round(lat * 1e7)},${Math.round(lng * 1e7)}`;
    let id = nodeIdMap.get(key);
    if (id === undefined) {
      id = nextId++;
      nodeIdMap.set(key, id);
      nodeCoords.push({ lat, lng });
    }
    return id;
  }

  // Build remapping for each graph
  const edgeList: { from: number; to: number; cost: number; geomPts: number[] }[] = [];

  for (const g of graphs) {
    const nodeRemap = new Map<number, number>();
    for (let i = 0; i < g.nodeCount; i++) {
      const oldId = g.nodes[i * 3];
      const lat = g.nodes[i * 3 + 1];
      const lng = g.nodes[i * 3 + 2];
      nodeRemap.set(oldId, getOrCreateNode(lat, lng));
    }

    for (let i = 0; i < g.edgeCount; i++) {
      const fromOld = g.edges[i * 5];
      const toOld = g.edges[i * 5 + 1];
      const cost = g.edges[i * 5 + 2];
      const geomOffset = g.edges[i * 5 + 3];
      const geomLen = g.edges[i * 5 + 4];

      const from = nodeRemap.get(fromOld) ?? fromOld;
      const to = nodeRemap.get(toOld) ?? toOld;

      const pts: number[] = [];
      for (let j = 0; j < geomLen; j++) {
        pts.push(g.geom[(geomOffset + j) * 2], g.geom[(geomOffset + j) * 2 + 1]);
      }

      edgeList.push({ from, to, cost, geomPts: pts });
    }
  }

  // Pack
  const nodeCount = nodeCoords.length;
  const edgeCount = edgeList.length;
  const nodes = new Float64Array(nodeCount * 3);
  for (let i = 0; i < nodeCount; i++) {
    nodes[i * 3] = i;
    nodes[i * 3 + 1] = nodeCoords[i].lat;
    nodes[i * 3 + 2] = nodeCoords[i].lng;
  }

  const allGeom: number[] = [];
  const edges = new Float64Array(edgeCount * 5);
  for (let i = 0; i < edgeCount; i++) {
    const e = edgeList[i];
    const geomOffset = allGeom.length / 2;
    const geomLen = e.geomPts.length / 2;
    allGeom.push(...e.geomPts);
    edges[i * 5] = e.from;
    edges[i * 5 + 1] = e.to;
    edges[i * 5 + 2] = e.cost;
    edges[i * 5 + 3] = geomOffset;
    edges[i * 5 + 4] = geomLen;
  }

  return {
    nodes,
    edges,
    geom: new Float64Array(allGeom),
    nodeCount,
    edgeCount,
  };
}

export function buildAdjacencyList(graph: CompressedGraph): AdjacencyList {
  const nodes: { id: number; lat: number; lng: number }[] = [];
  for (let i = 0; i < graph.nodeCount; i++) {
    nodes.push({
      id: graph.nodes[i * 3],
      lat: graph.nodes[i * 3 + 1],
      lng: graph.nodes[i * 3 + 2],
    });
  }

  const adj = new Map<number, { to: number; cost: number; edgeIdx: number }[]>();
  for (let i = 0; i < graph.edgeCount; i++) {
    const from = graph.edges[i * 5];
    const to = graph.edges[i * 5 + 1];
    const cost = graph.edges[i * 5 + 2];
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push({ to, cost, edgeIdx: i });
  }

  return { nodes, adj };
}
