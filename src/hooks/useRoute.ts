'use client';

import { useState, useCallback } from 'react';
import type { RouteResult } from '@/lib/roads/types';
import { loadGraphsForBounds } from '@/lib/roads/roadStore';
import { mergeGraphs, buildAdjacencyList } from '@/lib/roads/graphBuilder';
import { snapToGraph, astar, buildRouteGeometry } from '@/lib/roads/pathfinder';

export type RouteError = 'NO_ROAD_DATA' | 'NO_PATH' | 'TOO_FAR' | null;

export function useRoute(routeStart: [number, number] | null) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<RouteError>(null);

  const computeRoute = useCallback(async (targetLat: number, targetLng: number) => {
    if (!routeStart) return;

    setRouteLoading(true);
    setRouteError(null);
    setRoute(null);

    try {
      const [startLat, startLng] = routeStart;

      // Expand bounds by 20% buffer
      const latMin = Math.min(startLat, targetLat);
      const latMax = Math.max(startLat, targetLat);
      const lngMin = Math.min(startLng, targetLng);
      const lngMax = Math.max(startLng, targetLng);
      const latPad = (latMax - latMin) * 0.2 || 0.01;
      const lngPad = (lngMax - lngMin) * 0.2 || 0.01;

      const bounds = {
        south: latMin - latPad,
        north: latMax + latPad,
        west: lngMin - lngPad,
        east: lngMax + lngPad,
      };

      // Load graph regions
      const graphs = await loadGraphsForBounds(bounds);
      if (graphs.length === 0) {
        setRouteError('NO_ROAD_DATA');
        return;
      }

      // Merge and build adjacency list
      const merged = mergeGraphs(graphs);
      const adjList = buildAdjacencyList(merged);

      // Snap start and target
      const startNode = snapToGraph(startLat, startLng, adjList);
      if (startNode === null) {
        setRouteError('TOO_FAR');
        return;
      }

      const endNode = snapToGraph(targetLat, targetLng, adjList);
      if (endNode === null) {
        setRouteError('TOO_FAR');
        return;
      }

      // Run A*
      const nodePath = astar(startNode, endNode, adjList);
      if (!nodePath) {
        setRouteError('NO_PATH');
        return;
      }

      // Build geometry
      const result = buildRouteGeometry(nodePath, merged, adjList);
      setRoute(result);
    } catch {
      setRouteError('NO_PATH');
    } finally {
      setRouteLoading(false);
    }
  }, [routeStart]);

  const clearRoute = useCallback(() => {
    setRoute(null);
    setRouteError(null);
  }, []);

  return { route, routeLoading, routeError, computeRoute, clearRoute };
}
