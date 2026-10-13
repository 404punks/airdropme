import { Countdown } from "@/components/countdown";
import { explainFormula } from "@/server/points/calculate";
import { getStore } from "@/server/db";
import { formatWhen } from "@/lib/utils";

export default async function CampaignPage() {
  const store = getStore();
  const [campaign, settings] = await Promise.all([store.getCampaign(), store.getSettings()]);
  const countdownTarget =
    campaign.status === "upcoming"
      ? campaign.startsAt
      : campaign.status === "claim_open"
        ? campaign.claimEndsAt
        : campaign.endsAt;
  const allocation =
    campaign.funded && campaign.totalAllocation
      ? `${campaign.totalAllocation} ${campaign.tokenSymbol ?? ""}`.trim()
      : null;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-acid">{campaign.status.replaceAll("_", " ")}</p>
        <h1 className="font-display text-4xl">{campaign.name}</h1>
        <p className="mt-3 max-w-3xl text-mute">{campaign.description}</p>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-line bg-panel p-5">
          <h2 className="text-sm text-mute">Countdown</h2>
          <Countdown target={countdownTarget} />
          <dl className="mt-4 space-y-1 text-sm text-mute">
            <div>Starts: {formatWhen(campaign.startsAt)}</div>
            <div>Ends: {formatWhen(campaign.endsAt)}</div>
            <div>Claim window: {formatWhen(campaign.claimStartsAt)} – {formatWhen(campaign.claimEndsAt)}</div>
          </dl>
        </article>
        <article className="rounded-3xl border border-line bg-panel p-5">
          <h2 className="font-display text-xl">Allocation</h2>
          <p className="mt-3 text-2xl">{allocation ?? "Not configured"}</p>
          <p className="mt-2 text-sm text-mute">
            {allocation
              ? "This amount is shown because an administrator marked the campaign funded and entered an allocation."
              : "No funded allocation is configured. Nothing on this page is a guaranteed airdrop amount."}
          </p>
        </article>
      </section>
      <section className="rounded-3xl border border-line bg-navy p-5">
        <h2 className="font-display text-xl">Eligibility</h2>
        <ul className="mt-3 space-y-2 text-sm text-mute">
          <li>At least {campaign.minPoints.toLocaleString()} points from verified statistics.</li>
          <li>Profile is not flagged or banned.</li>
          <li>Claim wallet matches the canonical Solana wallet returned by Pump.fun for that profile.</li>
          <li>Campaign status is Claim Open.</li>
          <li>One registration per profile and per wallet.</li>
          <li>
            Distribution: {campaign.distributionEnabled ? "enabled by campaign settings" : "not enabled"}. A
            registration record is not a completed token transfer.
          </li>
        </ul>
      </section>
      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-xl">Point rules</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {explainFormula(settings).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
