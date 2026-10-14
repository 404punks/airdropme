import Link from "next/link";
import { config } from "@/server/config";
import { getStore } from "@/server/db";

const links = [
  ["Home", "/"],
  ["Check Your PTS", "/#check"],
  ["Airdrop Claim", "/claim"],
  ["How It Works", "/how-it-works"],
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const store = getStore();
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-16 pt-5 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-navy/90 px-4 py-3 shadow-card">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          Ansemmas <span className="text-blue">PTS</span>
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-mute" aria-label="Primary">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-full px-1 py-1 hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {config.PUMPFUN_DATA_MODE === "demo" ? (
        <p className="mb-6 rounded-2xl border border-violet/30 bg-violet/10 px-4 py-3 text-sm text-violet">
          Demo mode is on. The figures on this server are sample data, not live Pump.fun statistics.
        </p>
      ) : null}
      <main className="flex-1">{children}</main>
      <footer className="mt-16 space-y-3 border-t border-line pt-6 text-sm text-mute">
        <p>
          PTS are calculated from public Pump.fun statistics. They are not a promise of tokens, price, or a completed
          airdrop. A wallet is required only when claiming is open.
        </p>
        {store.kind === "memory" ? (
          <p>This server is not using a shared database. Profile checks still use public Pump.fun data.</p>
        ) : null}
        <p className="flex flex-wrap gap-4">
          <Link className="hover:text-white" href="/how-it-works">
            How it works
          </Link>
          <Link className="hover:text-white" href="/data-sources">
            Data sources
          </Link>
        </p>
      </footer>
    </div>
  );
}
