import { CheckForm } from "@/components/check-form";
import { explainFormula } from "@/server/points/calculate";
import { getStore } from "@/server/db";

export default async function HomePage() {
  const settings = await getStore().getSettings();
  return (
    <div className="space-y-14">
      <section id="check" className="rounded-3xl border border-line bg-panel p-5 shadow-card sm:p-8">
        <p className="text-sm font-medium text-blue">Ansemmas PTS</p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">Check Your PTS</h1>
        <p className="mt-4 max-w-2xl text-base text-mute sm:text-lg">
          Check your points and airdrop eligibility using your Pump.fun username or wallet address.
        </p>
        <div className="mt-8">
          <CheckForm />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Check", "Enter a public username or Solana address. No wallet connection is required."],
          ["Review", "See PTS from the public statistics Pump.fun currently returns. Missing fields stay unavailable."],
          ["Claim later", "Claiming is not open yet. You can review the steps before a wallet is needed."],
        ].map(([title, copy]) => (
          <article key={title} className="rounded-3xl border border-line bg-navy p-5">
            <h2 className="font-display text-xl">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-mute">{copy}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-line bg-navy p-5 sm:p-6">
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
