"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, House, Info, Search } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: House, match: (path: string) => path === "/" },
  { href: "/#check", label: "Check", icon: Search, match: (path: string) => path === "/submit" || path.startsWith("/p/") },
  { href: "/claim", label: "Claim", icon: Gift, match: (path: string) => path.startsWith("/claim") },
  { href: "/how-it-works", label: "Guide", icon: Info, match: (path: string) => path.startsWith("/how-it-works") },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-blue" : "text-mute"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
