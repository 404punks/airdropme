import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { explainFormula } from "@/server/points/calculate";
import { getStore } from "@/server/db";

export default async function HomePage() {
  const store = getStore();
  const [settings, campaign] = await Promise.all([store.getSettings(), store.getCampaign()]);
  return (
    <div className="space-y-12">
      <section className="grid items-end gap-8 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <Badge tone="live">Public stats only</Badge>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-6xl">
            Pump.fun scores without connecting a wallet.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-mute">
            Submit a public profile URL or Solana address. AirdropMe reads the Pump.fun fields that are actually
            available, stores a snapshot, and ranks verified activity. A wallet signature is required only when you
            register an airdrop claim.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/submit">Submit a profile</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/leaderboard">View leaderboard</Link>
            </Button>
          </div>
        </div>
        <aside className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-sm text-mute">Campaign</p>
          <h2 className="mt-1 font-display text-2xl">{campaign.name}</h2>
          <p className="mt-3 text-sm uppercase tracking-wide text-acid">{campaign.status.replaceAll("_", " ")}</p>
          <p className="mt-3 text-sm text-mute">{campaign.description}</p>
          <p className="mt-4 text-sm">
            Allocation:{" "}
            {campaign.funded && campaign.totalAllocation
              ? `${campaign.totalAllocation} ${campaign.tokenSymbol ?? ""}`.trim()
              : "Not configured"}
          </p>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["1. Identify", "Paste a pump.fun profile URL or the public wallet the API can resolve. Nothing is signed."],
          ["2. Verify", "The server requests public follower and Callout data. Missing fields stay Unavailable."],
          ["3. Rank", "Points are recomputed from the current totals. Refreshing does not add the same activity twice."],
        ].map(([title, copy]) => (
          <article key={title} className="rounded-3xl border border-line bg-navy p-5">
            <h2 className="font-display text-xl">{title}</h2>
            <p className="mt-2 text-sm text-mute">{copy}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">How points are calculated</h2>
        <p className="mt-2 text-sm text-mute">Formula version {settings.formulaVersion}. These weights are configuration, not a market quote.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {explainFormula(settings).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
