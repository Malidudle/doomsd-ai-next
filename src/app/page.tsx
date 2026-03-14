'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';

const MODELS = [
  { id: 'qwen3.5:0.8b', label: 'qwen3.5:0.8b', desc: 'fast' },
  { id: 'qwen3.5:4b', label: 'qwen3.5:4b', desc: 'balanced' },
  { id: 'qwen3:latest', label: 'qwen3:8b', desc: 'quality' },
] as const;

const ASCII_LOGO = `
 ┌─────────────────────────────────┐
 │  ▄▄▄▄  ▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄   │
 │  █  █    █    █   █       █     │
 │  █▄▄█    █    █   █       █     │
 │  █  █  ▄▄█    █   █▄▄▄▄▄▄█     │
 │  █▄▄█  █▄█    █   █▄▄▄▄▄▄█     │
 │                                 │
 │  b i t c h a t    v 0 . 1 . 0  │
 └─────────────────────────────────┘`;

function Timestamp({ date }: { date: Date }) {
  const t = new Date(date);
  const h = t.getHours().toString().padStart(2, '0');
  const m = t.getMinutes().toString().padStart(2, '0');
  const s = t.getSeconds().toString().padStart(2, '0');
  return (
    <span className="text-muted select-none shrink-0">
      [{h}:{m}:{s}]
    </span>
  );
}

export default function Home() {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('qwen3.5:4b');
  const [showModelPicker, setShowModelPicker] = useState(false);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', body: { model } }),
    [model],
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
  const modelNick = model.split(':')[0];

  return (
    <div className="scanlines flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-4 py-2">
        <pre className="text-green text-[10px] leading-tight crt-glow select-none hidden sm:block">
          {ASCII_LOGO}
        </pre>
        <div className="sm:hidden text-green font-bold crt-glow">
          bitchat v0.1.0
        </div>
        <div className="flex items-center gap-4 mt-1 text-[11px] text-muted">
          <span>
            <span className="text-green">●</span> connected
          </span>
          <span>channel: <span className="text-amber">#general</span></span>
          <span className="relative">
            model:{' '}
            <button
              onClick={() => setShowModelPicker((p) => !p)}
              className="text-blue hover:text-green-bright transition-colors"
            >
              {model} ▾
            </button>
            {showModelPicker && (
              <div className="absolute top-5 left-0 z-50 border border-border bg-surface py-1 min-w-[200px]">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setModel(m.id);
                      setShowModelPicker(false);
                    }}
                    className={`block w-full text-left px-3 py-1 hover:bg-green/10 transition-colors ${
                      m.id === model ? 'text-green' : 'text-foreground'
                    }`}
                  >
                    {m.label}{' '}
                    <span className="text-muted">({m.desc})</span>
                    {m.id === model && (
                      <span className="text-green ml-1">*</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </span>
        </div>
        <hr className="mt-2" />
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 crt-glow"
      >
        {/* System join message */}
        <div className="text-muted text-[12px] mb-3">
          <span className="text-green-dim">***</span>{' '}
          you have joined <span className="text-amber">#general</span>{' '}
          — type a message below to begin
        </div>

        <hr className="mb-3" />

        {messages.length === 0 && (
          <div className="text-muted text-[12px] italic">
            &lt;no messages yet&gt;
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === 'user';
          const nick = isUser ? 'you' : modelNick;
          const nickColor = isUser ? 'text-amber' : 'text-green';

          return (
            <div key={message.id} className="msg-enter flex gap-2 mb-1 leading-relaxed">
              <Timestamp date={new Date()} />
              <span className="select-none shrink-0">
                &lt;<span className={`font-bold ${nickColor}`}>{nick}</span>&gt;
              </span>
              <span className={isUser ? 'text-foreground' : 'text-foreground/90'}>
                {message.parts.map((part, i) =>
                  part.type === 'text' ? (
                    <span key={i} className="whitespace-pre-wrap break-words">{part.text}</span>
                  ) : null,
                )}
              </span>
            </div>
          );
        })}

        {isStreaming && (
          <div className="flex items-center gap-2 mt-1 text-muted text-[12px]">
            <span className="text-green-dim">***</span>{' '}
            {modelNick} is typing<span className="cursor-blink">_</span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-surface px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) {
              sendMessage({ text: input });
              setInput('');
            }
          }}
          className="flex items-center gap-2 max-w-full"
        >
          <span className="text-green select-none shrink-0 font-bold">&gt;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder="/msg ..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted/50 outline-none disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="text-[11px] border border-border px-3 py-1 text-green hover:bg-green/10 hover:border-green-dim transition-colors disabled:opacity-30 disabled:hover:bg-transparent select-none"
          >
            SEND
          </button>
        </form>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted select-none">
          <span>ESC clear</span>
          <span>ENTER send</span>
          <span className="ml-auto">
            {isStreaming ? (
              <span className="text-amber">streaming...</span>
            ) : (
              <span className="text-green-dim">ready</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
