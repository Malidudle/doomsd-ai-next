'use client';

import MeshPanel from '@/components/MeshPanel';

export default function MeshPage() {
  return (
    <div className="flex flex-col h-full crt-glow">
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3">
        <h1 className="text-green text-lg font-bold tracking-wider">BITCHAT MESH</h1>
        <p className="text-muted text-[11px] mt-1">
          &gt; LOCAL BLUETOOTH MESH NETWORK
        </p>
      </div>
      <div className="flex-1 px-4 md:px-6 pb-6 overflow-hidden">
        <MeshPanel />
      </div>
    </div>
  );
}
