import { UsdcInline } from "@/components/usdc-amount";
import { explainFormula } from "@/server/points/calculate";
import { getStore } from "@/server/db";

const faqs = [
  ["Do I need a wallet to check?", "Yes. Follow Callout Drop on X and open the like and repost step, then connect a Solana wallet with WalletConnect, Phantom, or Solflare. Chrome and wallet apps can connect. Checking uses that public address and does not ask for a seed phrase or a signature. A signature is used only on the claim page, and only when claiming is open."],
  ["Why are some numbers unavailable?", "Pump.fun does not publish every field without authentication. Unavailable fields are not scored and are not treated as zero."],
  ["Do likes and reposts come from a live total?", "Callouts created come from the public all-time total. Likes and reposts are sums of the public Callout list, with duplicate Callouts removed. An incomplete page walk is not scored."],
  ["What about retweets?", "The public Callout data includes reposts, not a separate retweet count. Retweets stay unavailable."],
  ["Does refreshing add PTS again?", "No. The score is replaced using the current cumulative totals."],
  ["Does a claim send tokens?", "Not right now. Claiming is not open, and no token distribution is configured. A future claim signature would register a request. It would not send tokens unless a funded distributor is added."],
  ["How do referrals work?", "After your Pump.fun profile and wallet address are connected, your referral link is https://www.calloutdrop.app/r/ plus your username. When a new account joins from that link, you receive 170 PTS and they receive 170 PTS. The referral link and history are stored with the Firebase API and are not deleted. Refreshing the page, or disconnecting and connecting the wallet again, keeps the same referral link."],
];

export default async function HowItWorksPage() {
  const settings = await getStore().getSettings();
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">How It Works</h1>
        <p className="mt-4 max-w-2xl text-mute">
          Callout Drop reads public Pump.fun statistics, calculates a score, and will open claiming only when the
          campaign is actually ready.
        </p>
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {[
          ["1. Follow and connect", "Follow Callout Drop on X, like and repost, then connect a Solana wallet with WalletConnect, Phantom, or Solflare. The check uses that public address."],
          ["2. Review public data", "The server requests the profile, follower count, and Callout statistics from fixed Pump.fun paths."],
          ["3. See your USDC", "Each verified total is scored at the USDC rate. A refresh replaces the previous total."],
        ].map(([title, copy]) => (
          <li key={title} className="rounded-none border border-line bg-panel p-5">
            <h2 className="font-display text-xl"><UsdcInline text={title} /></h2>
            <p className="mt-2 text-sm leading-6 text-mute"><UsdcInline text={copy} /></p>
          </li>
        ))}
      </ol>
      <section className="rounded-none border border-line bg-navy p-5 sm:p-6">
        <h2 className="font-display text-2xl"><UsdcInline text="USDC rates" /></h2>
        <ul className="mt-4 space-y-2 text-sm">
          {explainFormula(settings).map((line) => (
            <li key={line}><UsdcInline text={line} /></li>
          ))}
        </ul>
      </section>
      <section id="faq" className="space-y-3">
        <h2 className="font-display text-2xl">Questions</h2>
        {faqs.map(([question, answer]) => (
          <details key={question} className="rounded-none border border-line bg-panel p-4">
            <summary className="cursor-pointer font-medium">{question}</summary>
            <p className="mt-2 text-sm leading-6 text-mute">{answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
