import { SubmitForm } from "@/components/submit-form";

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-4xl">Submit a profile</h1>
        <p className="mt-3 text-mute">
          Accepted inputs are a https://pump.fun/profile/… URL, a Pump.fun username, or a Solana address. The server
          never fetches a URL you type. It only calls fixed Pump.fun API paths after validating the identifier.
        </p>
      </div>
      <div className="rounded-3xl border border-line bg-panel p-5">
        <SubmitForm />
      </div>
      <ul className="space-y-2 text-sm text-mute">
        <li>A wallet address is not treated as a profile until the API returns that Pump.fun user.</li>
        <li>If a statistic cannot be verified, the dashboard shows Unavailable and awards no points for it.</li>
        <li>Duplicate submissions update the same profile. They do not create a second score.</li>
      </ul>
    </div>
  );
}
