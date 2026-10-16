import { CheckForm } from "@/components/check-form";
import { UsdcInline } from "@/components/usdc-amount";
import { config } from "@/server/config";

export default function SubmitPage() {
  return (
    <section className="mx-auto max-w-3xl rounded-none border border-line bg-panel p-5 shadow-card sm:p-8">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl"><UsdcInline text="Check Your USDC" /></h1>
      <p className="mt-4 text-mute">Follow on X, then connect a Solana wallet. The check uses that address.</p>
      <div className="mt-8">
        <CheckForm rpcUrl={config.SOLANA_RPC_URL} projectId={config.walletConnectProjectId} />
      </div>
    </section>
  );
}
