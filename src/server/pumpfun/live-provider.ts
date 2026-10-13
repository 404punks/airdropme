import { isSolanaAddress } from "@/server/validation/identifier";
import type { MetricValue } from "@/server/points/calculate";
import { aggregateCallouts, type RawCallout } from "@/server/pumpfun/aggregate";
import { pumpGet } from "@/server/pumpfun/http";
import { NotPumpProfileError, ProfileNotFoundError, type FetchOutcome, type StatsProvider } from "@/server/pumpfun/types";

interface LiveProviderOptions {
  baseUrl: string;
  token?: string;
  pageLimit: number;
  maxPages: number;
  fetchImpl?: typeof fetch;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function unavailable(source: string, detail: string): MetricValue {
  return { status: "unavailable", value: null, source, detail };
}

export function createLiveProvider(options: LiveProviderOptions): StatsProvider {
  const get = (path: string) =>
    pumpGet({
      baseUrl: options.baseUrl,
      path,
      token: options.token,
      fetchImpl: options.fetchImpl,
    });

  return {
    mode: "live",
    async fetchProfile(lookup: string): Promise<FetchOutcome> {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookup);
      let resolved = lookup;
      if (!isSolanaAddress(lookup) && !uuid) {
        try {
          const user = await get(`/users/${encodeURIComponent(lookup)}`);
          const row = asRecord(user.json);
          resolved = textOrNull(row?.canonical_svm_wallet) ?? textOrNull(row?.address) ?? textOrNull(row?.userId) ?? "";
          if (!resolved) throw new NotPumpProfileError("The username did not resolve to a Pump.fun profile.");
        } catch (error) {
          const status = error instanceof Error && "status" in error ? (error as { status: number | null }).status : null;
          if (status === 404) throw new ProfileNotFoundError();
          if (error instanceof NotPumpProfileError) throw error;
          throw error;
        }
      }
      const encoded = encodeURIComponent(resolved);
      let overviewJson: unknown;
      try {
        const overview = await get(`/users/${encoded}/overview`);
        overviewJson = overview.json;
      } catch (error) {
        const status = error instanceof Error && "status" in error ? (error as { status: number | null }).status : null;
        if (status === 404) throw new ProfileNotFoundError();
        throw error;
      }
      const overview = asRecord(overviewJson);
      const profile = asRecord(overview?.profile);
      if (!overview || profile == null) throw new NotPumpProfileError();
      const pumpUserId = textOrNull(profile.userId);
      if (!pumpUserId) throw new NotPumpProfileError("The API response did not include a Pump.fun user id.");

      const counts = asRecord(overview.counts);
      const failures: FetchOutcome["failures"] = [];
      let followers = numberOrNull(counts?.followers);
      let followerSource = "GET /users/{id}/overview counts.followers";
      let followerDetail = "Direct follower count from the public profile overview.";
      if (followers == null) {
        try {
          const countResponse = await get(`/following/v3/followers/count/${encoded}`);
          followers = numberOrNull(asRecord(countResponse.json)?.count);
          followerSource = "GET /following/v3/followers/count/{userId} count";
          followerDetail = "Overview counts were missing. Used the public follower-count endpoint.";
        } catch (error) {
          failures.push({
            endpoint: `/following/v3/followers/count/${encoded}`,
            statusCode: error instanceof Error && "status" in error ? ((error as { status: number | null }).status ?? null) : null,
            message: error instanceof Error ? error.message : "Follower count request failed.",
          });
        }
      }
      if (followers == null) {
        const profileFollowers = numberOrNull(profile.followers);
        if (profileFollowers != null) {
          followers = profileFollowers;
          followerSource = "GET /users/{id}/overview profile.followers";
          followerDetail = "Used the follower field on the public profile row.";
        }
      }

      const canonicalWallet = textOrNull(profile.canonical_svm_wallet) ?? textOrNull(profile.address);
      const statsId = encodeURIComponent(canonicalWallet ?? pumpUserId);
      let totalCallouts: number | null = null;
      let computedAt: string | null = null;
      try {
        const stats = await get(`/users/${statsId}/callout-stats`);
        const body = asRecord(stats.json);
        computedAt = textOrNull(body?.computedAt);
        const allTime = asRecord(body?.allTime);
        totalCallouts = allTime ? numberOrNull(allTime.totalCallouts) : null;
        if (!allTime) {
          failures.push({
            endpoint: `/users/${statsId}/callout-stats`,
            statusCode: 200,
            message: "allTime Callout stats were absent.",
          });
        }
      } catch (error) {
        failures.push({
          endpoint: `/users/${statsId}/callout-stats`,
          statusCode: error instanceof Error && "status" in error ? ((error as { status: number | null }).status ?? null) : null,
          message: error instanceof Error ? error.message : "Callout stats request failed.",
        });
      }

      const pages: RawCallout[][] = [];
      let truncated = false;
      if (totalCallouts != null && totalCallouts > 0) {
        let pageToken = "";
        for (let page = 0; page < options.maxPages; page += 1) {
          const params = new URLSearchParams({
            limit: String(options.pageLimit),
            sortBy: "TIMESTAMP",
            sortOrder: "DESC",
          });
          if (pageToken) params.set("pageToken", pageToken);
          const path = `/callout/list/${statsId}?${params.toString()}`;
          try {
            const listed = await get(path);
            const body = asRecord(listed.json);
            const rows = Array.isArray(body?.callouts) ? (body.callouts as RawCallout[]) : null;
            if (!rows || typeof body?.nextPageToken !== "string") {
              truncated = true;
              failures.push({
                endpoint: path,
                statusCode: 200,
                message: "Callout list response did not include callouts and nextPageToken.",
              });
              break;
            }
            pages.push(rows);
            pageToken = body.nextPageToken;
            if (!pageToken) break;
            if (page === options.maxPages - 1) truncated = true;
          } catch (error) {
            truncated = true;
            failures.push({
              endpoint: path,
              statusCode: error instanceof Error && "status" in error ? ((error as { status: number | null }).status ?? null) : null,
              message: error instanceof Error ? error.message : "Callout list request failed.",
            });
            break;
          }
        }
      }

      const aggregated = aggregateCallouts(pages, totalCallouts, truncated);
      const calloutMetric: MetricValue =
        totalCallouts == null
          ? unavailable(
              "GET /users/{address}/callout-stats allTime.totalCallouts",
              "The all-time Callout total was not returned.",
            )
          : {
              status: "verified",
              value: totalCallouts,
              source: "GET /users/{address}/callout-stats allTime.totalCallouts",
              detail: computedAt ? `Upstream computedAt ${computedAt}.` : "Direct all-time Callout total.",
            };

      return {
        profile: {
          pumpUserId,
          username: textOrNull(profile.username),
          canonicalWallet,
          profileImage: textOrNull(profile.profile_image),
          bio: textOrNull(profile.bio),
          banned: overview.banned === true || profile.is_banned === true,
          kind: textOrNull(profile.kind),
        },
        metrics: {
          followers:
            followers == null
              ? unavailable(followerSource, "Follower count was not present in the public responses.")
              : { status: "verified", value: followers, source: followerSource, detail: followerDetail },
          callouts: calloutMetric,
          likes: aggregated.likes,
          reposts: aggregated.reposts,
        },
        callouts: aggregated.callouts,
        upstreamComputedAt: computedAt,
        dataMode: "live",
        failures,
      };
    },
  };
}
