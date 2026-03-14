import type { MeshHealth, MeshState, MeshMessage } from "./types";

const BASE = "/api/mesh";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<MeshHealth> {
  return fetchJSON<MeshHealth>(`${BASE}/health`);
}

export async function getState(): Promise<MeshState> {
  return fetchJSON<MeshState>(`${BASE}/state`);
}

export async function updateNickname(nickname: string): Promise<MeshState> {
  return fetchJSON<MeshState>(`${BASE}/nickname`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
}

export async function announce(): Promise<{ ok: boolean }> {
  return fetchJSON<{ ok: boolean }>(`${BASE}/announce`, {
    method: "POST",
  });
}

export async function sendPublicMessage(content: string): Promise<MeshMessage> {
  return fetchJSON<MeshMessage>(`${BASE}/messages/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}
