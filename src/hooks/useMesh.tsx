"use client";

import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import type { MeshHealth, MeshState, MeshMessage, MeshPeer } from "@/lib/mesh/types";
import * as meshApi from "@/lib/mesh/api";

const STATE_POLL_MS = 2000;
const HEALTH_POLL_MS = 5000;
const HIDDEN_POLL_MS = 10000;

type MeshStatus = "connecting" | "online" | "offline";

interface MeshContextValue {
  status: MeshStatus;
  health: MeshHealth | null;
  state: MeshState | null;
  error: string | null;
  sending: boolean;
  nickname: string | null;
  peerID: string | null;
  bluetoothState: string | null;
  peers: MeshPeer[];
  messages: MeshMessage[];
  serviceMode: string | null;
  connectedPeers: number;
  reachablePeers: number;
  updateNickname: (nickname: string) => Promise<void>;
  announce: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  refreshState: () => Promise<void>;
}

const MeshContext = createContext<MeshContextValue | null>(null);

export function MeshProvider({ children }: { children: React.ReactNode }) {
  const value = useMeshInternal();
  return <MeshContext.Provider value={value}>{children}</MeshContext.Provider>;
}

export function useMesh(): MeshContextValue {
  const ctx = useContext(MeshContext);
  if (!ctx) throw new Error("useMesh must be used within <MeshProvider>");
  return ctx;
}

function useMeshInternal(): MeshContextValue {
  const [status, setStatus] = useState<MeshStatus>("connecting");
  const [health, setHealth] = useState<MeshHealth | null>(null);
  const [state, setState] = useState<MeshState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const mountedRef = useRef(true);
  const visibleRef = useRef(true);

  // Track tab visibility
  useEffect(() => {
    const onVisChange = () => { visibleRef.current = !document.hidden; };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, []);

  // Health polling — determines bridge online/offline
  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const h = await meshApi.getHealth();
        if (!mountedRef.current) return;
        setHealth(h);
        setStatus((prev) => prev === "connecting" ? "connecting" : "online");
      } catch {
        if (!mountedRef.current) return;
        setStatus("offline");
        setHealth(null);
      }
      const delay = visibleRef.current ? HEALTH_POLL_MS : HIDDEN_POLL_MS;
      timer = setTimeout(poll, delay);
    };

    poll();
    return () => { mountedRef.current = false; clearTimeout(timer); };
  }, []);

  // State polling — fetches mesh data, also promotes status to "online"
  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const s = await meshApi.getState();
        if (!mountedRef.current) return;
        setState(s);
        setStatus("online");
      } catch {
        // state fetch failed — status stays as-is (health determines offline)
      }
      const delay = visibleRef.current ? STATE_POLL_MS : HIDDEN_POLL_MS;
      timer = setTimeout(poll, delay);
    };

    poll();
    return () => { mountedRef.current = false; clearTimeout(timer); };
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const s = await meshApi.getState();
      if (mountedRef.current) setState(s);
    } catch {
      // next poll will pick it up
    }
  }, []);

  const updateNickname = useCallback(async (nickname: string) => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    try {
      const updated = await meshApi.updateNickname(trimmed);
      if (mountedRef.current) {
        setState(updated);
        setError(null);
      }
    } catch {
      if (mountedRef.current) setError("Failed to update nickname");
    }
  }, []);

  const doAnnounce = useCallback(async () => {
    try {
      await meshApi.announce();
      if (mountedRef.current) setError(null);
    } catch {
      if (mountedRef.current) setError("Announce failed");
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await meshApi.sendPublicMessage(trimmed);
      if (mountedRef.current) setError(null);
      await refreshState();
    } catch {
      if (mountedRef.current) setError("Message send failed");
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [refreshState]);

  const nickname = state?.nickname ?? null;
  const peerID = state?.peerID ?? null;
  const bluetoothState = state?.bluetoothState ?? null;
  const peers: MeshPeer[] = state?.peers ?? [];
  const messages: MeshMessage[] = state?.recentMessages ?? [];
  const serviceMode = health?.serviceMode ?? null;
  const connectedPeers = peers.filter((p) => p.isConnected).length;
  const reachablePeers = peers.filter((p) => p.isReachable && !p.isConnected).length;

  return {
    status,
    health,
    state,
    error,
    sending,
    nickname,
    peerID,
    bluetoothState,
    peers,
    messages,
    serviceMode,
    connectedPeers,
    reachablePeers,
    updateNickname,
    announce: doAnnounce,
    sendMessage,
    refreshState,
  };
}
