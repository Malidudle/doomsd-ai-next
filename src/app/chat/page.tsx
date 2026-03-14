'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPOIsNearPoint } from '@/lib/poi/poiStore';
import { formatPOIContext } from '@/lib/poi/formatContext';

const MODELS = [
  { id: 'qwen3.5:0.8b', label: 'qwen3.5:0.8b', desc: 'fast' },
  { id: 'qwen3.5:4b', label: 'qwen3.5:4b', desc: 'balanced' },
  { id: 'qwen3:latest', label: 'qwen3:8b', desc: 'quality' },
] as const;

const QUICK_CHIPS = [
  'Identify plant',
  'Build shelter',
  'Purify water',
  'Signal help',
  'Treat wound',
];

function Timestamp({ date }: { date: Date }) {
  const t = new Date(date);
  const h = t.getHours().toString().padStart(2, '0');
  const m = t.getMinutes().toString().padStart(2, '0');
  const s = t.getSeconds().toString().padStart(2, '0');
  return (
    <span className="text-muted select-none shrink-0 text-[10px]">
      {h}:{m}:{s}
    </span>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-muted text-xs">Loading chat...</div>}>
      <ChatInner />
    </Suspense>
  );
}

function ChatInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [input, setInput] = useState(initialQuery);
  const [model, setModel] = useState('qwen3.5:4b');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [locationContext, setLocationContext] = useState('');
  const [poiCount, setPoiCount] = useState(0);

  // Geolocation
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
      () => {},
    );
  }, []);

  // Build location context
  useEffect(() => {
    if (!userPosition) return;
    const loadContext = () => {
      getPOIsNearPoint(userPosition[0], userPosition[1], 10).then((nearby) => {
        setPoiCount(nearby.length);
        setLocationContext(formatPOIContext(userPosition[0], userPosition[1], nearby));
      });
    };
    loadContext();
    const interval = setInterval(loadContext, 15000);
    return () => clearInterval(interval);
  }, [userPosition]);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', body: { model, locationContext } }),
    [model, locationContext],
  );

  const { messages, sendMessage, status } = useChat({ transport });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);


  const isStreaming = status !== 'ready';

  const handleSend = (text: string) => {
    if (text.trim()) {
      sendMessage({ text });
      setInput('');
    }
  };

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full crt-glow">
      {/* Top Bar */}
      <div className="border-b border-border px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <h1 className="text-green text-xs font-bold tracking-wider">LIFELINE CHAT</h1>
        <span className="text-[10px] bg-green/15 text-green px-2 py-0.5 rounded-full border border-border-green">
          EARTHQUAKE
        </span>
        <span className="text-[10px] text-green">●</span>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowModelPicker((p) => !p)}
              className="text-[10px] border border-border px-2 py-0.5 text-text-secondary hover:text-green transition-colors"
            >
              {model} ▾
            </button>
            {showModelPicker && (
              <div className="absolute top-6 right-0 z-50 border border-border bg-surface py-1 min-w-[180px]">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                    className={`block w-full text-left px-3 py-1 text-[11px] hover:bg-green/10 ${
                      m.id === model ? 'text-green' : 'text-foreground'
                    }`}
                  >
                    {m.label} <span className="text-muted">({m.desc})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {/* System join */}
        <div className="text-muted text-[11px] mb-4">
          <span className="text-green-dim">***</span> user joined{' '}
          <span className="text-text-amber">#survival-general</span> [{timeStr}]
        </div>

        {messages.length === 0 && !isStreaming && (
          <div className="text-muted text-[11px] italic">&lt;no messages yet&gt;</div>
        )}

        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={message.id}
              className={`msg-enter mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] md:max-w-[70%] px-3 py-2 ${
                  isUser
                    ? 'bg-[#111619] border border-[#1B2A1B] rounded-sm'
                    : 'bg-[#0D1A0D] border border-green/20 rounded-sm'
                }`}
              >
                {!isUser && (
                  <div className="text-green text-[10px] font-bold mb-1">&gt; LIFELINE</div>
                )}
                <div className="text-[12px] leading-relaxed">
                  {message.parts.map((part, i) =>
                    part.type === 'text' ? (
                      <span key={i} className="whitespace-pre-wrap break-words">{part.text}</span>
                    ) : null,
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Timestamp date={new Date()} />
                  {!isUser && (
                    <button className="text-[9px] text-muted hover:text-green transition-colors">
                      READ ALOUD
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isStreaming && (
          <div className="flex justify-start mb-3">
            <div className="bg-[#0D1A0D] border border-green/20 px-3 py-2 rounded-sm">
              <div className="text-green text-[10px] font-bold mb-1">&gt; LIFELINE</div>
              <span className="text-muted text-[12px]">Thinking...<span className="cursor-blink">_</span></span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Chips */}
      <div className="px-4 py-2 border-t border-border flex gap-2 overflow-x-auto">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => handleSend(chip)}
            disabled={isStreaming}
            className="shrink-0 text-[10px] border border-border-green text-green px-3 py-1 rounded-full hover:bg-green/10 transition-colors disabled:opacity-30"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="border-t border-border bg-surface px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-3 border border-border-green rounded-sm px-3 py-2 bg-background"
        >
          <span className="text-green text-sm">🎤</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder="Ask anything..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted/50 outline-none text-[12px] disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="text-green hover:text-green-bright transition-colors disabled:opacity-30"
          >
            ➤
          </button>
        </form>
        <div className="flex items-center gap-4 mt-2 text-[9px] text-muted select-none">
          <span>
            {userPosition
              ? `loc: ${userPosition[0].toFixed(2)}, ${userPosition[1].toFixed(2)} | pois: ${poiCount}`
              : 'loc: unknown'}
          </span>
          <span className="ml-auto">
            {isStreaming ? (
              <span className="text-text-amber">streaming...</span>
            ) : (
              <span className="text-green-dim">ready</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
