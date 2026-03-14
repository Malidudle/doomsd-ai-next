'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type L from 'leaflet';
import type { POI } from '@/lib/poi/categories';
import { fetchPOIs } from '@/lib/poi/overpass';
import {
  savePOIs,
  getPOIsByBounds,
  hasRegionBeenFetched,
  saveRegion,
  getCachedPOICount,
} from '@/lib/poi/poiStore';

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

function toBounds(b: L.LatLngBounds): Bounds {
  return {
    north: b.getNorth(),
    south: b.getSouth(),
    east: b.getEast(),
    west: b.getWest(),
  };
}

export function usePOI(mapBounds: L.LatLngBounds | null, isOnline: boolean) {
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCached, setTotalCached] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCachedCount = useCallback(async () => {
    const count = await getCachedPOICount();
    setTotalCached(count);
  }, []);

  // Load cached POIs on bounds change (debounced)
  useEffect(() => {
    if (!mapBounds) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const bounds = toBounds(mapBounds);

      // Always load from IndexedDB first — this is the offline path
      const cached = await getPOIsByBounds(bounds);
      setPois(cached);
      await refreshCachedCount();

      // If online and region is stale, fetch fresh data in background
      if (isOnline) {
        const fetched = await hasRegionBeenFetched(bounds);
        if (!fetched) {
          setLoading(true);
          try {
            const fresh = await fetchPOIs(bounds);
            await savePOIs(fresh);
            await saveRegion(bounds);
            const updated = await getPOIsByBounds(bounds);
            setPois(updated);
            await refreshCachedCount();
          } catch {
            // Keep cached data on error
          } finally {
            setLoading(false);
          }
        }
      }
    }, 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mapBounds, isOnline, refreshCachedCount]);

  // Manual refetch for current viewport (FETCH POI button)
  const refetch = useCallback(async () => {
    if (!mapBounds) return;
    const bounds = toBounds(mapBounds);
    setLoading(true);
    try {
      const fresh = await fetchPOIs(bounds);
      await savePOIs(fresh);
      await saveRegion(bounds);
      const updated = await getPOIsByBounds(bounds);
      setPois(updated);
      await refreshCachedCount();
    } catch {
      // Keep cached data
    } finally {
      setLoading(false);
    }
  }, [mapBounds, refreshCachedCount]);

  // Fetch + save for a given bounds (used by DOWNLOAD AREA to also cache POIs)
  const fetchForBounds = useCallback(async (bounds: Bounds) => {
    setLoading(true);
    try {
      const fresh = await fetchPOIs(bounds);
      await savePOIs(fresh);
      await saveRegion(bounds);
      // Reload visible POIs if we have current map bounds
      if (mapBounds) {
        const updated = await getPOIsByBounds(toBounds(mapBounds));
        setPois(updated);
      }
      await refreshCachedCount();
    } catch {
      // Overpass fetch failed — tiles still download, POIs just won't update
    } finally {
      setLoading(false);
    }
  }, [mapBounds, refreshCachedCount]);

  return { pois, loading, totalCached, refetch, fetchForBounds };
}
