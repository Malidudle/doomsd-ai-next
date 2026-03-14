'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import RightPanel from './RightPanel';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Breathe page is a full-screen overlay — no shell
  if (pathname === '/breathe') {
    return <>{children}</>;
  }

  // Map page doesn't show right panel (has its own overlay controls)
  const showRightPanel = pathname !== '/map';

  return (
    <div className="scanlines flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="flex md:hidden items-center gap-3 border-b border-border bg-surface px-4 py-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-green text-sm font-bold"
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="text-green text-xs font-bold crt-glow tracking-wider">DoomsAI</span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
          {showRightPanel && <RightPanel />}
        </div>
      </div>
    </div>
  );
}
