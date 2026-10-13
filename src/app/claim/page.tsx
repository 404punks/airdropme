import { ClaimClient } from "@/components/claim-client";
import { config } from "@/server/config";
import { getStore } from "@/server/db";

const steps = [
  ["Step 1 — Check Your Eligibility", "Enter your Pump.fun username or wallet address to check your PTS and review your eligibility status."],
  ["Step 2 — Connect Your Wallet", "Connect a supported Solana wallet to verify the wallet address associated with your claim. Make sure you select the correct wallet."],
  ["Step 3 — Review Your Claim", "If you are eligible and claiming is open, review the available claim details, including the token, amount, and destination wallet, before continuing."],
  ["Step 4 — Confirm Your Claim", "Approve the transaction in your wallet only after reviewing the transaction details. Never share your recovery phrase or private keys."],
  ["Step 5 — Check Your Claim Status", "Once the transaction is processed, check the claim status and transaction details. Processing times may vary depending on network conditions."],
];

export default async function ClaimPage() {
  const campaign = await getStore().getCampaign();
  const claimOpen = campaign.status === "claim_open";
  const allocation =
    campaign.funded && campaign.totalAllocation
      ? `${campaign.totalAllocation} ${campaign.tokenSymbol ?? ""}`.trim()
      : null;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-line bg-panel p-5 shadow-card sm:p-8">
        <p className="text-sm font-medium text-blue">Airdrop</p>
        <h1 className="mt-3 font-display text-4xl font-semibold">Claim Your Airdrop</h1>
        <p className="mt-4 max-w-2xl text-mute">
          Check your eligibility, connect your Solana wallet, and follow the instructions to claim your rewards when
          claiming is available.
        </p>
        <div className="mt-6 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          {claimOpen
            ? "Claiming is open. Token distribution still depends on a configured distributor."
            : "Claim coming soon. Wallet connection and claim submission stay closed until the campaign is open."}
        </div>
      </section>

      <ol className="space-y-3">
        {steps.map(([title, copy]) => (
          <li key={title} className="rounded-3xl border border-line bg-navy p-5">
            <h2 className="font-display text-lg">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-mute">{copy}</p>
          </li>
        ))}
      </ol>

      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-xl">Claim details</h2>
        {allocation ? (
          <p className="mt-3 text-sm text-mute">
            Configured allocation: {allocation}. This is shown because an administrator marked the campaign as funded.
          </p>
        ) : (
          <p className="mt-3 text-sm text-mute">
            No claim amount or token is available yet. Nothing on this page is a confirmed airdrop payment.
          </p>
        )}
        <p className="mt-3 text-sm text-mute">
          A claim can be registered only when the campaign is open, the account meets {campaign.minPoints.toLocaleString("en-US")} PTS,
          the profile is not excluded, and the connected wallet matches the public Pump.fun wallet.
        </p>
        {claimOpen ? (
          <div className="mt-5">
            <ClaimClient rpcUrl={config.SOLANA_RPC_URL} distributionEnabled={config.distributionEnabled} />
          </div>
        ) : (
          <p className="mt-5 text-sm text-mist">Claim coming soon. You can check PTS without connecting a wallet.</p>
        )}
      </section>
    </div>
  );
}
