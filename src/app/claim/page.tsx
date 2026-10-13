import { ClaimClient } from "@/components/claim-client";
import { config } from "@/server/config";
import { getStore } from "@/server/db";

export default async function ClaimPage() {
  const campaign = await getStore().getCampaign();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-4xl">Claim registration</h1>
        <p className="mt-3 text-mute">
          Connect Phantom or Solflare only when you want to register a claim. The signature proves you control that
          wallet. It does not, by itself, prove you control the Pump.fun profile. This app also checks that the
          wallet equals the canonical wallet Pump.fun published for the profile.
        </p>
      </div>
      <div className="rounded-3xl border border-warn/30 bg-warn/10 p-4 text-sm text-warn">
        Never share a seed phrase or private key. This site will not ask you to send SOL or tokens to claim. Status:{" "}
        {campaign.status.replaceAll("_", " ")}. Distribution is {config.distributionEnabled ? "flagged on" : "off"}.
      </div>
      <div className="rounded-3xl border border-line bg-panel p-5">
        <ClaimClient rpcUrl={config.SOLANA_RPC_URL} />
      </div>
    </div>
  );
}
