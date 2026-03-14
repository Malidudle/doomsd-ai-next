import type { AdjacencyList, CompressedGraph, RouteResult } from './types';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function snapToGraph(lat: number, lng: number, adjList: AdjacencyList): number | null {
  let bestIdx = -1;
  let bestDist = Infinity;

  for (let i = 0; i < adjList.nodes.length; i++) {
    const node = adjList.nodes[i];
    const d = haversineMeters(lat, lng, node.lat, node.lng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  if (bestIdx === -1 || bestDist > 500) return null;
  return bestIdx;
}

// Simple binary min-heap
class MinHeap {
  private data: { idx: number; f: number }[] = [];

  get size() { return this.data.length; }

  push(idx: number, f: number) {
    this.data.push({ idx, f });
    this.bubbleUp(this.data.length - 1);
  }

  pop(): { idx: number; f: number } | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f >= this.data[parent].f) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private sinkDown(i: number) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < n && this.data[right].f < this.data[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

export function astar(startIdx: number, endIdx: number, adjList: AdjacencyList): number[] | null {
  const goal = adjList.nodes[endIdx];
  const nodeCount = adjList.nodes.length;

  const gScore = new Float64Array(nodeCount).fill(Infinity);
  const cameFrom = new Int32Array(nodeCount).fill(-1);
  const closed = new Uint8Array(nodeCount);

  gScore[startIdx] = 0;

  const open = new MinHeap();
  open.push(startIdx, haversineMeters(adjList.nodes[startIdx].lat, adjList.nodes[startIdx].lng, goal.lat, goal.lng));

  const startTime = performance.now();

  while (open.size > 0) {
    if (performance.now() - startTime > 200) return null; // timeout guard

    const current = open.pop()!;
    const u = current.idx;

    if (u === endIdx) {
      // Reconstruct path
      const path: number[] = [];
      let node = endIdx;
      while (node !== -1) {
        path.push(node);
        node = cameFrom[node];
      }
      return path.reverse();
    }

    if (closed[u]) continue;
    closed[u] = 1;

    const neighbors = adjList.adj.get(adjList.nodes[u].id) || [];
    for (const edge of neighbors) {
      // Find the index of the target node
      const v = edge.to;
      if (v >= nodeCount || closed[v]) continue;

      const tentG = gScore[u] + edge.cost;
      if (tentG < gScore[v]) {
        gScore[v] = tentG;
        cameFrom[v] = u;
        const h = haversineMeters(adjList.nodes[v].lat, adjList.nodes[v].lng, goal.lat, goal.lng);
        open.push(v, tentG + h);
      }
    }
  }

  return null; // no path found
}

export function buildRouteGeometry(nodeIdxPath: number[], graph: CompressedGraph, adjList: AdjacencyList): RouteResult {
  const path: [number, number][] = [];
  let totalDistance = 0;

  // Build an edge lookup: "fromId,toId" -> edge index for fast matching
  const edgeLookup = new Map<string, number>();
  for (let e = 0; e < graph.edgeCount; e++) {
    const key = `${graph.edges[e * 5]},${graph.edges[e * 5 + 1]}`;
    edgeLookup.set(key, e);
  }

  for (let i = 0; i < nodeIdxPath.length - 1; i++) {
    const fromNode = adjList.nodes[nodeIdxPath[i]];
    const toNode = adjList.nodes[nodeIdxPath[i + 1]];
    const edgeKey = `${fromNode.id},${toNode.id}`;
    const e = edgeLookup.get(edgeKey);

    if (e !== undefined) {
      const geomOffset = graph.edges[e * 5 + 3];
      const geomLen = graph.edges[e * 5 + 4];
      totalDistance += graph.edges[e * 5 + 2];

      // Add geometry points (skip first if not the first segment to avoid duplicates)
      const startJ = (i === 0) ? 0 : 1;
      for (let j = startJ; j < geomLen; j++) {
        const lat = graph.geom[(geomOffset + j) * 2];
        const lng = graph.geom[(geomOffset + j) * 2 + 1];
        // Guard against zero/invalid coordinates
        if (lat !== 0 || lng !== 0) {
          path.push([lat, lng]);
        }
      }
    } else {
      // Fallback: straight line between nodes
      totalDistance += haversineMeters(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
      if (i === 0) path.push([fromNode.lat, fromNode.lng]);
      path.push([toNode.lat, toNode.lng]);
    }
  }

  // If path is empty, add start and end nodes
  if (path.length === 0 && nodeIdxPath.length > 0) {
    const n = adjList.nodes[nodeIdxPath[0]];
    path.push([n.lat, n.lng]);
    if (nodeIdxPath.length > 1) {
      const m = adjList.nodes[nodeIdxPath[nodeIdxPath.length - 1]];
      path.push([m.lat, m.lng]);
    }
  }

  return {
    path,
    distanceMeters: totalDistance,
    nodeCount: nodeIdxPath.length,
  };
}
