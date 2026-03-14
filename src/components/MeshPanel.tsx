'use client';

import { useState } from 'react';
import { useMesh } from '@/hooks/useMesh';
import type { MeshPeer } from '@/lib/mesh/types';

function peerLabel(peer: MeshPeer): string {
  if (peer.isConnected) return 'connected';
  if (peer.isReachable) return 'reachable';
  return 'seen';
}

function peerLabelColor(peer: MeshPeer): string {
  if (peer.isConnected) return 'text-green';
  if (peer.isReachable) return 'text-text-amber';
  return 'text-muted';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function BluetoothBadge({ state }: { state: string | null }) {
  if (!state) return null;
  const healthy = state === 'poweredOn';
  return (
    <span className={`text-[9px] px-1.5 py-0.5 border ${
      healthy
        ? 'border-green/30 text-green'
        : 'border-text-amber/30 text-text-amber'
    }`}>
      BT: {state}
    </span>
  );
}

export default function MeshPanel() {
  const {
    status,
    nickname,
    peerID,
    bluetoothState,
    peers,
    messages,
    serviceMode,
    connectedPeers,
    reachablePeers,
    error,
    sending,
    sendMessage,
    announce,
    updateNickname,
  } = useMesh();

  const [input, setInput] = useState('');
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
    showFeedback('Sent');
  };

  const handleAnnounce = async () => {
    await announce();
    showFeedback('Announced');
  };

  const handleNickSubmit = async () => {
    const trimmed = nickDraft.trim();
    if (!trimmed) return;
    try {
      await updateNickname(trimmed);
      setEditingNick(false);
      showFeedback('Nickname updated');
    } catch {
      // error is set in the hook
    }
  };

  // Newest first
  const sortedMessages = [...messages].reverse();

  const bridgeOffline = status === 'offline';

  return (
    <div className="border border-border bg-bg-card flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-green text-[12px] font-bold">SURVIVECHAT LOCAL MESH</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${bridgeOffline ? 'bg-red' : 'bg-green'}`} />
              <span className="text-[10px] text-muted">
                {bridgeOffline
                  ? 'Bridge unavailable'
                  : `${peers.length} nearby · ${connectedPeers} connected`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <BluetoothBadge state={bluetoothState} />
            {serviceMode && (
              <span className="text-[9px] px-1.5 py-0.5 border border-border text-muted">{serviceMode}</span>
            )}
          </div>
        </div>

        {/* Identity row */}
        {!bridgeOffline && (
          <div className="mt-2 flex items-center gap-2 text-[10px]">
            {editingNick ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleNickSubmit(); }}
                className="flex items-center gap-1"
              >
                <input
                  value={nickDraft}
                  onChange={(e) => setNickDraft(e.target.value.slice(0, 32))}
                  className="bg-background border border-border-green px-1.5 py-0.5 text-[10px] text-foreground outline-none w-24"
                  autoFocus
                />
                <button type="submit" className="text-green hover:text-green-bright">OK</button>
                <button type="button" onClick={() => setEditingNick(false)} className="text-muted hover:text-foreground">X</button>
              </form>
            ) : (
              <>
                <span className="text-text-secondary">nick:</span>
                <span className="text-green font-bold">{nickname ?? '—'}</span>
                <button
                  onClick={() => { setNickDraft(nickname ?? ''); setEditingNick(true); }}
                  className="text-muted hover:text-green transition-colors"
                >
                  [edit]
                </button>
              </>
            )}
            {peerID && (
              <span className="text-muted ml-auto" title={peerID}>
                {peerID.slice(0, 8)}…
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bridge offline state */}
      {bridgeOffline && (
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="text-center">
            <div className="text-red text-[12px] font-bold mb-1">BRIDGE UNAVAILABLE</div>
            <div className="text-muted text-[10px]">Waiting for SurviveChat bridge connection...</div>
            <div className="text-muted text-[10px] mt-1">Polling every 2s</div>
          </div>
        </div>
      )}

      {/* Online content */}
      {!bridgeOffline && (
        <>
          {/* Peer list (collapsible) */}
          {peers.length > 0 && (
            <div className="px-3 py-2 border-b border-border">
              <div className="text-[9px] text-muted tracking-wider mb-1">
                PEERS ({connectedPeers} connected, {reachablePeers} reachable)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {peers.map((peer) => (
                  <span
                    key={peer.peerID}
                    className={`text-[9px] px-1.5 py-0.5 border border-border ${peerLabelColor(peer)}`}
                    title={`${peer.peerID} — ${peerLabel(peer)}`}
                  >
                    {peer.nickname}
                    <span className="text-muted ml-1">[{peerLabel(peer)}]</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions row */}
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <button
              onClick={handleAnnounce}
              className="text-[9px] border border-border px-2 py-0.5 text-text-amber hover:bg-text-amber/10 transition-colors"
            >
              ANNOUNCE
            </button>
            {feedback && (
              <span className="text-[9px] text-green msg-enter">{feedback}</span>
            )}
            {error && (
              <span className="text-[9px] text-red msg-enter">{error}</span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-[120px]">
            {sortedMessages.length === 0 && (
              <div className="text-muted text-[10px] italic text-center py-4">&lt;no messages&gt;</div>
            )}
            {sortedMessages.map((msg) => {
              const isOutbound = msg.direction === 'outbound';
              return (
                <div key={msg.id} className="text-[11px] msg-enter">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={isOutbound ? 'text-text-amber font-bold' : 'text-green font-bold'}>
                      {msg.sender}
                    </span>
                    <span className="text-muted text-[9px]">{formatTime(msg.timestamp)}</span>
                    {isOutbound && <span className="text-muted text-[8px]">↑</span>}
                  </div>
                  <div className="text-text-secondary">{msg.content}</div>
                </div>
              );
            })}
          </div>

          {/* Compose */}
          <div className="border-t border-border px-3 py-2">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message mesh network..."
                disabled={sending}
                className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted/50 outline-none disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="text-green text-[11px] hover:text-green-bright transition-colors disabled:opacity-30"
              >
                {sending ? 'SENDING...' : 'SEND'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
