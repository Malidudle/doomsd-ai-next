'use client';

import { useState } from 'react';
import MeshPanel from '@/components/MeshPanel';

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

export default function SurvivePage() {
  const [priorities, setPriorities] = useState(PRIORITIES);

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
        <div className="flex-1">
          <MeshPanel />
        </div>
      </div>
    </div>
  );
}
