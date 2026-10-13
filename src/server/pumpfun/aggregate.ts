import type { MetricValue } from "@/server/points/calculate";
import type { NormalizedCallout } from "@/server/pumpfun/types";

export interface RawCallout {
  calloutId?: unknown;
  likes?: unknown;
  repostCount?: unknown;
  coinMint?: unknown;
  createdAt?: unknown;
}

export function calloutTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  return null;
}

export function aggregateCallouts(
  pages: RawCallout[][],
  totalCallouts: number | null,
  truncated: boolean,
): { likes: MetricValue; reposts: MetricValue; callouts: NormalizedCallout[] } {
  const source = "GET /callout/list/{userId} likes and repostCount, deduped by calloutId";
  if (totalCallouts == null) {
    return {
      likes: {
        status: "unavailable",
        value: null,
        source,
        detail: "Likes were not summed because the all-time Callout total was unavailable.",
      },
      reposts: {
        status: "unavailable",
        value: null,
        source,
        detail: "Reposts were not summed because the all-time Callout total was unavailable.",
      },
      callouts: [],
    };
  }
  if (totalCallouts === 0 && !truncated) {
    return {
      likes: {
        status: "verified",
        value: 0,
        source,
        detail: "The all-time Callout total is zero, so received likes are zero.",
      },
      reposts: {
        status: "verified",
        value: 0,
        source,
        detail: "The all-time Callout total is zero, so received reposts are zero.",
      },
      callouts: [],
    };
  }

  const seen = new Map<string, NormalizedCallout>();
  let likesComplete = true;
  let repostsComplete = true;
  for (const page of pages) {
    for (const row of page) {
      if (typeof row.calloutId !== "string" || !row.calloutId) {
        likesComplete = false;
        repostsComplete = false;
        continue;
      }
      if (seen.has(row.calloutId)) continue;
      const likes = typeof row.likes === "number" && Number.isFinite(row.likes) && row.likes >= 0 ? row.likes : null;
      const reposts =
        typeof row.repostCount === "number" && Number.isFinite(row.repostCount) && row.repostCount >= 0
          ? row.repostCount
          : null;
      if (likes == null) likesComplete = false;
      if (reposts == null) repostsComplete = false;
      seen.set(row.calloutId, {
        calloutId: row.calloutId,
        coinMint: typeof row.coinMint === "string" ? row.coinMint : null,
        likes: likes ?? 0,
        repostCount: reposts ?? 0,
        createdAt: calloutTimestamp(row.createdAt),
      });
    }
  }

  const callouts = [...seen.values()];
  const countMismatch = totalCallouts != null && callouts.length !== totalCallouts;
  const incomplete = truncated || countMismatch || !likesComplete || !repostsComplete;
  if (incomplete) {
    const detail = truncated
      ? "Pagination stopped at the safety cap before the API reported the last page."
      : countMismatch
        ? "The number of Callout rows did not match allTime.totalCallouts, so the sum is not treated as complete."
        : "One or more Callout rows did not include a numeric engagement count.";
    return {
      likes: { status: "incomplete", value: null, source, detail },
      reposts: { status: "incomplete", value: null, source, detail },
      callouts,
    };
  }

  const likes = callouts.reduce((sum, row) => sum + row.likes, 0);
  const reposts = callouts.reduce((sum, row) => sum + row.repostCount, 0);
  return {
    likes: {
      status: "verified",
      value: likes,
      source,
      detail: `Sum of likes across ${callouts.length} deduped Callouts. Quotes are not included.`,
    },
    reposts: {
      status: "verified",
      value: reposts,
      source,
      detail: `Sum of repostCount across ${callouts.length} deduped Callouts. Pump.fun does not return a separate retweet count.`,
    },
    callouts,
  };
}
