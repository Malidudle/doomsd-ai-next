'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';

function ProgressBar({ value, max, color = 'var(--green)' }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1.5 w-full bg-border rounded-sm overflow-hidden">
      <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function RightPanel() {
  const { isOnline } = useOnlineStatus();

  return (
    <div className="hidden lg:flex w-[320px] shrink-0 flex-col border-l border-border bg-background overflow-y-auto">
      {/* Supply Status */}
      <div className="p-4 border-b border-border">
        <h3 className="text-[10px] text-muted mb-3 tracking-wider">SUPPLY STATUS</h3>
        <div className="flex flex-col gap-2.5">
          {[
            { label: 'Water', value: 70, color: 'var(--blue)' },
            { label: 'Food', value: 45, color: 'var(--green)' },
            { label: 'Medical', value: 30, color: 'var(--red)' },
            { label: 'People', value: 85, color: 'var(--amber)' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-[10px] text-text-secondary w-12">{item.label}</span>
              <ProgressBar value={item.value} max={100} color={item.color} />
              <span className="text-[10px] text-muted w-8 text-right">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day Timeline */}
      <div className="p-4 border-b border-border">
        <h3 className="text-[10px] text-muted mb-3 tracking-wider">DAY TIMELINE</h3>
        <div className="flex flex-col gap-1.5 text-[10px]">
          {[
            { time: '06:00', event: 'Water check', done: true },
            { time: '08:00', event: 'Shelter inspection', done: true },
            { time: '10:00', event: 'Signal for rescue', done: false },
            { time: '12:00', event: 'Ration food supply', done: false },
            { time: '15:00', event: 'Mesh network check', done: false },
            { time: '21:00', event: 'Rest / recovery', done: false },
          ].map((item) => (
            <div key={item.time} className="flex items-center gap-2">
              <span className="text-muted w-10">{item.time}</span>
              <span className={item.done ? 'text-green-dim line-through' : 'text-foreground'}>
                {item.event}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Distraction Corner */}
      <div className="p-4 border-b border-border">
        <h3 className="text-[10px] text-muted mb-2 tracking-wider">DISTRACTION CORNER</h3>
        <p className="text-[11px] text-text-secondary leading-relaxed">
          Honey never spoils. Archaeologists found 3,000-year-old honey in Egyptian tombs that was still edible.
        </p>
        <button className="mt-2 text-[10px] text-green hover:text-green-bright transition-colors">
          [refresh]
        </button>
      </div>

      {/* Connectivity */}
      <div className="p-4 border-b border-border">
        <h3 className="text-[10px] text-muted mb-2 tracking-wider">CONNECTIVITY</h3>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={isOnline ? 'text-green' : 'text-red'}>
            {isOnline ? '●' : '○'}
          </span>
          <span className={isOnline ? 'text-green' : 'text-red'}>
            {isOnline ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
        {!isOnline && (
          <p className="text-[10px] text-muted mt-1">Using cached data. Some features unavailable.</p>
        )}
      </div>

      {/* BitChat Summary */}
      <div className="p-4">
        <h3 className="text-[10px] text-muted mb-2 tracking-wider">BITCHAT SUMMARY</h3>
        <div className="text-[10px] text-text-secondary flex flex-col gap-1">
          <div>12 nearby devices</div>
          <div>3 active groups</div>
          <div className="text-text-amber">1 SOS alert active</div>
        </div>
      </div>
    </div>
  );
}
