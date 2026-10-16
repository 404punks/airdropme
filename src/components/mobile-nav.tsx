"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, House, Info, Search, Users } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: House, match: (path: string) => path === "/" },
  { href: "/#check", label: "Check", icon: Search, match: (path: string) => path === "/submit" || path.startsWith("/p/") },
  { href: "/referrals", label: "Refer", icon: Users, match: (path: string) => path.startsWith("/referrals") || path.startsWith("/r/") },
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
      <ul className="grid grid-cols-6">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] ${active ? "text-blue" : "text-mute"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <a
            href="https://x.com/calloutdrop"
            target="_blank"
            rel="noreferrer"
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] text-mute"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            X
          </a>
        </li>
      </ul>
    </nav>
  );
}
