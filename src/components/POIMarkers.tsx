'use client';

import { useMemo, useEffect } from 'react';
import L from 'leaflet';
import { Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { CATEGORIES, SHELTER_DETAIL_KEYS, type POI, type POICategory } from '@/lib/poi/categories';

const categoryConfigMap = Object.fromEntries(
  CATEGORIES.map((c) => [c.category, c]),
) as Record<POICategory, (typeof CATEGORIES)[number]>;

const SHELTER_CATEGORIES: Set<POICategory> = new Set([
  'emergency_shelter',
  'bunker',
  'assembly_point',
  'weather_shelter',
  'shelter',
]);

function makeIcon(category: POICategory) {
  const cfg = categoryConfigMap[category];
  return L.divIcon({
    className: '',
    html: `<div style="
      width:20px;height:20px;display:flex;align-items:center;justify-content:center;
      font-size:13px;line-height:1;font-family:monospace;
      background:#0a0a0a;color:${cfg.color};
      border:1px solid ${cfg.color};border-radius:2px;
      box-shadow:0 0 4px ${cfg.color}44;
    ">${cfg.icon}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

const iconCache = new Map<POICategory, L.DivIcon>();
function getIcon(category: POICategory) {
  if (!iconCache.has(category)) iconCache.set(category, makeIcon(category));
  return iconCache.get(category)!;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;display:flex;align-items:center;justify-content:center;
      font-size:11px;font-family:monospace;font-weight:bold;
      background:#0a0a0a;color:var(--green);
      border:1px solid var(--green);border-radius:2px;
      box-shadow:0 0 6px rgba(51,204,51,0.3);
    ">${count}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function BoundsTracker({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  useMapEvents({
    moveend(e) {
      onBoundsChange(e.target.getBounds());
    },
  });
  return null;
}

interface Props {
  pois: POI[];
  enabledCategories: Set<POICategory>;
  userPosition: [number, number] | null;
  onBoundsChange: (bounds: L.LatLngBounds) => void;
  onRoute?: (lat: number, lng: number) => void;
  highlightedPOI?: { lat: number; lng: number } | null;
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

const DETAIL_LABELS: Record<string, string> = {
  shelter_type: 'type',
  capacity: 'cap',
  operator: 'opr',
  opening_hours: 'hrs',
  access: 'access',
  description: 'info',
  'social_facility:for': 'for',
};

function POIPopupContent({ poi, cfg, distStr, onRoute }: {
  poi: POI;
  cfg: (typeof CATEGORIES)[number];
  distStr: string;
  onRoute?: (lat: number, lng: number) => void;
}) {
  const isShelter = SHELTER_CATEGORIES.has(poi.category);

  // Collect extra detail lines for shelter-type POIs
  const details: { label: string; value: string }[] = [];
  if (isShelter) {
    for (const key of SHELTER_DETAIL_KEYS) {
      const val = poi.tags[key];
      if (val) {
        details.push({ label: DETAIL_LABELS[key] || key, value: val });
      }
    }
  }

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.5', minWidth: 140 }}>
      <div style={{ color: cfg.color, fontWeight: 'bold' }}>
        {cfg.icon} {cfg.category.toUpperCase().replace('_', ' ')}
      </div>
      <div>{poi.name || 'unnamed'}</div>
      <div style={{ color: '#555' }}>dist: {distStr}</div>
      {poi.tags['addr:street'] && (
        <div style={{ color: '#555' }}>
          {poi.tags['addr:street']} {poi.tags['addr:housenumber'] || ''}
        </div>
      )}
      {details.length > 0 && (
        <div style={{ borderTop: '1px dashed #333', marginTop: 4, paddingTop: 4 }}>
          {details.map((d) => (
            <div key={d.label} style={{ color: '#888' }}>
              <span style={{ color: '#555' }}>{d.label}:</span> {d.value}
            </div>
          ))}
        </div>
      )}
      {poi.tags.phone && (
        <div style={{ color: '#888' }}>tel: {poi.tags.phone}</div>
      )}
      {poi.tags.website && (
        <div style={{ color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
          web: {poi.tags.website}
        </div>
      )}
      {onRoute && (
        <button
          onClick={() => onRoute(poi.lat, poi.lng)}
          style={{
            marginTop: 6,
            width: '100%',
            padding: '3px 8px',
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#33cc33',
            background: '#0a0a0a',
            border: '1px solid #33cc33',
            cursor: 'pointer',
          }}
        >
          ▶ ROUTE
        </button>
      )}
    </div>
  );
}

function HighlightHandler({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.eachLayer((layer: L.Layer) => {
      if (layer instanceof L.Marker) {
        const pos = layer.getLatLng();
        if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
          map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 1 });
          setTimeout(() => layer.openPopup(), 1100);
        }
      }
    });
  }, [map, lat, lng]);
  return null;
}

export default function POIMarkers({ pois, enabledCategories, userPosition, onBoundsChange, onRoute, highlightedPOI }: Props) {
  const filtered = useMemo(
    () => pois.filter((p) => enabledCategories.has(p.category)),
    [pois, enabledCategories],
  );

  return (
    <>
      <BoundsTracker onBoundsChange={onBoundsChange} />
      {highlightedPOI && <HighlightHandler lat={highlightedPOI.lat} lng={highlightedPOI.lng} />}
      <MarkerClusterGroup
        iconCreateFunction={clusterIcon}
        disableClusteringAtZoom={16}
        chunkedLoading={true}
      >
        {filtered.map((poi) => {
          const cfg = categoryConfigMap[poi.category];
          const dist =
            userPosition
              ? haversineKm(userPosition[0], userPosition[1], poi.lat, poi.lng)
              : null;
          const distStr = dist !== null
            ? dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`
            : '?';

          return (
            <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={getIcon(poi.category)}>
              <Popup>
                <POIPopupContent poi={poi} cfg={cfg} distStr={distStr} onRoute={onRoute} />
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </>
  );
}
