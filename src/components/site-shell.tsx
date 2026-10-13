import Link from "next/link";
import { config } from "@/server/config";
import { getStore } from "@/server/db";

const links = [
  ["Submit", "/submit"],
  ["Leaderboard", "/leaderboard"],
  ["Campaign", "/campaign"],
  ["Claim", "/claim"],
  ["Data sources", "/data-sources"],
  ["FAQ", "/faq"],
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const store = getStore();
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-5 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line/80 bg-navy/80 px-4 py-3 backdrop-blur">
        <Link href="/" className="font-display text-lg font-bold tracking-tight">
          Airdrop<span className="text-acid">Me</span>
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-mute" aria-label="Primary">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {config.PUMPFUN_DATA_MODE === "demo" ? (
        <p className="mb-4 rounded-2xl border border-violet/40 bg-violet/10 px-4 py-3 text-sm text-violet">
          DEMO mode is on. Figures on this instance are fixtures, not live Pump.fun data.
        </p>
      ) : null}
      {store.kind === "memory" ? (
        <p className="mb-4 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          DATABASE_URL is not set, so this server does not keep a shared leaderboard. Profile pages still load public
          Pump.fun statistics directly.
        </p>
      ) : null}
      <main className="flex-1">{children}</main>
      <footer className="mt-16 border-t border-line pt-6 text-sm text-mute">
        <p>
          Points are a campaign score based on public statistics. They are not a promise of tokens, price, or
          financial return. Wallet connection is used only for claim registration.
        </p>
      </footer>
    </div>
  );
}
