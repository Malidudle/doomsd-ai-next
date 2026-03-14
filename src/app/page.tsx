'use client';

import Link from 'next/link';
import { useState } from 'react';

const CRISIS_TYPES = [
  { id: 'earthquake', label: 'Earthquake', icon: '⫘⫘⫘' },
  { id: 'flood', label: 'Flood', icon: '≈≈≈' },
  { id: 'warzone', label: 'War Zone', icon: '⚠!⚠' },
  { id: 'wilderness', label: 'Wilderness', icon: '▲▲▲' },
  { id: 'medical', label: 'Medical', icon: '+♥+' },
  { id: 'custom', label: 'Custom', icon: '···' },
];

const ACTION_CARDS = [
  { label: 'AM I SAFE HERE?', icon: '  ?  ', href: '/chat?q=Am+I+safe+here' },
  { label: 'FIRST AID', icon: ' +♥+ ', href: '/chat?q=First+aid+guide' },
  { label: 'FIND WATER', icon: ' ≈▲≈ ', href: '/chat?q=Find+water+nearby' },
  { label: 'SIGNAL HELP', icon: ' )))  ', href: '/chat?q=How+to+signal+help' },
  { label: 'BUILD SHELTER', icon: ' /▲\\ ', href: '/chat?q=Build+emergency+shelter' },
  { label: 'BROADCAST SOS', icon: '[SOS]', href: '/chat?q=Broadcast+SOS+signal' },
];

export default function SOSDashboard() {
  const [activeCrisis, setActiveCrisis] = useState('earthquake');

  return (
    <div className="flex flex-col h-full p-4 md:p-6 crt-glow">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-green text-lg font-bold tracking-wider">SOS DASHBOARD</h1>
        <p className="text-muted text-[11px] mt-1">&gt; Select crisis type and choose an action</p>
      </div>

      {/* Crisis Selector */}
      <div className="mb-6">
        <h2 className="text-[10px] text-muted tracking-wider mb-3">CRISIS TYPE</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {CRISIS_TYPES.map((crisis) => {
            const active = activeCrisis === crisis.id;
            return (
              <button
                key={crisis.id}
                onClick={() => setActiveCrisis(crisis.id)}
                className={`border px-3 py-3 text-center transition-all ${
                  active
                    ? 'border-green text-green bg-green/5 shadow-[0_0_12px_rgba(0,255,65,0.15)]'
                    : 'border-border text-muted hover:border-border-green hover:text-text-secondary'
                }`}
              >
                <div className="text-sm font-bold mb-1 font-mono">{crisis.icon}</div>
                <div className="text-[10px] tracking-wider">{crisis.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Cards Grid */}
      <div className="flex-1">
        <h2 className="text-[10px] text-muted tracking-wider mb-3">QUICK ACTIONS</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ACTION_CARDS.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="border border-border-green bg-bg-card hover:bg-bg-card-hover hover:border-green transition-all p-4 md:p-6 flex flex-col items-center justify-center gap-3 group"
            >
              <pre className="text-green text-lg md:text-xl font-bold group-hover:drop-shadow-[0_0_8px_rgba(0,255,65,0.4)] transition-all">
                {card.icon}
              </pre>
              <span className="text-[10px] md:text-[11px] text-foreground tracking-wider text-center">
                {card.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="mt-6 pt-3 border-t border-border flex items-center gap-4 text-[10px] text-muted">
        <span>MODE: <span className="text-green">{activeCrisis.toUpperCase()}</span></span>
        <span>STATUS: <span className="text-green">ACTIVE</span></span>
        <span className="ml-auto">DoomsAI v0.1.0</span>
      </div>
    </div>
  );
}
