import { CheckForm } from "@/components/check-form";

export default function SubmitPage() {
  return (
    <section className="mx-auto max-w-3xl rounded-none border border-line bg-panel p-5 shadow-card sm:p-8">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Check Your PTS</h1>
      <p className="mt-4 text-mute">
        Check your points and airdrop eligibility using your Pump.fun username or wallet address.
      </p>
      <div className="mt-8">
        <CheckForm />
      </div>
    </section>
  );
}
