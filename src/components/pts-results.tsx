import Link from "next/link";
import { CopyAddress } from "@/components/copy-address";
import { InactiveClaimButton } from "@/components/inactive-claim-button";
import { PointsChart } from "@/components/points-chart";
import { RefreshButton } from "@/components/refresh-button";
import { Badge } from "@/components/ui/badge";
import { qualification } from "@/lib/eligibility";
import { profileNotice } from "@/lib/notices";
import { publicProfileKey } from "@/lib/profile-key";
import { formatNumber, formatWhen, metricLabel, shortKey } from "@/lib/utils";
import type { CampaignRecord, SnapshotRecord, UserRecord } from "@/server/db/types";
import type { NormalizedCallout } from "@/server/pumpfun/types";

const toneFor = {
  verified: "live",
  demo: "demo",
  unavailable: "unavailable",
  incomplete: "cached",
} as const;

function tileFigure(status: string, value: number | null): string {
  if ((status === "demo" || status === "verified") && value != null) return formatNumber(value);
  return metricLabel(status, value);
}

function safeImage(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function PtsResults({
  user,
  snapshot,
  callouts,
  freshness,
  notice,
  campaign,
}: {
  user: UserRecord;
  snapshot: SnapshotRecord | null;
  callouts: NormalizedCallout[];
  freshness: "recent" | "cached" | "stale" | "demo" | "empty";
  notice?: string;
  campaign: CampaignRecord;
}) {
  const image = safeImage(user.profileImage);
  const note = profileNotice(notice);
  const status = qualification({
    hasSnapshot: Boolean(snapshot),
    points: user.currentPoints,
    minPoints: campaign.minPoints,
    banned: user.banned,
    flagged: user.flagged,
    claimStatus: campaign.status,
  });
  const freshnessCopy = {
    recent: "Checked against public Pump.fun data just now.",
    cached: "Showing a saved snapshot. This page did not call Pump.fun again.",
    stale: "This snapshot is older than the cache window. Refresh to request a newer read.",
    demo: "These figures are sample data, not live Pump.fun statistics.",
    empty: "No points snapshot is stored for this account yet.",
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
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {image ? (
            <img src={image} alt="" className="h-16 w-16 rounded-none border border-line object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-none border border-line bg-panel2 text-lg font-semibold text-blue">
              {(user.username ?? "P").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm text-mute">Profile overview</p>
            <h1 className="break-words font-display text-3xl leading-tight sm:text-4xl">{user.username ?? "Unnamed profile"}</h1>
            <p className="mt-2 text-sm text-mute">
              {user.canonicalWallet ? <CopyAddress address={user.canonicalWallet} /> : shortKey(user.canonicalWallet)}
            </p>
            <p className="mt-1 text-sm text-mute">Updated {formatWhen(snapshot?.fetchedAt ?? user.lastFetchedAt)}</p>
          </div>
        </div>
        <RefreshButton profileKey={publicProfileKey(user)} />
      </div>

      {note ? <p className="rounded-none border border-blue/30 bg-blue/10 px-4 py-3 text-sm text-mist">{note}</p> : null}
      <p className="text-sm text-mute">{freshnessCopy}</p>

      <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="min-w-0 border border-line border-t-2 border-t-blue bg-panel p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-mute">Total PTS</p>
          <p className="mt-3 font-display text-6xl leading-none tabular-nums text-mist">{formatNumber(user.currentPoints)}</p>
          <div className="mt-4">
            {status.status === "unavailable" ? (
              <p className="break-words text-sm text-mute">Your eligibility status is currently unavailable. Please try again later.</p>
            ) : null}
            {status.status === "not_eligible" ? (
              <div className="space-y-2">
                <Badge tone="unavailable">Not Eligible</Badge>
                <p className="break-words text-sm text-mute">{status.reason}</p>
              </div>
            ) : null}
            {status.status === "claim_coming_soon" ? (
              <div className="space-y-2">
                <Badge tone="cached">Claim coming soon</Badge>
                <p className="break-words text-sm text-mute">{status.detail}</p>
              </div>
            ) : null}
            {status.status === "eligible" ? (
              <div className="space-y-2">
                <Badge tone="live">Eligible</Badge>
                <p className="break-words text-sm text-mute">{status.detail}</p>
              </div>
            ) : null}
          </div>
          <p className="mt-4 text-sm text-mute">Current points requirement: {campaign.minPoints.toLocaleString("en-US")} PTS.</p>
          {user.flagged && user.flagReason ? <p className="mt-2 text-sm text-warn">{user.flagReason}</p> : null}
          <InactiveClaimButton className="mt-5" />
        </article>
        <article className="min-w-0 border border-line bg-panel p-4 sm:p-5">
          <h2 className="font-display text-xl">PTS breakdown</h2>
          <div className="mt-4">
            {snapshot ? <PointsChart components={snapshot.pointsBreakdown.components} /> : <p className="text-sm text-mute">No points data is currently available for this account.</p>}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Followers", snapshot?.followersStatus, snapshot?.followers],
          ["Callouts", snapshot?.calloutsStatus, snapshot?.callouts],
          ["Likes", snapshot?.likesStatus, snapshot?.likes],
          ["Reposts", snapshot?.repostsStatus, snapshot?.reposts],
        ].map(([label, metricStatus, value]) => (
          <article key={String(label)} className="flex aspect-square min-w-0 flex-col justify-between border border-line bg-navy p-4 sm:aspect-auto sm:min-h-36">
            <p className="text-xs uppercase tracking-[0.14em] text-mute">{label}</p>
            <p className="break-words font-display text-3xl leading-none">{tileFigure(String(metricStatus ?? "unavailable"), (value as number | null) ?? null)}</p>
            <Badge className="w-fit" tone={toneFor[(metricStatus as keyof typeof toneFor) ?? "unavailable"]}>{String(metricStatus ?? "empty")}</Badge>
          </article>
        ))}
      </section>

      {rows.length > 0 ? (
        <section className="min-w-0 rounded-none border border-line bg-panel p-4 sm:p-5">
          <h2 className="font-display text-xl">Verified values</h2>
          <ul className="mt-4 space-y-2 md:hidden">
            {rows.map(([metric, metricStatus, value, source, detail]) => (
              <li key={String(metric)} className="border border-line p-3 text-sm">
                <p className="font-medium">{metric}</p>
                <p className="mt-1 capitalize text-mute">{metricStatus}</p>
                <p className="mt-2 font-display text-2xl">{metricLabel(String(metricStatus), value as number | null)}</p>
                <p className="mt-2 break-words text-mute">{source}</p>
                <p className="break-words text-mute">{detail}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-mute">
              <tr>
                <th className="py-2 font-medium">Metric</th>
                <th className="font-medium">Status</th>
                <th className="font-medium">Value</th>
                <th className="font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([metric, metricStatus, value, source, detail]) => (
                <tr key={String(metric)} className="border-t border-line align-top">
                  <td className="py-3">{metric}</td>
                  <td className="capitalize">{metricStatus}</td>
                  <td>{metricLabel(String(metricStatus), value as number | null)}</td>
                  <td>
                    <p>{source}</p>
                    <p className="text-mute">{detail}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      ) : null}

      <section className="min-w-0 rounded-none border border-line bg-panel p-4 sm:p-5">
        <h2 className="font-display text-xl">Callouts in this snapshot</h2>
        {callouts.length === 0 ? (
          <p className="mt-3 text-sm text-mute">No individual Callout rows were stored for this snapshot.</p>
        ) : (
          <>
          <ul className="mt-3 space-y-2 md:hidden">
            {callouts.slice(0, 50).map((callout) => (
              <li key={callout.calloutId} className="border border-line p-3 text-sm">
                <p className="break-all font-medium">{callout.calloutId}</p>
                <p className="mt-2 text-mute">Likes {formatNumber(callout.likes)} · Reposts {formatNumber(callout.repostCount)}</p>
                <p className="text-mute">{formatWhen(callout.createdAt)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-mute">
                <tr>
                  <th className="py-2 font-medium">Callout</th>
                  <th className="font-medium">Likes</th>
                  <th className="font-medium">Reposts</th>
                  <th className="font-medium">Created</th>
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
            {callouts.length > 50 ? <p className="mt-2 text-sm text-mute">Showing 50 of {callouts.length} rows.</p> : null}
          </div>
          {callouts.length > 50 ? <p className="mt-2 text-sm text-mute md:hidden">Showing 50 of {callouts.length} rows.</p> : null}
          </>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link className="text-blue hover:text-white" href="/#check">
          Check Another Account
        </Link>
        <Link className="text-mute hover:text-white" href="/claim">
          Airdrop Claim
        </Link>
      </div>
    </div>
  );
}
