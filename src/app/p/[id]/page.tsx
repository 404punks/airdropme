import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PtsResults } from "@/components/pts-results";
import { getStore } from "@/server/db";
import { getProvider } from "@/server/pumpfun";
import { referrerFromCookieHeader } from "@/server/referrals/cookie";
import { originFromHeaders } from "@/server/referrals/logic";
import { presentReferralHistory } from "@/server/referrals/logic";
import { getReferralRepository, loadReferralState, publishReferralLink, referralRewardPoints, summaryFor } from "@/server/referrals/service";
import { ipFromHeaders } from "@/server/security/ip";
import { profileReferralLink, ServiceError, viewProfile } from "@/server/services/profiles";

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
  const origin = originFromHeaders(headerList);
  let view;
  try {
    view = await viewProfile(getStore(), id, {
      provider: getProvider(),
      ip: ipFromHeaders(headerList),
      referrerUsername: referrerFromCookieHeader(headerList.get("cookie")),
      origin,
    });
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
  const referral = {
    link: view.user.username && view.user.canonicalWallet ? profileReferralLink(view.user.username, origin) : null,
    points: 0,
    made: 0,
    joined: 0,
    history: [] as Awaited<ReturnType<typeof loadReferralState>>["history"],
    unavailable: false,
  };
  const referrals = getReferralRepository();
  if (!referrals) referral.unavailable = Boolean(view.user.username && view.user.canonicalWallet);
  else if (view.user.username && view.user.canonicalWallet) {
    try {
      await publishReferralLink(referrals, {
        username: view.user.username,
        profileImage: view.user.profileImage,
        origin,
      });
      const state = await loadReferralState(referrals);
      const rewards = await referralRewardPoints(state.history.map((row) => row.referredUsername));
      const history = presentReferralHistory(state.history, rewards);
      const summary = summaryFor(view.user.username, history);
      referral.points = summary.points;
      referral.made = summary.made;
      referral.joined = summary.joined;
      referral.history = summary.history;
    } catch {
      referral.unavailable = true;
    }
  }
  return (
    <PtsResults
      user={view.user}
      snapshot={view.snapshot}
      callouts={view.callouts}
      freshness={view.freshness}
      notice={query.notice}
      campaign={campaign}
      referral={referral}
    />
  );
}
