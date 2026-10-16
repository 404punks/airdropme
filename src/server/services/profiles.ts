import { config } from "@/server/config";
import type { Repository, SnapshotRecord, UserRecord } from "@/server/db/types";
import { profilePath, publicProfileKey } from "@/lib/profile-key";
import { calculatePoints, type PointsBreakdown, type ScoringSettings } from "@/server/points/calculate";
import { NotPumpProfileError, ProfileNotFoundError, type FetchOutcome, type StatsProvider } from "@/server/pumpfun/types";
import { hashIp } from "@/server/security/ip";
import { rateLimit } from "@/server/security/rate-limit";
import { DEFAULT_SITE_ORIGIN, referralUrl, referrerShare } from "@/server/referrals/logic";
import { formatNumber } from "@/lib/utils";
import { applyReferral, getReferralRepository, publishReferralLink } from "@/server/referrals/service";
import { parseIdentifier } from "@/server/validation/identifier";

export { profilePath, publicProfileKey };

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "rate_limit" | "not_found" | "not_profile" | "throttled" | "upstream",
    readonly status: number,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export interface ProfileView {
  user: UserRecord;
  snapshot: SnapshotRecord | null;
  rank: number | null;
  callouts: Awaited<ReturnType<Repository["listCallouts"]>>;
  freshness: "recent" | "cached" | "stale" | "demo" | "empty";
  created?: boolean;
  message?: string;
}

function freshness(snapshot: SnapshotRecord | null, ttlSeconds: number): ProfileView["freshness"] {
  if (!snapshot) return "empty";
  if (snapshot.dataMode === "demo") return "demo";
  const age = Date.now() - new Date(snapshot.fetchedAt).getTime();
  if (age <= 20_000) return "recent";
  if (age <= ttlSeconds * 1000) return "cached";
  return "stale";
}

async function rankFor(repo: Repository, userId: string): Promise<number | null> {
  const board = await repo.leaderboard("", 1, 5000);
  return board.rows.find((row) => row.userId === userId)?.rank ?? null;
}

async function findStoredUser(repo: Repository, id: string): Promise<UserRecord | null> {
  return (
    (await repo.findUserById(id)) ??
    (await repo.findUserByPumpId(id)) ??
    (await repo.findUserByUsername(id)) ??
    (await repo.findUserByWallet(id))
  );
}

export async function viewProfile(
  repo: Repository,
  id: string,
  options?: { provider?: StatsProvider; ip?: string; referrerUsername?: string | null; origin?: string },
): Promise<ProfileView> {
  const user = await findStoredUser(repo, id);
  if (!user) {
    const parsed = parseIdentifier(id);
    if (!options?.provider || !parsed.ok) {
      throw new ServiceError("That profile is not in this campaign yet.", "not_found", 404);
    }
    const ip = options.ip ?? "profile-lookup";
    const limited = rateLimit(
      `profile-lookup:${hashIp(ip, config.IP_HASH_SALT)}`,
      30,
      config.RATE_LIMIT_WINDOW_SECONDS * 1000,
    );
    if (!limited.ok) {
      throw new ServiceError("Too many profile lookups from this network. Try again later.", "rate_limit", 429, {
        retryAfterSeconds: limited.retryAfterSeconds,
      });
    }
    return submitProfile({
      repo,
      provider: options.provider,
      raw: id,
      ip,
      skipRateLimit: true,
      referrerUsername: options.referrerUsername,
      origin: options.origin,
    });
  }
  const snapshot = await repo.latestSnapshot(user.id);
  const callouts = snapshot ? await repo.listCallouts(snapshot.id) : [];
  return {
    user,
    snapshot,
    rank: await rankFor(repo, user.id),
    callouts,
    freshness: freshness(snapshot, config.STATS_CACHE_TTL_SECONDS),
  };
}

function zeroIfBanned(outcome: FetchOutcome, breakdown: PointsBreakdown): PointsBreakdown {
  if (!outcome.profile.banned) return breakdown;
  return {
    ...breakdown,
    components: breakdown.components.map((item) => ({
      ...item,
      included: false,
      points: 0,
      counted: 0,
      reason: "Pump.fun reports this profile as banned, so it is not scored.",
    })),
    subtotal: 0,
    total: 0,
    capped: false,
  };
}

export async function submitProfile(options: {
  repo: Repository;
  provider: StatsProvider;
  raw: string;
  ip: string;
  force?: boolean;
  skipRateLimit?: boolean;
  referrerUsername?: string | null;
  origin?: string;
}): Promise<ProfileView> {
  const parsed = parseIdentifier(options.raw);
  if (!parsed.ok) throw new ServiceError(parsed.error, "validation", 400);
  const ipHash = hashIp(options.ip, config.IP_HASH_SALT);
  if (!options.skipRateLimit) {
    const limited = rateLimit(`submit:${ipHash}`, config.SUBMISSIONS_PER_WINDOW, config.RATE_LIMIT_WINDOW_SECONDS * 1000);
    if (!limited.ok) {
      throw new ServiceError("Too many profile submissions from this network. Try again later.", "rate_limit", 429, {
        retryAfterSeconds: limited.retryAfterSeconds,
      });
    }
    const since = new Date(Date.now() - config.RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
    const prior = await options.repo.submissionCount(ipHash, since);
    if (prior >= config.SUBMISSIONS_PER_WINDOW) {
      throw new ServiceError("Too many profile submissions from this network. Try again later.", "rate_limit", 429);
    }
  }

  const existing =
    parsed.kind === "wallet"
      ? await options.repo.findUserByWallet(parsed.lookup)
      : await options.repo.findUserByUsername(parsed.lookup);
  if (existing?.lastFetchedAt && !options.force) {
    const age = Date.now() - new Date(existing.lastFetchedAt).getTime();
    if (age < config.MIN_REFRESH_SECONDS * 1000) {
      const view = await viewProfile(options.repo, existing.id);
      const referralNote = await rememberReferral({
        referrerUsername: options.referrerUsername,
        referredUsername: existing.username,
        referredImage: existing.profileImage,
        referredRewardPoints: existing.currentPoints,
        createdAt: existing.createdAt,
        origin: options.origin ?? DEFAULT_SITE_ORIGIN,
      });
      const message = "This profile is already registered. Showing the latest stored snapshot.";
      return {
        ...view,
        created: false,
        message: referralNote ? `${message} ${referralNote}` : message,
      };
    }
  }

  let outcome: FetchOutcome;
  try {
    outcome = await options.provider.fetchProfile(parsed.lookup);
  } catch (error) {
    if (error instanceof ProfileNotFoundError) throw new ServiceError(error.message, "not_found", 404);
    if (error instanceof NotPumpProfileError) throw new ServiceError(error.message, "not_profile", 422);
    throw new ServiceError(
      error instanceof Error ? error.message : "Pump.fun could not be reached. No score was estimated.",
      "upstream",
      502,
    );
  }

  const settings = await options.repo.getSettings();
  const breakdown = zeroIfBanned(outcome, calculatePoints(outcome.metrics, settings));
  const saved = await options.repo.saveVerifiedStats({
    submittedRaw: options.raw.trim().slice(0, 200),
    normalized: parsed.lookup,
    ipHash,
    user: {
      pumpUserId: outcome.profile.pumpUserId,
      username: outcome.profile.username,
      canonicalWallet: outcome.profile.canonicalWallet,
      profileImage: outcome.profile.profileImage,
      bio: outcome.profile.bio,
      banned: outcome.profile.banned,
      dataMode: outcome.dataMode,
      flagged: outcome.profile.banned,
      flagReason: outcome.profile.banned ? "Pump.fun reports this profile as banned." : null,
    },
    snapshot: {
      dataMode: outcome.dataMode,
      followers: outcome.metrics.followers.value,
      followersStatus: outcome.metrics.followers.status,
      followersSource: outcome.metrics.followers.source,
      followersDetail: outcome.metrics.followers.detail,
      callouts: outcome.metrics.callouts.value,
      calloutsStatus: outcome.metrics.callouts.status,
      calloutsSource: outcome.metrics.callouts.source,
      calloutsDetail: outcome.metrics.callouts.detail,
      likes: outcome.metrics.likes.value,
      likesStatus: outcome.metrics.likes.status,
      likesSource: outcome.metrics.likes.source,
      likesDetail: outcome.metrics.likes.detail,
      reposts: outcome.metrics.reposts.value,
      repostsStatus: outcome.metrics.reposts.status,
      repostsSource: outcome.metrics.reposts.source,
      repostsDetail: outcome.metrics.reposts.detail,
      upstreamComputedAt: outcome.upstreamComputedAt,
      pointsTotal: breakdown.total,
      pointsBreakdown: breakdown,
      formulaVersion: breakdown.formulaVersion,
    },
    callouts: outcome.callouts,
    breakdown,
    settings,
  });
  if (outcome.failures.length) {
    await options.repo.insertFailures(
      outcome.failures.map((failure) => ({
        userId: saved.user.id,
        identifier: parsed.lookup,
        endpoint: failure.endpoint,
        statusCode: failure.statusCode,
        message: failure.message.slice(0, 300),
      })),
    );
  }
  const view = await viewProfile(options.repo, saved.user.id);
  const referralNote = await rememberReferral({
    referrerUsername: options.referrerUsername,
    referredUsername: saved.user.username,
    referredImage: saved.user.profileImage,
    referredRewardPoints: saved.user.currentPoints,
    createdAt: saved.user.createdAt,
    origin: options.origin ?? DEFAULT_SITE_ORIGIN,
  });
  const base = saved.created ? "Profile registered from public Pump.fun data." : "Stored snapshot refreshed.";
  return {
    ...view,
    created: saved.created,
    message: referralNote ? `${base} ${referralNote}` : base,
  };
}

async function rememberReferral(input: {
  referrerUsername?: string | null;
  referredUsername: string | null;
  referredImage: string | null;
  referredRewardPoints: number;
  createdAt: string;
  origin: string;
}): Promise<string> {
  const store = getReferralRepository();
  let note = "";
  if (input.referredUsername && store) {
    try {
      await publishReferralLink(store, {
        username: input.referredUsername,
        profileImage: input.referredImage,
        origin: input.origin,
      });
    } catch {
      note = "Your referral link could not be saved to Firebase. Nothing was deleted.";
    }
  }
  if (!input.referrerUsername || !input.referredUsername) return note;
  if (!store) return "Referral points were not saved because Firebase is not configured.";
  try {
    const grant = await applyReferral(store, {
      referrerUsername: input.referrerUsername,
      referredUsername: input.referredUsername,
      referredImage: input.referredImage,
      referredRewardPoints: input.referredRewardPoints,
      origin: input.origin,
      createdAt: input.createdAt,
    });
    if (grant.status === "recorded") {
      const share = formatNumber(referrerShare(input.referredRewardPoints));
      return `You joined from a referral link. Your referrer receives ${share} PTS, 1% of your reward. This referral is stored in Firebase and is not deleted.`;
    }
    if (grant.status === "rejected" && grant.reason) return grant.reason;
    return note;
  } catch {
    return "Your referral could not be saved to Firebase. The profile check is still complete, and no referral history was deleted.";
  }
}

export function profileReferralLink(username: string | null, origin: string): string | null {
  if (!username) return null;
  return referralUrl(origin, username);
}

export type { ScoringSettings };
