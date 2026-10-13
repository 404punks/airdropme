import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="font-display text-4xl">Not found</h1>
      <p className="text-mute">That page or profile is not available.</p>
      <Link className="text-acid" href="/submit">
        Submit a profile
      </Link>
    </div>
  );
}
