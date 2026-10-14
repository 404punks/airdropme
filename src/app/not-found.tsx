import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="font-display text-4xl">Not found</h1>
      <p className="text-mute">We couldn&apos;t find this profile. Please check the username and try again.</p>
      <Link className="text-blue" href="/#check">
        Check Eligibility
      </Link>
    </div>
  );
}
