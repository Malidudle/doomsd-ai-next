'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const NAV_ITEMS = [
  { href: '/', label: 'SOS', icon: '!' },
  { href: '/chat', label: 'CHAT', icon: '>' },
  { href: '/survive', label: 'SURVIVE', icon: '#' },
  { href: '/map', label: 'NEARBY', icon: '@' },
];

export default function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { isOnline } = useOnlineStatus();

  const sidebarContent = (
    <div className="flex h-full w-[220px] flex-col border-r border-border bg-background py-4">
      {/* Logo */}
      <Link href="/" className="px-5 mb-6 flex items-center gap-2" onClick={onClose}>
        <span className="text-green text-xl font-bold crt-glow">~</span>
        <span className="text-green font-bold text-sm tracking-wider crt-glow">DoomsAI</span>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 text-xs font-medium transition-colors rounded-sm ${
                active
                  ? 'bg-green text-background'
                  : 'text-muted hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              <span className="w-4 text-center font-bold">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Emergency buttons */}
      <div className="mt-6 px-3 flex flex-col gap-2">
        <button className="w-full border border-red bg-red/10 text-red py-2 text-xs font-bold tracking-wider hover:bg-red/20 transition-colors rounded-sm">
          SOS EMERGENCY
        </button>
        <Link
          href="/breathe"
          onClick={onClose}
          className={`w-full border text-center py-2 text-xs font-bold tracking-wider transition-colors rounded-sm ${
            pathname === '/breathe'
              ? 'border-green bg-green text-background'
              : 'border-green text-green hover:bg-green/10'
          }`}
        >
          BREATHE
        </Link>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom status */}
      <div className="px-4 py-3 border-t border-border text-[10px] text-muted flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className={isOnline ? 'text-green' : 'text-red'}>
            {isOnline ? '●' : '○'}
          </span>
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
        <div>BAT: 87%</div>
        <div>GPS: ACTIVE</div>
        <div>BT: 3 devices</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-[2000] md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <div className="relative h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
