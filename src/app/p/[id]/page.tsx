import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PtsResults } from "@/components/pts-results";
import { getStore } from "@/server/db";
import { getProvider } from "@/server/pumpfun";
import { ipFromHeaders } from "@/server/security/ip";
import { ServiceError, viewProfile } from "@/server/services/profiles";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const headerList = await headers();
  let view;
  try {
    view = await viewProfile(getStore(), id, { provider: getProvider(), ip: ipFromHeaders(headerList) });
  } catch (error) {
    if (error instanceof ServiceError && (error.code === "not_found" || error.code === "not_profile")) notFound();
    if (error instanceof ServiceError && error.code === "rate_limit") {
      return (
        <div className="space-y-3">
          <h1 className="font-display text-4xl">Please wait</h1>
          <p className="text-mute">{error.message}</p>
          <Link className="text-blue" href="/#check">
            Check Another Account
          </Link>
        </div>
      );
    }
    if (error instanceof ServiceError && error.code === "upstream") {
      return (
        <div className="space-y-3">
          <h1 className="font-display text-4xl">Points unavailable</h1>
          <p className="text-mute">Unable to retrieve your points right now. Please try again.</p>
          <Link className="text-blue" href="/#check">
            Check Another Account
          </Link>
        </div>
      );
    }
    throw error;
  }
  const campaign = await getStore().getCampaign();
  return (
    <PtsResults
      user={view.user}
      snapshot={view.snapshot}
      callouts={view.callouts}
      freshness={view.freshness}
      notice={query.notice}
      campaign={campaign}
    />
  );
}
