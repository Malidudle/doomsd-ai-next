'use client';

import { useEffect } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { RouteResult } from '@/lib/roads/types';

interface Props {
  route: RouteResult | null;
}

export default function RouteLayer({ route }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!route || route.path.length < 2) return;
    const validPts = route.path.filter(([lat, lng]) => lat !== 0 || lng !== 0);
    if (validPts.length < 2) return;
    const bounds = L.latLngBounds(validPts.map(([lat, lng]) => [lat, lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [route, map]);

  if (!route || route.path.length < 2) return null;

  return (
    <Polyline
      positions={route.path}
      pathOptions={{
        color: 'var(--green)',
        dashArray: '8,6',
        weight: 3,
        opacity: 0.8,
      }}
    />
  );
}
