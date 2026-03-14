'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import SourcesPanel, { type Source } from '@/components/SourcesPanel';

const SCOPE_TABS = ['CHAT INPUT', 'TRANSCRIPT', 'RETRIEVAL', 'ARTICLE VIEWER'];

// Mock sources — will be replaced by real RAG pipeline
const MOCK_SOURCES: Source[] = [
  {
    id: 's1',
    index: 1,
    title: 'Emergency Water Disinfection',
    origin: 'Offline Wikipedia Archive',
    snippet:
      'Boiling is recommended for microbiologically unsafe water. The process requires sufficient heat to maintain a rolling boil, after which the container should be kept covered to prevent recontamination.',
  },
  {
    id: 's2',
    index: 2,
    title: 'Boiling Water',
    origin: 'Offline Wikipedia Archive',
    snippet:
      'Boiling water is the process of heating water until it reaches its boiling point of 100°C at standard atmospheric pressure. It is one of the oldest methods of water purification.',
  },
  {
    id: 's3',
    index: 3,
    title: 'Household Water Treatment',
    origin: 'Offline Wikipedia Archive',
    snippet:
      'Household water treatment includes a range of methods for treating water at home, including boiling, chlorination, solar disinfection, ceramic filtration, and biosand filtration.',
  },
];

function Timestamp({ date }: { date: Date }) {
  const t = new Date(date);
  const h = t.getHours().toString().padStart(2, '0');
  const m = t.getMinutes().toString().padStart(2, '0');
  return (
    <span className="text-muted text-[9px]">
      {h}:{m}
    </span>
  );
}

export default function SurvivePage() {
  const [activeTab, setActiveTab] = useState('TRANSCRIPT');
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', body: { model: 'qwen3.5:4b' } }),
    [],
  );

  const { messages, sendMessage, status } = useChat({ transport });
  const isStreaming = status !== 'ready';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Populate mock sources after first AI response
  useEffect(() => {
    const hasAssistant = messages.some((m) => m.role === 'assistant');
    if (hasAssistant && sources.length === 0) {
      setSources(MOCK_SOURCES);
    }
  }, [messages, sources.length]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    sendMessage({ text: trimmed });
    setInput('');
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Center Panel */}
      <div className="flex-1 flex flex-col h-full min-w-0 crt-glow">
        {/* Header */}
        <div className="px-6 pt-6 pb-0">
          <h1 className="text-green text-2xl font-semibold tracking-wider">SURVIVECHAT + WIKIPEDIA</h1>
          <p className="text-green text-[12px] mt-1.5">
            &gt; GROUNDED OFFLINE ANSWERS WITH INSPECTABLE SOURCES
          </p>
        </div>

        {/* Feature Scope Bar */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex gap-2 flex-wrap">
            {SCOPE_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                  activeTab === tab
                    ? 'border-green text-green'
                    : 'border-border-green text-foreground hover:border-green'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Transcript */}
        <div className="flex-1 px-6 pt-3 pb-0 overflow-hidden flex flex-col gap-3">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto border border-border-green rounded-md p-3 flex flex-col gap-3"
          >
            {messages.length === 0 && !isStreaming && (
              <p className="text-muted text-[10px] italic text-center py-8">
                Ask a question about survival, medicine, plants, water, or local knowledge
              </p>
            )}

            {messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div key={message.id} className="msg-enter">
                  {isUser ? (
                    /* User bubble — right-aligned */
                    <div className="flex justify-end">
                      <div className="bg-bg-card-hover rounded-md px-3 py-2.5 max-w-[80%]">
                        {message.parts.map((part, i) =>
                          part.type === 'text' ? (
                            <span
                              key={i}
                              className="text-foreground text-[12px] leading-relaxed whitespace-pre-wrap break-words"
                            >
                              {part.text}
                            </span>
                          ) : null,
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Assistant bubble — left-aligned with sources */
                    <div className="flex flex-col gap-1.5">
                      <span className="text-text-secondary text-[10px] font-semibold">assistant</span>
                      <div className="border border-green rounded-md px-3 py-2.5">
                        <span className="text-green text-[10px] block mb-1">Answering from grounded evidence</span>
                        {message.parts.map((part, i) =>
                          part.type === 'text' ? (
                            <p
                              key={i}
                              className="text-foreground text-[12px] leading-relaxed whitespace-pre-wrap break-words"
                            >
                              {part.text}
                            </p>
                          ) : null,
                        )}
                        {/* Source citation hint */}
                        {sources.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            <span className="text-text-secondary text-[10px]">
                              Evidence attached: {sources.length} selected sources
                            </span>
                            {sources.map((src) => (
                              <button
                                key={src.id}
                                onClick={() => setSelectedSourceId(src.id)}
                                className={`text-left text-[10px] border rounded px-2.5 py-2 transition-colors ${
                                  selectedSourceId === src.id
                                    ? 'border-green bg-bg-card-hover text-green'
                                    : 'border-border-green text-foreground hover:border-green'
                                }`}
                              >
                                <span className="font-semibold">[{src.index}] {src.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isStreaming && (
              <div className="msg-enter flex flex-col gap-1.5">
                <span className="text-text-secondary text-[10px] font-semibold">assistant</span>
                <div className="border border-border-green rounded-md px-3 py-2.5">
                  <span className="text-green text-[10px]">Selecting relevant offline archives</span>
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-8 flex-1 border border-border-green rounded animate-pulse"
                      />
                    ))}
                  </div>
                  <span className="text-text-secondary text-[10px] block mt-2">Exploring offline archives</span>
                  <span className="text-text-secondary text-[10px] block">Ranking evidence</span>
                </div>
              </div>
            )}
          </div>

          {/* Error states display area */}
          {status === 'error' && (
            <div className="flex flex-col gap-1 text-[10px]">
              <span className="text-[#FF6B61] font-semibold">The local model is unavailable</span>
            </div>
          )}

          {/* Composer */}
          <div className="flex gap-2 pb-6 pt-2">
            <div className="flex-1 border border-border-green rounded-md bg-[#0B0F0B] px-3 py-2.5 flex flex-col gap-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                disabled={isStreaming}
                placeholder="Ask a question about survival, medicine, plants, water, or local knowledge"
                rows={2}
                className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted/50 outline-none resize-none disabled:opacity-40"
              />
              <span className="text-text-secondary text-[10px]">
                multiline input · typing enabled while assistant responds
              </span>
            </div>
            <button
              onClick={() => handleSend(input)}
              disabled={isStreaming || !input.trim()}
              className="self-start bg-green text-[#001A07] text-[11px] font-bold px-3.5 py-2.5 rounded-md hover:brightness-110 transition-all disabled:opacity-30"
            >
              SEND
            </button>
          </div>
        </div>
      </div>

      {/* Right panel — Sources + Wikipedia Viewer */}
      <SourcesPanel
        sources={sources}
        selectedSourceId={selectedSourceId}
        onSelectSource={setSelectedSourceId}
        onClose={() => setSelectedSourceId(null)}
      />
    </div>
  );
}
