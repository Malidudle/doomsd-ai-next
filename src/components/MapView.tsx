"use client";

import { useEffect, useState, useCallback } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getTileBounds,
  downloadTiles,
  getCachedTileCount,
} from "@/lib/tileCache";
import { usePOI } from "@/hooks/usePOI";
import { useRoute } from "@/hooks/useRoute";
import { CATEGORIES, type POICategory } from "@/lib/poi/categories";
import POIMarkers from "./POIMarkers";
import RouteLayer from "./RouteLayer";
import { fetchRoads } from "@/lib/roads/overpassRoads";
import { buildGraph } from "@/lib/roads/graphBuilder";
import { saveGraph, saveRoadRegion, getRoadStats } from "@/lib/roads/roadStore";

const TILE_URL =
  "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

const pulsingIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:14px;height:14px;border-radius:50%;
    background:#00FF41;
    box-shadow:0 0 8px #00FF41,0 0 16px #00FF4166;
    animation:pulse 2s ease-in-out infinite;
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const startIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:14px;height:14px;border-radius:50%;
    background:#ccaa33;
    box-shadow:0 0 8px #ccaa33,0 0 16px #ccaa3366;
    animation:pulse 2s ease-in-out infinite;
    display:flex;align-items:center;justify-content:center;
    font-size:10px;line-height:1;color:#0a0a0a;font-weight:bold;
  ">▶</div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;

function RecenterMap({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 14, { duration: 1.5 });
    }
  }, [map, position]);
  return null;
}

function StartLocationPicker({ active, onPick }: { active: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (active) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function MapView() {
  const { isOnline } = useOnlineStatus();
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [cachedCount, setCachedCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [mapRef, setMapRef] = useState<L.Map | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [enabledCategories, setEnabledCategories] = useState<Set<POICategory>>(
    () => new Set(CATEGORIES.map((c) => c.category)),
  );

  // Route state
  const [routeStart, setRouteStart] = useState<[number, number] | null>(null);
  const [pickingStart, setPickingStart] = useState(false);
  const [roadRegionCount, setRoadRegionCount] = useState(0);

  // routeStart defaults to GPS position
  const effectiveStart = routeStart || position;

  const { route, routeLoading, routeError, computeRoute, clearRoute } = useRoute(effectiveStart);

  const {
    pois,
    loading: poiLoading,
    totalCached: totalCachedPOIs,
    refetch: refetchPOI,
    fetchForBounds,
  } = usePOI(mapBounds, isOnline);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Geolocation
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
      () => {} // fallback: stay at world view
    );
  }, []);

  // Track cached tile count and road stats
  useEffect(() => {
    getCachedTileCount().then(setCachedCount);
    getRoadStats().then((s) => setRoadRegionCount(s.regionCount));
    const interval = setInterval(() => {
      getCachedTileCount().then(setCachedCount);
      getRoadStats().then((s) => setRoadRegionCount(s.regionCount));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Track zoom
  useEffect(() => {
    if (!mapRef) return;
    const handler = () => setZoom(mapRef.getZoom());
    mapRef.on("zoomend", handler);
    return () => { mapRef.off("zoomend", handler); };
  }, [mapRef]);

  // Get initial bounds once map is ready
  useEffect(() => {
    if (!mapRef) return;
    setMapBounds(mapRef.getBounds());
  }, [mapRef]);

  const locate = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
      () => {}
    );
  }, []);

  const fetchRoadsForBounds = useCallback(async (boundsObj: { north: number; south: number; east: number; west: number }) => {
    try {
      const ways = await fetchRoads(boundsObj);
      if (ways.length > 0) {
        const graph = buildGraph(ways);
        await saveGraph(boundsObj, graph);
        await saveRoadRegion(boundsObj);
        const stats = await getRoadStats();
        setRoadRegionCount(stats.regionCount);
      }
    } catch {
      // Road fetch failed — tiles and POIs still download
    }
  }, []);

  // Downloads tiles, POIs, AND roads for the current viewport
  const downloadArea = useCallback(async () => {
    if (!mapRef) return;
    const bounds = mapRef.getBounds();
    const boundsObj = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };
    const currentZoom = mapRef.getZoom();
    const minZoom = Math.max(0, currentZoom - 2);
    const maxZoom = Math.min(18, currentZoom + 2);
    const tiles = getTileBounds(boundsObj, minZoom, maxZoom);

    setDownloading(true);
    setProgress({ done: 0, total: tiles.length });

    // Download tiles, fetch POIs, and fetch roads in parallel
    await Promise.all([
      downloadTiles(tiles, (done, total) => {
        setProgress({ done, total });
      }),
      fetchForBounds(boundsObj),
      fetchRoadsForBounds(boundsObj),
    ]);

    setDownloading(false);
    const count = await getCachedTileCount();
    setCachedCount(count);
  }, [mapRef, fetchForBounds, fetchRoadsForBounds]);

  const tileEstimate = useCallback(() => {
    if (!mapRef) return 0;
    const bounds = mapRef.getBounds();
    const currentZoom = mapRef.getZoom();
    const minZoom = Math.max(0, currentZoom - 2);
    const maxZoom = Math.min(18, currentZoom + 2);
    return getTileBounds(
      {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
      minZoom,
      maxZoom
    ).length;
  }, [mapRef]);

  const progressBar = () => {
    const { done, total } = progress;
    const width = 20;
    const filled = total > 0 ? Math.round((done / total) * width) : 0;
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
    return `caching... [${bar}] ${done}/${total}`;
  };

  const toggleCategory = (cat: POICategory) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handlePickStart = useCallback((lat: number, lng: number) => {
    setRouteStart([lat, lng]);
    setPickingStart(false);
  }, []);

  const handleRoute = useCallback((lat: number, lng: number) => {
    computeRoute(lat, lng);
  }, [computeRoute]);

  const handleClearRoute = useCallback(() => {
    clearRoute();
  }, [clearRoute]);

  // Start location display text
  const startLabel = routeStart
    ? `start: manual ${routeStart[0].toFixed(2)}, ${routeStart[1].toFixed(2)}`
    : position
      ? `start: GPS ${position[0].toFixed(2)}, ${position[1].toFixed(2)}`
      : 'start: not set';

  // Route info text
  const routeInfo = routeLoading
    ? 'computing route...'
    : routeError === 'NO_ROAD_DATA'
      ? 'NO ROAD DATA — download area first'
      : routeError === 'NO_PATH'
        ? 'NO PATH FOUND'
        : routeError === 'TOO_FAR'
          ? 'TOO FAR FROM ROAD NETWORK'
          : route
            ? `route: ${route.distanceMeters < 1000
              ? `${Math.round(route.distanceMeters)}m`
              : `${(route.distanceMeters / 1000).toFixed(1)}km`}`
            : null;

  // Show start marker when manual start is set, or when GPS unavailable
  const showStartMarker = routeStart && (!position || routeStart[0] !== position[0] || routeStart[1] !== position[1]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={position || DEFAULT_CENTER}
        zoom={position ? 14 : DEFAULT_ZOOM}
        className="h-full w-full"
        zoomControl={true}
        ref={setMapRef}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} subdomains={["a"]} />
        {position && <Marker position={position} icon={pulsingIcon} />}
        {showStartMarker && <Marker position={routeStart} icon={startIcon} />}
        <RecenterMap position={position} />
        <StartLocationPicker active={pickingStart} onPick={handlePickStart} />
        <POIMarkers
          pois={pois}
          enabledCategories={enabledCategories}
          userPosition={effectiveStart}
          onBoundsChange={setMapBounds}
          onRoute={handleRoute}
        />
        <RouteLayer route={route} />
      </MapContainer>

      {/* Category filter panel */}
      <div className="absolute top-4 right-4 z-[1000] rounded border border-border bg-surface/90 px-2 py-2 font-mono text-[10px]">
        <div className="grid grid-cols-3 gap-1">
          {CATEGORIES.map((cat) => {
            const active = enabledCategories.has(cat.category);
            return (
              <button
                key={cat.category}
                onClick={() => toggleCategory(cat.category)}
                className="border border-border px-1.5 py-0.5 transition-colors"
                style={{
                  color: active ? cat.color : 'var(--muted)',
                  borderColor: active ? cat.color : 'var(--border)',
                  opacity: active ? 1 : 0.5,
                }}
              >
                {cat.icon} {cat.label}
              </button>
            );
          })}
        </div>
        {isOnline && (
          <button
            onClick={refetchPOI}
            disabled={poiLoading}
            className="mt-1 w-full border border-border px-2 py-0.5 text-green hover:bg-green hover:text-background disabled:opacity-50"
          >
            {poiLoading ? 'FETCHING...' : 'FETCH POI'}
          </button>
        )}
      </div>

      {/* Control overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] flex flex-col gap-1 rounded border border-border bg-surface/90 px-3 py-2 font-mono text-[11px]">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={locate}
            className="border border-border px-2 py-0.5 text-green hover:bg-green hover:text-background"
          >
            LOCATE
          </button>
          <button
            onClick={() => setPickingStart((p) => !p)}
            className="border border-border px-2 py-0.5 hover:text-background"
            style={{
              color: pickingStart ? 'var(--background)' : 'var(--amber)',
              borderColor: 'var(--amber)',
              background: pickingStart ? 'var(--amber)' : 'transparent',
            }}
          >
            {pickingStart ? 'PICKING...' : 'SET START'}
          </button>
          {route && (
            <button
              onClick={handleClearRoute}
              className="border border-border px-2 py-0.5 text-red hover:bg-red hover:text-background"
              style={{ borderColor: 'var(--red)' }}
            >
              CLEAR ROUTE
            </button>
          )}
          {isOnline ? (
            <button
              onClick={downloadArea}
              disabled={downloading}
              className="border border-border px-2 py-0.5 text-amber hover:bg-amber hover:text-background disabled:opacity-50"
            >
              {downloading
                ? "CACHING..."
                : `DOWNLOAD AREA (~${tileEstimate()} tiles + POIs + roads)`}
            </button>
          ) : (
            <span className="text-muted">offline — using cached data</span>
          )}
        </div>

        {downloading && (
          <div className="text-amber">{progressBar()}</div>
        )}

        {routeInfo && (
          <div style={{ color: routeError ? 'var(--amber)' : 'var(--green)' }}>
            {routeInfo}
          </div>
        )}

        <div className="text-muted">
          {startLabel}
        </div>

        <div className="text-muted">
          {position
            ? `pos: ${position[0].toFixed(2)}\u00b0${position[0] >= 0 ? "N" : "S"}, ${Math.abs(position[1]).toFixed(2)}\u00b0${position[1] >= 0 ? "W" : "E"}`
            : "pos: unknown"}
          {" | "}zoom: {zoom}
          {" | "}tiles: {cachedCount}
          {" | "}pois: {pois.length} visible, {totalCachedPOIs} saved
          {" | "}roads: {roadRegionCount} areas saved
        </div>
      </div>
    </div>
  );
}
