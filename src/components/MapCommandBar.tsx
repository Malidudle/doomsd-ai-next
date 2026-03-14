'use client';

import { useState, useCallback } from 'react';

interface ToastState {
  text: string;
  status: 'thinking' | 'streaming' | 'tool' | 'done' | 'error';
  visible: boolean;
}

interface Props {
  onSend: (text: string) => void;
  isProcessing: boolean;
  toast: ToastState | null;
}

const STATUS_LABELS: Record<ToastState['status'], string> = {
  thinking: '◌ AI thinking',
  streaming: '◉ AI',
  tool: '⚡ executing',
  done: '▶ AI',
  error: '✕ error',
};

const STATUS_COLORS: Record<ToastState['status'], string> = {
  thinking: 'var(--muted)',
  streaming: 'var(--green)',
  tool: 'var(--amber)',
  done: 'var(--green)',
  error: 'var(--red)',
};

export default function MapCommandBar({ onSend, isProcessing, toast }: Props) {
  const [input, setInput] = useState('');

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isProcessing) return;
    onSend(input.trim());
    setInput('');
  }, [input, isProcessing, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const showToast = toast?.visible;
  const toastStatus = toast?.status || 'done';
  const isAnimating = toastStatus === 'thinking' || toastStatus === 'streaming' || toastStatus === 'tool';

  return (
    <>
      {/* Toast overlay */}
      {showToast && toast && (
        <div
          className="absolute left-1/2 z-[1001] -translate-x-1/2 rounded border bg-surface/95 px-3 py-2 font-mono text-[11px]"
          style={{
            bottom: '52px',
            maxWidth: '90vw',
            borderColor: STATUS_COLORS[toastStatus],
            boxShadow: `0 0 12px ${STATUS_COLORS[toastStatus]}22`,
            transition: 'opacity 0.3s',
          }}
        >
          <div
            className="text-[10px] mb-0.5"
            style={{
              color: STATUS_COLORS[toastStatus],
              animation: isAnimating ? 'pulse 1.5s ease-in-out infinite' : undefined,
            }}
          >
            {STATUS_LABELS[toastStatus]}
          </div>
          <div
            className="text-foreground"
            style={{
              color: toastStatus === 'thinking' ? 'var(--muted)' : toastStatus === 'error' ? 'var(--red)' : undefined,
            }}
          >
            {toast.text}
            {toastStatus === 'streaming' && <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>▌</span>}
          </div>
        </div>
      )}

      {/* Command bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1001] flex items-center gap-2 border-t bg-background/95 px-3 py-2 font-mono text-[11px]"
        style={{ borderColor: isProcessing ? 'var(--amber)' : 'var(--green)' }}
      >
        <span
          style={{
            color: isProcessing ? 'var(--amber)' : 'var(--green)',
            animation: isProcessing ? 'pulse 1s ease-in-out infinite' : undefined,
          }}
        >
          {isProcessing ? '◌' : '▶'}
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isProcessing ? 'AI is working...' : 'ask the map...'}
          disabled={isProcessing}
          className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={isProcessing || !input.trim()}
          className="border px-2 py-0.5 hover:text-background disabled:opacity-30"
          style={{
            color: isProcessing ? 'var(--amber)' : 'var(--green)',
            borderColor: isProcessing ? 'var(--amber)' : 'var(--green)',
          }}
        >
          {isProcessing ? '◌◌◌' : 'SEND'}
        </button>
      </div>
    </>
  );
}
