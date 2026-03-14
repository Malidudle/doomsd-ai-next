export interface RoadWay {
  id: number;
  highway: string;
  oneway: boolean;
  geometry: { lat: number; lon: number }[];
}

export interface CompressedGraph {
  nodes: Float64Array;      // [id, lat, lng, id, lat, lng, ...]
  edges: Float64Array;      // [fromIdx, toIdx, costMeters, geomOffset, geomLen, ...]
  geom: Float64Array;       // [lat, lng, lat, lng, ...] all edge geometries concatenated
  nodeCount: number;
  edgeCount: number;
}

export interface AdjacencyList {
  nodes: { id: number; lat: number; lng: number }[];
  adj: Map<number, { to: number; cost: number; edgeIdx: number }[]>;
}

export interface RouteResult {
  path: [number, number][];  // [lat, lng][] polyline coordinates
  distanceMeters: number;
  nodeCount: number;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
