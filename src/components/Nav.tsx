"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function Nav() {
  const pathname = usePathname();
  const { isOnline } = useOnlineStatus();

  const tabs = [
    { href: "/", label: "#chat" },
    { href: "/map", label: "#map" },
  ];

  return (
    <nav className="flex items-center justify-between text-[11px] border-b border-border bg-surface px-4 py-1 font-mono">
      <div className="flex gap-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${active ? "text-green" : "text-muted hover:text-foreground"}`}
            >
              [{tab.label}]
            </Link>
          );
        })}
      </div>
      <span className={isOnline ? "text-green" : "text-red"}>
        {isOnline ? "online" : "offline"}
      </span>
    </nav>
  );
}
