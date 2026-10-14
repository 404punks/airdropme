import { explainFormula } from "@/server/points/calculate";
import { getStore } from "@/server/db";

const faqs = [
  ["Do I need a wallet to check PTS?", "No. Enter a public Pump.fun username or Solana address. A wallet is used only on the claim page, and only when claiming is open."],
  ["Why are some numbers unavailable?", "Pump.fun does not publish every field without authentication. Unavailable fields are not scored and are not treated as zero."],
  ["Do likes and reposts come from a live total?", "Callouts created come from the public all-time total. Likes and reposts are sums of the public Callout list, with duplicate Callouts removed. An incomplete page walk is not scored."],
  ["What about retweets?", "The public Callout data includes reposts, not a separate retweet count. Retweets stay unavailable."],
  ["Does refreshing add PTS again?", "No. The score is replaced using the current cumulative totals."],
  ["Does a claim send tokens?", "Not right now. Claiming is not open, and no token distribution is configured. A future claim signature would register a request. It would not send tokens unless a funded distributor is added."],
];

export default async function HowItWorksPage() {
  const settings = await getStore().getSettings();
  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl font-semibold">How It Works</h1>
        <p className="mt-4 max-w-2xl text-mute">
          Ansemmas PTS reads public Pump.fun statistics, calculates a score, and will open claiming only when the
          campaign is actually ready.
        </p>
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {[
          ["1. Enter an account", "Use a Pump.fun username, with or without @, or a Solana wallet address."],
          ["2. Review public data", "The server requests the profile, follower count, and Callout statistics from fixed Pump.fun paths."],
          ["3. See your PTS", "Each verified total is scored once. A refresh replaces the previous score."],
        ].map(([title, copy]) => (
          <li key={title} className="rounded-3xl border border-line bg-panel p-5">
            <h2 className="font-display text-xl">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-mute">{copy}</p>
          </li>
        ))}
      </ol>
      <section className="rounded-3xl border border-line bg-navy p-5 sm:p-6">
        <h2 className="font-display text-2xl">Point rules</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {explainFormula(settings).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section id="faq" className="space-y-3">
        <h2 className="font-display text-2xl">Questions</h2>
        {faqs.map(([question, answer]) => (
          <details key={question} className="rounded-3xl border border-line bg-panel p-4">
            <summary className="cursor-pointer font-medium">{question}</summary>
            <p className="mt-2 text-sm leading-6 text-mute">{answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
