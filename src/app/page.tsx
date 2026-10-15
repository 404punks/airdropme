import { cookies } from "next/headers";
import { CheckForm } from "@/components/check-form";
import { explainFormula } from "@/server/points/calculate";
import { getStore } from "@/server/db";
import { referrerFromCookieHeader } from "@/server/referrals/cookie";

export default async function HomePage() {
  const settings = await getStore().getSettings();
  const jar = await cookies();
  const invitedBy = referrerFromCookieHeader(jar.getAll().map((item) => `${item.name}=${item.value}`).join("; ")) ?? "";
  return (
    <div className="space-y-4 sm:space-y-6">
      <section id="check" className="border border-line bg-panel p-4 sm:p-6">
        <p className="text-xs font-medium text-blue">Ansemmas PTS</p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">Check Your PTS</h1>
        <p className="mt-4 max-w-2xl text-base text-mute sm:text-lg">
          Check your points and airdrop eligibility using your Pump.fun username or wallet address.
        </p>
        <div className="mt-5">
          <CheckForm invitedBy={invitedBy} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Check", "Enter a public username or Solana address. No wallet connection is required."],
          ["Review", "See PTS from the public statistics Pump.fun currently returns. Missing fields stay unavailable."],
          ["Claim later", "Claiming is not open yet. You can review the steps before a wallet is needed."],
        ].map(([title, copy]) => (
          <article key={title} className="flex aspect-square flex-col justify-between border border-line bg-navy p-4 sm:aspect-auto sm:min-h-40">
            <h2 className="font-display text-xl">{title}</h2>
            <p className="text-sm leading-5 text-mute">{copy}</p>
          </article>
        ))}
      </section>

      <section className="rounded-none border border-line bg-navy p-5 sm:p-6">
        <h2 className="font-display text-2xl">How PTS are calculated</h2>
        <p className="mt-2 text-sm text-mute">Formula version {settings.formulaVersion}. Weights are configuration, not a price.</p>
        <ul className="mt-4 space-y-2 text-sm text-mist">
          {explainFormula(settings).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
