'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { POI } from '@/lib/poi/categories';
import { formatPOIContext } from '@/lib/poi/formatContext';
import { resolvePOI } from '@/lib/poi/poiResolver';

interface MapActions {
  onRouteTo: (lat: number, lng: number) => void;
  onZoomTo: (lat: number, lng: number) => void;
  onToggleCategories: (show?: string[], hide?: string[]) => void;
  onHighlightPOI: (lat: number, lng: number, name: string) => void;
  onDownloadArea: () => void;
}

interface UseMapChatOptions extends MapActions {
  pois: POI[];
  effectiveStart: [number, number] | null;
}

type ToastState = {
  text: string;
  status: 'thinking' | 'streaming' | 'tool' | 'done' | 'error';
  visible: boolean;
};

export function useMapChat({
  pois,
  effectiveStart,
  onRouteTo,
  onZoomTo,
  onToggleCategories,
  onHighlightPOI,
  onDownloadArea,
}: UseMapChatOptions) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentAtRef = useRef<number>(0);

  // Build location context for the AI
  const locationContext = useMemo(() => {
    if (!effectiveStart || pois.length === 0) return '';
    const [lat, lng] = effectiveStart;
    const withDist = pois.map((p) => {
      const R = 6371;
      const dLat = ((p.lat - lat) * Math.PI) / 180;
      const dLng = ((p.lng - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((p.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...p, distance };
    }).filter((p) => p.distance <= 10).sort((a, b) => a.distance - b.distance);
    return formatPOIContext(lat, lng, withDist);
  }, [effectiveStart, pois]);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/map-chat', body: { locationContext } }),
    [locationContext],
  );

  const showToast = useCallback((text: string, status: ToastState['status'] = 'done') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, status, visible: true });
    if (status === 'done' || status === 'error') {
      toastTimerRef.current = setTimeout(() => {
        setToast((prev) => prev ? { ...prev, visible: false } : null);
      }, 6000);
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleToolCall = useCallback(
    async ({ toolCall }: { toolCall: any }) => {
      const [lat, lng] = effectiveStart || [0, 0];
      const args = (toolCall.input ?? toolCall.args ?? {}) as Record<string, unknown>;

      const toolLabel = toolCall.toolName.replace(/_/g, ' ').toUpperCase();
      console.log(`[map-chat] tool call: ${toolCall.toolName}`, args);
      showToast(`executing ${toolLabel}...`, 'tool');

      switch (toolCall.toolName) {
        case 'route_to': {
          const poi = resolvePOI(
            { category: args.category as string, name: args.name as string },
            lat, lng, pois,
          );
          if (poi) {
            onRouteTo(poi.lat, poi.lng);
            const msg = `Routing to ${poi.name || poi.category}`;
            console.log(`[map-chat] ${msg}`);
            showToast(msg, 'done');
            return msg;
          }
          showToast('No matching POI found', 'error');
          return 'Could not find matching POI';
        }
        case 'zoom_to': {
          if (typeof args.lat === 'number' && typeof args.lng === 'number') {
            onZoomTo(args.lat as number, args.lng as number);
            const msg = `Zooming to ${(args.lat as number).toFixed(2)}, ${(args.lng as number).toFixed(2)}`;
            console.log(`[map-chat] ${msg}`);
            showToast(msg, 'done');
            return msg;
          }
          const poi = resolvePOI(
            { category: args.category as string, name: args.name as string },
            lat, lng, pois,
          );
          if (poi) {
            onZoomTo(poi.lat, poi.lng);
            const msg = `Zooming to ${poi.name || poi.category}`;
            console.log(`[map-chat] ${msg}`);
            showToast(msg, 'done');
            return msg;
          }
          showToast('No matching POI found', 'error');
          return 'Could not find matching POI';
        }
        case 'toggle_categories': {
          onToggleCategories(args.show as string[], args.hide as string[]);
          const msg = 'Categories updated';
          console.log(`[map-chat] ${msg}`, { show: args.show, hide: args.hide });
          showToast(msg, 'done');
          return msg;
        }
        case 'highlight_poi': {
          // Legacy: remap to route_to
          const poi = resolvePOI(
            { category: args.category as string, name: args.name as string },
            lat, lng, pois,
          );
          if (poi) {
            onRouteTo(poi.lat, poi.lng);
            const msg = `Routing to ${poi.name || poi.category}`;
            console.log(`[map-chat] highlight_poi remapped to route: ${msg}`);
            showToast(msg, 'done');
            return msg;
          }
          showToast('No matching POI found', 'error');
          return 'Could not find matching POI';
        }
        case 'download_area': {
          onDownloadArea();
          const msg = 'Downloading area...';
          console.log(`[map-chat] ${msg}`);
          showToast(msg, 'done');
          return msg;
        }
        default:
          return 'Unknown tool';
      }
    },
    [effectiveStart, pois, onRouteTo, onZoomTo, onToggleCategories, onHighlightPOI, onDownloadArea, showToast],
  );

  const toolCalledRef = useRef(false);

  const { messages, sendMessage, status } = useChat({
    transport,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onToolCall: (async ({ toolCall }: { toolCall: any }) => {
      toolCalledRef.current = true;
      const result = await handleToolCall({ toolCall });
      // Return the result string — SDK uses it as tool output to satisfy the
      // "tool result required" check. Won't trigger a second Ollama round-trip
      // since we're not using sendAutomaticallyWhen.
      return result;
    }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  const isProcessing = status === 'streaming' || status === 'submitted';

  // Log status changes + fallback intent parsing when model fails to call a tool
  const prevStatusRef = useRef(status);
  const lastUserInputRef = useRef('');
  useEffect(() => {
    if (status !== prevStatusRef.current) {
      const elapsed = sentAtRef.current ? `${((Date.now() - sentAtRef.current) / 1000).toFixed(1)}s` : '';
      console.log(`[map-chat] status: ${prevStatusRef.current} → ${status} ${elapsed}`);

      // When status goes to ready and no tool was called, try fallback
      if (status === 'ready' && prevStatusRef.current !== 'ready' && !toolCalledRef.current && lastUserInputRef.current) {
        console.log('[map-chat] no tool called — running fallback intent parser');
        fallbackIntent(lastUserInputRef.current);
      }

      prevStatusRef.current = status;
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: parse user text directly when the model fails to call a tool
  const fallbackIntent = useCallback((input: string) => {
    const lower = input.toLowerCase();
    const [lat, lng] = effectiveStart || [0, 0];

    // Category keyword mapping
    const KEYWORD_TO_CATEGORY: Record<string, string> = {
      hospital: 'hospital', clinic: 'hospital', doctor: 'hospital', medical: 'hospital', er: 'hospital',
      police: 'police', cop: 'police',
      fire: 'fire_station', 'fire station': 'fire_station', firehouse: 'fire_station',
      pharmacy: 'pharmacy', drug: 'pharmacy', medicine: 'pharmacy', chemist: 'pharmacy',
      shelter: 'emergency_shelter', refugee: 'emergency_shelter', bunker: 'bunker',
      assembly: 'assembly_point', 'meeting point': 'assembly_point', rally: 'assembly_point',
      water: 'water', 'drinking water': 'water', tap: 'water',
      supermarket: 'supermarket', market: 'supermarket', food: 'supermarket', grocery: 'supermarket', shop: 'supermarket', store: 'supermarket',
      fuel: 'fuel', gas: 'fuel', petrol: 'fuel', diesel: 'fuel',
    };

    // Find matching category
    let matchedCategory: string | null = null;
    for (const [keyword, category] of Object.entries(KEYWORD_TO_CATEGORY)) {
      if (lower.includes(keyword)) {
        matchedCategory = category;
        break;
      }
    }

    if (!matchedCategory) {
      console.log('[map-chat] fallback: no category matched');
      showToast('Could not understand request — try "route to hospital" or "show pharmacies"', 'error');
      return;
    }

    // Determine intent: route vs zoom vs filter
    const isRoute = /\b(route|go|take|walk|navigate|get to|head to|bring me|nearest|closest)\b/.test(lower);
    const isFilter = /\b(only|show|hide|filter|just)\b/.test(lower) && !/\b(show me|show where)\b/.test(lower);
    const isDownload = /\b(download|cache|offline|save area)\b/.test(lower);

    if (isDownload) {
      console.log('[map-chat] fallback: download_area');
      onDownloadArea();
      showToast('Downloading area...', 'done');
    } else if (isFilter) {
      console.log(`[map-chat] fallback: toggle_categories show=[${matchedCategory}]`);
      // Show only this category, hide everything else
      const allCategories = ['hospital', 'police', 'fire_station', 'pharmacy', 'emergency_shelter', 'bunker', 'assembly_point', 'weather_shelter', 'shelter', 'water', 'supermarket', 'fuel'];
      const hide = allCategories.filter(c => c !== matchedCategory);
      onToggleCategories([matchedCategory], hide);
      showToast(`Showing ${matchedCategory.replace(/_/g, ' ')} only`, 'done');
    } else if (isRoute || true) {
      // Default: route to it (most common intent)
      const poi = resolvePOI({ category: matchedCategory }, lat, lng, pois);
      if (poi) {
        console.log(`[map-chat] fallback: route_to ${poi.name || matchedCategory}`);
        onRouteTo(poi.lat, poi.lng);
        showToast(`Routing to ${poi.name || matchedCategory.replace(/_/g, ' ')}`, 'done');
      } else {
        console.log(`[map-chat] fallback: no POI found for ${matchedCategory}`);
        showToast(`No ${matchedCategory.replace(/_/g, ' ')} found nearby — download the area first`, 'error');
      }
    }
  }, [effectiveStart, pois, onRouteTo, onToggleCategories, onDownloadArea, showToast]);

  // Show streaming text as it arrives — update toast in real-time
  const lastAssistantMsg = messages.filter((m) => m.role === 'assistant').at(-1);
  const lastTextRef = useRef('');
  useEffect(() => {
    if (!lastAssistantMsg) return;
    const text = lastAssistantMsg.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') || '';
    if (text && text !== lastTextRef.current) {
      lastTextRef.current = text;
      showToast(text, isProcessing ? 'streaming' : 'done');
    }
  }, [lastAssistantMsg, showToast, isProcessing]);

  // Show "thinking..." when submitted but no text yet
  useEffect(() => {
    if (status === 'submitted') {
      showToast('connecting to AI...', 'thinking');
    } else if (status === 'streaming' && !lastTextRef.current) {
      showToast('thinking...', 'thinking');
    }
  }, [status, showToast]);

  const sendCommand = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      console.log(`[map-chat] sending: "${text}"`);
      sentAtRef.current = Date.now();
      lastTextRef.current = '';
      toolCalledRef.current = false;
      lastUserInputRef.current = text;
      sendMessage({ text });
    },
    [sendMessage],
  );

  return { toast, sendCommand, isProcessing };
}
