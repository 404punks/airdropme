import { cookies } from "next/headers";
import { CheckForm } from "@/components/check-form";
import { UsdcInline } from "@/components/usdc-amount";
import { explainFormula } from "@/server/points/calculate";
import { config } from "@/server/config";
import { getStore } from "@/server/db";
import { referrerFromCookieHeader } from "@/server/referrals/cookie";

export default async function HomePage() {
  const settings = await getStore().getSettings();
  const jar = await cookies();
  const invitedBy = referrerFromCookieHeader(jar.getAll().map((item) => `${item.name}=${item.value}`).join("; ")) ?? "";
  return (
    <div className="space-y-4 sm:space-y-6">
      <section id="check" className="border border-line bg-panel p-4 sm:p-6">
        <p className="text-xs font-medium text-blue">Callout Drop</p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">
          <UsdcInline text="Check Your USDC" />
        </h1>
        <p className="mt-4 max-w-2xl text-base text-mute sm:text-lg">
          Follow on X, then connect a Solana wallet. The check uses that address.
        </p>
        <div className="mt-5">
          <CheckForm invitedBy={invitedBy} rpcUrl={config.SOLANA_RPC_URL} projectId={config.walletConnectProjectId} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Follow", "Follow Callout Drop on X, then like and repost. Both buttons open the next step."],
          ["Connect", "Connect with WalletConnect, Phantom, or Solflare. Chrome and wallet apps can connect. Checking uses the public address and does not ask for a seed phrase."],
          ["Claim later", "Claiming is not open yet. The claim button stays inactive."],
        ].map(([title, copy]) => (
          <article key={title} className="flex aspect-square flex-col justify-between border border-line bg-navy p-4 sm:aspect-auto sm:min-h-40">
            <h2 className="font-display text-xl">{title}</h2>
            <p className="text-sm leading-5 text-mute">{copy}</p>
          </article>
        ))}
      </section>

      <section className="rounded-none border border-line bg-navy p-5 sm:p-6">
        <h2 className="font-display text-2xl"><UsdcInline text="How USDC is calculated" /></h2>
        <p className="mt-2 text-sm text-mute">Formula version {settings.formulaVersion}. Rates apply to verified public totals.</p>
        <ul className="mt-4 space-y-2 text-sm text-mist">
          {explainFormula(settings).map((line) => (
            <li key={line}><UsdcInline text={line} /></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
