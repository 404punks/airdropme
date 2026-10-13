import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PointsChart } from "@/components/points-chart";
import { RefreshButton } from "@/components/refresh-button";
import { Badge } from "@/components/ui/badge";
import { publicProfileKey } from "@/lib/profile-key";
import { formatNumber, formatWhen, metricLabel, shortKey } from "@/lib/utils";
import { getStore } from "@/server/db";
import { getProvider } from "@/server/pumpfun";
import { ipFromHeaders } from "@/server/security/ip";
import { ServiceError, viewProfile } from "@/server/services/profiles";

const toneFor = {
  verified: "live",
  demo: "demo",
  unavailable: "unavailable",
  incomplete: "cached",
} as const;

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
          <h1 className="font-display text-4xl">Slow down</h1>
          <p className="text-mute">{error.message}</p>
        </div>
      );
    }
    throw error;
  }
  const { user, snapshot, rank, callouts, freshness } = view;
  const freshnessCopy = {
    recent: "Verified from Pump.fun during the latest fetch.",
    cached: "Cached snapshot. This page did not call Pump.fun again.",
    stale: "Stale cached snapshot. Refresh to request a newer read.",
    demo: "DEMO fixture. These numbers are not live Pump.fun data.",
    empty: "No snapshot stored.",
  }[freshness];
  const rows = snapshot
    ? [
        ["Followers", snapshot.followersStatus, snapshot.followers, snapshot.followersSource, snapshot.followersDetail],
        ["Callouts created", snapshot.calloutsStatus, snapshot.callouts, snapshot.calloutsSource, snapshot.calloutsDetail],
        ["Likes received", snapshot.likesStatus, snapshot.likes, snapshot.likesSource, snapshot.likesDetail],
        ["Reposts received", snapshot.repostsStatus, snapshot.reposts, snapshot.repostsSource, snapshot.repostsDetail],
        ["Retweets", "unavailable", null, "No Pump.fun retweet field", "Reposts are tracked separately. A distinct retweet count is unavailable."],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-mute">Profile statistics</p>
          <h1 className="font-display text-4xl">{user.username ?? "Unnamed profile"}</h1>
          <p className="mt-2 text-sm text-mute">
            {shortKey(user.canonicalWallet)} · Pump id {user.pumpUserId}
          </p>
          {user.canonicalWallet ? (
            <a className="text-sm text-violet" href={`https://pump.fun/profile/${user.username ?? user.canonicalWallet}`}>
              Open on Pump.fun
            </a>
          ) : null}
        </div>
        <RefreshButton profileKey={publicProfileKey(user)} />
      </div>
      {query.notice ? <p className="rounded-2xl border border-acid/30 bg-acid/10 px-4 py-3 text-sm">{query.notice}</p> : null}
      <p className="text-sm text-mute">{freshnessCopy}</p>
      {user.flagged ? (
        <p className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Excluded from the public leaderboard. {user.flagReason}
        </p>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Followers", snapshot?.followersStatus, snapshot?.followers],
          ["Callouts", snapshot?.calloutsStatus, snapshot?.callouts],
          ["Likes", snapshot?.likesStatus, snapshot?.likes],
          ["Reposts", snapshot?.repostsStatus, snapshot?.reposts],
        ].map(([label, status, value]) => (
          <article key={String(label)} className="rounded-3xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-mute">{label}</p>
              <Badge tone={toneFor[(status as keyof typeof toneFor) ?? "unavailable"]}>{String(status ?? "empty")}</Badge>
            </div>
            <p className="mt-3 font-display text-3xl">{metricLabel(String(status ?? "unavailable"), (value as number | null) ?? null)}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-line bg-panel p-5">
          <p className="text-sm text-mute">Total points</p>
          <p className="font-display text-5xl text-acid">{formatNumber(user.currentPoints)}</p>
          <p className="mt-2 text-sm text-mute">Leaderboard rank: {rank ?? "Unranked"}</p>
          <p className="mt-1 text-sm text-mute">Formula version {snapshot?.formulaVersion ?? user.formulaVersion}</p>
          <p className="mt-1 text-sm text-mute">Last successful fetch: {formatWhen(snapshot?.fetchedAt)}</p>
          {snapshot?.upstreamComputedAt ? (
            <p className="text-sm text-mute">Pump.fun callout-stats computedAt: {formatWhen(snapshot.upstreamComputedAt)}</p>
          ) : null}
        </article>
        <article className="rounded-3xl border border-line bg-panel p-5">
          <h2 className="font-display text-xl">Point breakdown</h2>
          <div className="mt-4">
            {snapshot ? <PointsChart components={snapshot.pointsBreakdown.components} /> : <p>No calculation yet.</p>}
          </div>
        </article>
      </section>
      <section className="overflow-x-auto rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-xl">Verified values and sources</h2>
        <table className="mt-4 w-full min-w-[680px] text-left text-sm">
          <thead className="text-mute">
            <tr>
              <th className="py-2">Metric</th>
              <th>Status</th>
              <th>Value</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([metric, status, value, source, detail]) => (
              <tr key={String(metric)} className="border-t border-line align-top">
                <td className="py-3">{metric}</td>
                <td>{status}</td>
                <td>{metricLabel(String(status), value as number | null)}</td>
                <td>
                  <p>{source}</p>
                  <p className="text-mute">{detail}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-xl">Callout records in this snapshot</h2>
        {callouts.length === 0 ? (
          <p className="mt-3 text-sm text-mute">No individual Callout rows were stored for this snapshot.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-mute">
                <tr>
                  <th className="py-2">Callout</th>
                  <th>Likes</th>
                  <th>Reposts</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {callouts.slice(0, 50).map((callout) => (
                  <tr key={callout.calloutId} className="border-t border-line">
                    <td className="py-2">{callout.calloutId}</td>
                    <td>{formatNumber(callout.likes)}</td>
                    <td>{formatNumber(callout.repostCount)}</td>
                    <td>{formatWhen(callout.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {callouts.length > 50 ? <p className="mt-2 text-sm text-mute">Showing 50 of {callouts.length} deduped rows.</p> : null}
          </div>
        )}
      </section>
      <p className="text-sm text-mute">
        Points use current cumulative public totals and do not guarantee a token allocation.{" "}
        <Link className="text-acid" href="/claim">
          Claim registration
        </Link>{" "}
        is separate and requires the canonical wallet.
      </p>
    </div>
  );
}
