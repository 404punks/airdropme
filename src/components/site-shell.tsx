import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { UsdcInline } from "@/components/usdc-amount";
import { config } from "@/server/config";
import { getStore } from "@/server/db";

const links = [
  ["Home", "/"],
  ["Check Your USDC", "/#check"],
  ["Referrals", "/referrals"],
  ["Airdrop Claim", "/claim"],
  ["How It Works", "/how-it-works"],
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const store = getStore();
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
            Callout Drop
          </Link>
          <nav className="hidden gap-5 text-sm text-mute md:flex" aria-label="Primary">
            {links.map(([label, href]) => (
              <Link key={href} href={href} className="hover:text-white">
                {label.includes("USDC") ? <UsdcInline text={label} /> : label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="flex flex-1 flex-col px-4 pb-24 pt-4 sm:px-6 md:pb-12 md:pt-6">
        {config.PUMPFUN_DATA_MODE === "demo" ? (
          <p className="mb-4 border border-violet/30 bg-violet/10 px-3 py-2 text-sm text-violet">
            Demo mode is on. The figures on this server are sample data, not live Pump.fun statistics.
          </p>
        ) : null}
        <main className="flex-1">{children}</main>
        <footer className="mt-10 space-y-3 border-t border-line pt-5 text-xs leading-5 text-mute sm:text-sm">
          <p>
            <UsdcInline text="USDC is calculated from public Pump.fun statistics. It is not a promise of tokens, price, or a completed airdrop. Checking connects a Solana wallet and reads only the public address. A signature is requested only when claiming is open." />
          </p>
          {store.kind === "memory" ? (
            <p>This server is not using a shared database. Profile checks still use public Pump.fun data.</p>
          ) : null}
          <p className="flex flex-wrap gap-4">
            <Link className="hover:text-white" href="/referrals">
              Referrals
            </Link>
            <Link className="hover:text-white" href="/how-it-works">
              How it works
            </Link>
            <Link className="hover:text-white" href="/data-sources">
              Data sources
            </Link>
          </p>
        </footer>
      </div>
      <MobileNav />
    </div>
  );
}
