const faqs = [
  ["Do I need a wallet to earn points?", "No. Submit a public profile URL or wallet address. Points come from stored, verified statistics."],
  ["Why are some numbers Unavailable?", "Pump.fun does not publish every requested field without authentication. This app does not invent a zero for those fields."],
  ["Are likes and reposts live totals?", "Callout count comes from allTime.totalCallouts. Likes and reposts are sums of the public Callout list, deduped by Callout id. If the page walk is incomplete, those metrics are not scored."],
  ["What about retweets?", "The verified Callout payload has repostCount, not a retweet count. Retweets are shown as Unavailable."],
  ["Does refreshing add points again?", "No. The score is replaced by a new calculation from the current cumulative totals."],
  ["Does a claim send tokens?", "Only if a verified distributor is configured and funded. By default the flow stores a registration and does not broadcast a transfer."],
  ["Can any wallet claim a profile?", "No. The signed wallet must match the canonical wallet on the Pump.fun profile, the profile must meet the points rule, and the claim must be open."],
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-4xl">FAQ</h1>
      {faqs.map(([question, answer]) => (
        <details key={question} className="rounded-3xl border border-line bg-panel p-4" open>
          <summary className="cursor-pointer font-semibold">{question}</summary>
          <p className="mt-2 text-sm text-mute">{answer}</p>
        </details>
      ))}
    </div>
  );
}
