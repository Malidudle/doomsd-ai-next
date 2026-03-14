'use client';

import { useState } from 'react';

const PRIORITIES = [
  { id: 1, label: 'Check water supply', done: true },
  { id: 2, label: 'Inspect shelter integrity', done: true },
  { id: 3, label: 'Signal for rescue', done: false },
  { id: 4, label: 'Ration food supply', done: true },
  { id: 5, label: 'Check mesh network', done: true },
  { id: 6, label: 'Rest during midday heat', done: false },
];

const GUIDES = [
  { title: 'Water', desc: 'Finding, purifying, and storing safe water sources' },
  { title: 'Food', desc: 'Foraging, rationing, and food safety basics' },
  { title: 'Shelter', desc: 'Building and reinforcing emergency shelters' },
  { title: 'Medical', desc: 'First aid, wound care, and triage protocols' },
  { title: 'Navigation', desc: 'Orienting without GPS using natural markers' },
  { title: 'Signals', desc: 'Visual and audio rescue signaling methods' },
];

const MESH_MESSAGES = [
  { user: 'alpha_7', msg: 'Water source confirmed at grid 4-7, bring containers', time: '14:23' },
  { user: 'rescue_k9', msg: 'Medical team ETA 2 hours at rally point B', time: '14:18' },
  { user: 'nomad_3', msg: 'Road blocked on sector 2, use alternate route via bridge', time: '14:05' },
  { user: 'base_cmd', msg: 'All units: maintain radio silence 15:00-16:00', time: '13:50' },
];

export default function SurvivePage() {
  const [priorities, setPriorities] = useState(PRIORITIES);
  const [meshInput, setMeshInput] = useState('');

  const completedCount = priorities.filter((p) => p.done).length;

  const togglePriority = (id: number) => {
    setPriorities((prev) =>
      prev.map((p) => (p.id === id ? { ...p, done: !p.done } : p)),
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto crt-glow">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3">
        <h1 className="text-green text-lg font-bold tracking-wider">SURVIVE</h1>
        <p className="text-muted text-[11px] mt-1">&gt; DAY 3 — EARTHQUAKE</p>
      </div>

      <div className="px-4 md:px-6 pb-6 flex flex-col lg:flex-row gap-6">
        {/* Left column */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Priorities */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] text-muted tracking-wider">PRIORITIES</h2>
              <span className="text-[10px] text-green">{completedCount}/{priorities.length} COMPLETE</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {priorities.map((item) => (
                <button
                  key={item.id}
                  onClick={() => togglePriority(item.id)}
                  className={`flex items-center gap-3 text-left text-[12px] px-3 py-2 border transition-colors ${
                    item.done
                      ? 'border-border text-green-dim line-through'
                      : 'border-border-green text-green hover:bg-green/5'
                  }`}
                >
                  <span className="font-bold shrink-0">[{item.done ? 'x' : ' '}]</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Survival Guides */}
          <div>
            <h2 className="text-[10px] text-muted tracking-wider mb-3">SURVIVAL GUIDES</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GUIDES.map((guide) => (
                <button
                  key={guide.title}
                  className="border border-border-green bg-bg-card hover:bg-bg-card-hover p-3 text-left transition-colors"
                >
                  <div className="text-green text-[12px] font-bold mb-1">{guide.title}</div>
                  <div className="text-text-secondary text-[10px] leading-relaxed">{guide.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — BitChat Mesh */}
        <div className="flex-1 border border-border bg-bg-card flex flex-col max-h-[500px]">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-green text-[12px] font-bold">BITCHAT LOCAL MESH</h2>
              <span className="text-[10px] text-muted">12 nearby · 3 groups</span>
            </div>
          </div>

          {/* SOS Banner */}
          <div className="mx-3 mt-3 px-3 py-2 border border-text-amber bg-text-amber/5 text-text-amber text-[10px]">
            ⚠ SOS ALERT: User delta_9 requesting medical assistance — Grid 2-5
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
            {MESH_MESSAGES.map((msg, i) => (
              <div key={i} className="text-[11px]">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-green font-bold">{msg.user}</span>
                  <span className="text-muted text-[9px]">{msg.time}</span>
                </div>
                <div className="text-text-secondary pl-0">{msg.msg}</div>
              </div>
            ))}
          </div>

          {/* Chat input */}
          <div className="border-t border-border px-3 py-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setMeshInput('');
              }}
              className="flex items-center gap-2"
            >
              <input
                value={meshInput}
                onChange={(e) => setMeshInput(e.target.value)}
                placeholder="Message mesh network..."
                className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted/50 outline-none"
              />
              <button type="submit" className="text-green text-[11px] hover:text-green-bright transition-colors">
                SEND
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
