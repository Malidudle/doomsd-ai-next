"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted font-mono text-xs crt-glow">
      loading map module...
    </div>
  ),
});

export default function MapPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Top Bar */}
      <header className="border-b border-border px-4 py-2.5 flex items-center gap-3">
        <h1 className="text-green text-xs font-bold tracking-wider crt-glow">NEARBY</h1>
        <div className="flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search places..."
            className="w-full bg-background border border-border text-[11px] px-3 py-1 text-foreground placeholder:text-muted/50 outline-none focus:border-border-green transition-colors"
          />
        </div>
      </header>
      <div className="flex-1">
        <MapView />
      </div>
    </div>
  );
}
