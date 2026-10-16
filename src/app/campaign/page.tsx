import { UsdcAmount, UsdcInline } from "@/components/usdc-amount";
import { explainFormula } from "@/server/points/calculate";
import { getStore } from "@/server/db";
import { formatWhen } from "@/lib/utils";

export default async function CampaignPage() {
  const store = getStore();
  const [campaign, settings] = await Promise.all([store.getCampaign(), store.getSettings()]);
  const allocation =
    campaign.funded && campaign.totalAllocation
      ? `${campaign.totalAllocation} ${campaign.tokenSymbol ?? ""}`.trim()
      : null;
  const claimOpen = campaign.status === "claim_open";
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-blue">{claimOpen ? "Claiming is open" : "Claim coming soon"}</p>
        <h1 className="mt-2 font-display text-4xl">{campaign.name}</h1>
        <p className="mt-3 max-w-3xl text-mute">
          <UsdcInline text={campaign.description.replaceAll("PTS", "USDC")} />
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-none border border-line bg-panel p-5">
          <h2 className="font-display text-xl">Schedule</h2>
          <dl className="mt-4 space-y-1 text-sm text-mute">
            <div>Starts: {formatWhen(campaign.startsAt)}</div>
            <div>Ends: {formatWhen(campaign.endsAt)}</div>
            <div>
              Claim window: {formatWhen(campaign.claimStartsAt)} – {formatWhen(campaign.claimEndsAt)}
            </div>
          </dl>
        </article>
        <article className="rounded-none border border-line bg-panel p-5">
          <h2 className="font-display text-xl">Allocation</h2>
          <p className="mt-3 text-2xl">{allocation ?? "Not configured"}</p>
          <p className="mt-2 text-sm text-mute">
            {allocation
              ? "This amount is shown because an administrator marked the campaign as funded."
              : "No funded allocation is configured. This page does not promise an airdrop amount."}
          </p>
        </article>
      </section>
      <section className="rounded-none border border-line bg-navy p-5">
        <h2 className="font-display text-xl">Claim rules</h2>
        <ul className="mt-3 space-y-2 text-sm text-mute">
          <li>At least <UsdcAmount points={campaign.minPoints} markClassName="h-3.5 w-3.5" /> from verified statistics.</li>
          <li>The profile is not flagged or banned.</li>
          <li>The claim wallet matches the canonical Solana wallet published for that Pump.fun profile.</li>
          <li>Campaign status is claim open.</li>
          <li>One registration per profile and per wallet.</li>
          <li>
            Distribution is {campaign.distributionEnabled ? "enabled in campaign settings" : "not enabled"}. A registration
            record is not a completed token transfer.
          </li>
        </ul>
      </section>
      <section className="rounded-none border border-line bg-panel p-5">
        <h2 className="font-display text-xl"><UsdcInline text="USDC rates" /></h2>
        <ul className="mt-3 space-y-2 text-sm">
          {explainFormula(settings).map((line) => (
            <li key={line}><UsdcInline text={line} /></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
