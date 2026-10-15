import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { beforeEach, describe, expect, it } from "vitest";
import { readConfig, resolveDatabaseUrl } from "@/server/config";
import { FileMemoryStore } from "@/server/db/file-store";
import { MemoryStore } from "@/server/db/memory-store";
import { aggregateCallouts } from "@/server/pumpfun/aggregate";
import { pumpGet } from "@/server/pumpfun/http";
import { createLiveProvider } from "@/server/pumpfun/live-provider";
import { ProfileNotFoundError } from "@/server/pumpfun/types";
import { calculatePoints, DEFAULT_SETTINGS } from "@/server/points/calculate";
import { assertSameOrigin } from "@/server/security/origin";
import { rateLimit, resetRateLimits } from "@/server/security/rate-limit";
import { buildClaimMessage, verifyWalletSignature } from "@/server/security/signature";
import { registerClaim, type Distributor } from "@/server/services/claims";
import { demoProvider } from "@/server/pumpfun/demo-provider";
import { ServiceError, submitProfile, viewProfile } from "@/server/services/profiles";
import { qualification } from "@/lib/eligibility";
import { isSolanaAddress, parseIdentifier } from "@/server/validation/identifier";

const wallet = "11111111111111111111111111111111";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "x-ratelimit-limit": "60", "x-ratelimit-remaining": "59" },
  });
}

function overview(partial: Record<string, unknown> = {}) {
  return {
    address: wallet,
    profile: {
      address: wallet,
      userId: "07cfa89c-35ba-4c9d-8a1b-f93bff8e48ad",
      username: "BygoneAbleGray",
      canonical_svm_wallet: wallet,
      profile_image: null,
      bio: null,
      is_banned: false,
      followers: 12,
      ...partial,
    },
    counts: { followers: 12, following: 0 },
    banned: false,
  };
}

describe("identifiers", () => {
  it("accepts pump.fun profile URLs and wallets", () => {
    expect(parseIdentifier("https://pump.fun/profile/BygoneAbleGray")).toEqual({
      ok: true,
      lookup: "BygoneAbleGray",
      kind: "username",
    });
    expect(parseIdentifier(`https://www.pump.fun/profile/${wallet}`).ok).toBe(true);
    expect(parseIdentifier(wallet)).toMatchObject({ ok: true, kind: "wallet" });
  });

  it("rejects arbitrary hosts and junk", () => {
    expect(parseIdentifier("https://evil.example/profile/a").ok).toBe(false);
    expect(parseIdentifier("").ok).toBe(false);
    expect(parseIdentifier("javascript:alert(1)").ok).toBe(false);
    expect(parseIdentifier("https://pump.fun/callouts").ok).toBe(false);
  });

  it("recognizes a real ed25519 public key", () => {
    const pair = nacl.sign.keyPair();
    const encoded = bs58.encode(pair.publicKey);
    expect(isSolanaAddress(encoded)).toBe(true);
  });
});

describe("points and callouts", () => {
  it("does not score unavailable or incomplete metrics", () => {
    const breakdown = calculatePoints(
      {
        followers: { status: "verified", value: 10, source: "s", detail: "d" },
        callouts: { status: "unavailable", value: null, source: "s", detail: "d" },
        likes: { status: "incomplete", value: null, source: "s", detail: "d" },
        reposts: { status: "verified", value: 4, source: "s", detail: "d" },
      },
      DEFAULT_SETTINGS,
    );
    expect(breakdown.total).toBe(10 * 1 + 4 * 2);
    expect(breakdown.components.find((item) => item.key === "callouts")?.included).toBe(false);
  });

  it("applies caps and does not add the same totals twice", () => {
    const settings = { ...DEFAULT_SETTINGS, capFollowers: 5, capTotalPoints: 6 };
    const once = calculatePoints(
      {
        followers: { status: "verified", value: 100, source: "s", detail: "d" },
        callouts: { status: "verified", value: 0, source: "s", detail: "d" },
        likes: { status: "verified", value: 0, source: "s", detail: "d" },
        reposts: { status: "verified", value: 0, source: "s", detail: "d" },
      },
      settings,
    );
    expect(once.total).toBe(5);
    expect(once.capped).toBe(false);
    const second = calculatePoints(
      {
        followers: { status: "verified", value: 100, source: "s", detail: "d" },
        callouts: { status: "verified", value: 0, source: "s", detail: "d" },
        likes: { status: "verified", value: 0, source: "s", detail: "d" },
        reposts: { status: "verified", value: 0, source: "s", detail: "d" },
      },
      settings,
    );
    expect(second.total).toBe(once.total);
  });

  it("dedupes overlapping Callout pages and refuses a partial sum", () => {
    const row = { calloutId: "a", likes: 3, repostCount: 1, coinMint: "m", createdAt: 1767225600000 };
    const summed = aggregateCallouts([[row], [row, { ...row, calloutId: "b", likes: 2, repostCount: 4 }]], 2, false);
    expect(summed.likes.value).toBe(5);
    expect(summed.reposts.value).toBe(5);
    expect(summed.callouts[0]?.createdAt).toBe("2026-01-01T00:00:00.000Z");
    const partial = aggregateCallouts([[row]], 2, true);
    expect(partial.likes.status).toBe("incomplete");
    expect(partial.likes.value).toBeNull();
  });

  it("does not turn a missing Callout total into zero likes", () => {
    const result = aggregateCallouts([], null, false);
    expect(result.likes.status).toBe("unavailable");
    expect(result.reposts.value).toBeNull();
  });
});

describe("live provider", () => {
  it("maps public overview, callout stats, and paged likes", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/overview")) return jsonResponse(overview());
      if (url.includes("/callout-stats")) {
        return jsonResponse({ allTime: { totalCallouts: 2 }, computedAt: "2026-10-13T00:00:00.000Z" });
      }
      if (url.includes("pageToken=")) {
        return jsonResponse({
          callouts: [{ calloutId: "b", likes: 4, repostCount: 1, coinMint: "m2", createdAt: "2026-01-02T00:00:00.000Z" }],
          nextPageToken: "",
        });
      }
      return jsonResponse({
        callouts: [{ calloutId: "a", likes: 1, repostCount: 2, coinMint: "m", createdAt: "2026-01-01T00:00:00.000Z" }],
        nextPageToken: "next",
      });
    }) as typeof fetch;
    const provider = createLiveProvider({
      baseUrl: "https://frontend-api-v3.pump.fun",
      pageLimit: 1,
      maxPages: 5,
      fetchImpl,
    });
    const outcome = await provider.fetchProfile(wallet);
    expect(outcome.metrics.followers).toMatchObject({ status: "verified", value: 12 });
    expect(outcome.metrics.callouts).toMatchObject({ status: "verified", value: 2 });
    expect(outcome.metrics.likes.value).toBe(5);
    expect(outcome.metrics.reposts.value).toBe(3);
    expect(calls.every((url) => url.startsWith("https://frontend-api-v3.pump.fun/"))).toBe(true);
  });

  it("reports a missing profile instead of a zero score", async () => {
    const fetchImpl = (async () => jsonResponse({ profile: null, counts: { followers: null } })) as typeof fetch;
    const provider = createLiveProvider({
      baseUrl: "https://frontend-api-v3.pump.fun",
      pageLimit: 10,
      maxPages: 1,
      fetchImpl,
    });
    await expect(provider.fetchProfile(wallet)).rejects.toThrow(/not a Pump.fun profile/i);
  });

  it("blocks a non-relative path", async () => {
    await expect(
      pumpGet({
        baseUrl: "https://frontend-api-v3.pump.fun",
        path: "https://evil.example/users",
        fetchImpl: (async () => jsonResponse({})) as typeof fetch,
        retries: 1,
      }),
    ).rejects.toThrow(/blocked/i);
  });
});

describe("submissions", () => {
  beforeEach(() => resetRateLimits());

  it("stores one profile and replaces points on refresh", async () => {
    let reads = 0;
    const provider = {
      mode: "live" as const,
      async fetchProfile() {
        reads += 1;
        const likes = reads === 1 ? 2 : 5;
        return {
          profile: {
            pumpUserId: "user-1",
            username: "alpha",
            canonicalWallet: wallet,
            profileImage: null,
            bio: null,
            banned: false,
            kind: "person",
          },
          metrics: {
            followers: { status: "verified" as const, value: 10, source: "s", detail: "d" },
            callouts: { status: "verified" as const, value: 1, source: "s", detail: "d" },
            likes: { status: "verified" as const, value: likes, source: "s", detail: "d" },
            reposts: { status: "unavailable" as const, value: null, source: "s", detail: "d" },
          },
          callouts: [],
          upstreamComputedAt: null,
          dataMode: "live" as const,
          failures: [],
        };
      },
    };
    const repo = new MemoryStore();
    const first = await submitProfile({ repo, provider, raw: "alpha", ip: "203.0.113.5" });
    const second = await submitProfile({ repo, provider, raw: "alpha", ip: "203.0.113.5", force: true });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.currentPoints).toBe(10 + 5 + 5);
    expect(second.user.currentPoints).not.toBe((10 + 5 + 2) + (10 + 5 + 5));
    const users = await repo.listUsers("", 1, 10);
    expect(users.total).toBe(1);
  });

  it("serializes concurrent submissions into one profile", async () => {
    const provider = {
      mode: "live" as const,
      async fetchProfile() {
        return {
          profile: {
            pumpUserId: "user-concurrent",
            username: "concurrent",
            canonicalWallet: wallet,
            profileImage: null,
            bio: null,
            banned: false,
            kind: "person",
          },
          metrics: {
            followers: { status: "verified" as const, value: 3, source: "s", detail: "d" },
            callouts: { status: "verified" as const, value: 0, source: "s", detail: "d" },
            likes: { status: "verified" as const, value: 0, source: "s", detail: "d" },
            reposts: { status: "verified" as const, value: 0, source: "s", detail: "d" },
          },
          callouts: [],
          upstreamComputedAt: null,
          dataMode: "live" as const,
          failures: [],
        };
      },
    };
    const repo = new MemoryStore();
    await Promise.all([
      submitProfile({ repo, provider, raw: "concurrent", ip: "203.0.113.9", force: true }),
      submitProfile({ repo, provider, raw: "concurrent", ip: "203.0.113.9", force: true }),
    ]);
    const users = await repo.listUsers("", 1, 10);
    expect(users.total).toBe(1);
    expect(users.rows[0].currentPoints).toBe(3);
  });

  it("rate limits repeated submissions", async () => {
    const provider = {
      mode: "live" as const,
      async fetchProfile() {
        throw new ProfileNotFoundError();
      },
    };
    const repo = new MemoryStore();
    for (let i = 0; i < 8; i += 1) {
      await expect(submitProfile({ repo, provider, raw: `name${i}`, ip: "203.0.113.8" })).rejects.toThrow(/profile was found/i);
    }
    await expect(submitProfile({ repo, provider, raw: "name9", ip: "203.0.113.8" })).rejects.toThrow(/too many/i);
  });
});

describe("claims", () => {
  it("verifies a signature once and rejects a second claim", async () => {
    const pair = nacl.sign.keyPair();
    const address = bs58.encode(pair.publicKey);
    const repo = new MemoryStore();
    const campaign = await repo.getCampaign();
    await repo.saveCampaign({ ...campaign, status: "claim_open" }, "test");
    await repo.saveVerifiedStats({
      submittedRaw: address,
      normalized: address,
      ipHash: "hash",
      user: {
        pumpUserId: "pump-1",
        username: "signer",
        canonicalWallet: address,
        profileImage: null,
        bio: null,
        banned: false,
        dataMode: "live",
      },
      snapshot: {
        dataMode: "live",
        followers: 10,
        followersStatus: "verified",
        followersSource: "s",
        followersDetail: "d",
        callouts: 0,
        calloutsStatus: "verified",
        calloutsSource: "s",
        calloutsDetail: "d",
        likes: 0,
        likesStatus: "verified",
        likesSource: "s",
        likesDetail: "d",
        reposts: 0,
        repostsStatus: "verified",
        repostsSource: "s",
        repostsDetail: "d",
        upstreamComputedAt: null,
        pointsTotal: 10,
        pointsBreakdown: calculatePoints(
          {
            followers: { status: "verified", value: 10, source: "s", detail: "d" },
            callouts: { status: "verified", value: 0, source: "s", detail: "d" },
            likes: { status: "verified", value: 0, source: "s", detail: "d" },
            reposts: { status: "verified", value: 0, source: "s", detail: "d" },
          },
          DEFAULT_SETTINGS,
        ),
        formulaVersion: 1,
      },
      callouts: [],
      breakdown: calculatePoints(
        {
          followers: { status: "verified", value: 10, source: "s", detail: "d" },
          callouts: { status: "verified", value: 0, source: "s", detail: "d" },
          likes: { status: "verified", value: 0, source: "s", detail: "d" },
          reposts: { status: "verified", value: 0, source: "s", detail: "d" },
        },
        DEFAULT_SETTINGS,
      ),
      settings: DEFAULT_SETTINGS,
    });
    const user = await repo.findUserByWallet(address);
    const nonce = "nonce-1";
    const message = buildClaimMessage({
      domain: "Callout Drop",
      username: "signer",
      pumpUserId: "pump-1",
      wallet: address,
      campaignId: campaign.id,
      nonce,
    });
    const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), pair.secretKey));
    expect(verifyWalletSignature(message, signature, address)).toBe(true);
    expect(verifyWalletSignature(message, signature, wallet)).toBe(false);
    await repo.createNonce({
      nonce,
      wallet: address,
      userId: user!.id,
      campaignId: campaign.id,
      message,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      usedAt: null,
    });
    const registrationOnly: Distributor = {
      enabled: false,
      async submit() {
        return { status: "registered", txSignature: null, failureReason: null };
      },
    };
    const claim = await registerClaim({
      repo,
      distributor: registrationOnly,
      userId: user!.id,
      wallet: address,
      nonce,
      signature,
    });
    expect(claim.status).toBe("registered");
    expect(claim.txSignature).toBeNull();
    await repo.createNonce({
      nonce: "nonce-2",
      wallet: address,
      userId: user!.id,
      campaignId: campaign.id,
      message,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      usedAt: null,
    });
    await expect(
      registerClaim({
        repo,
        distributor: registrationOnly,
        userId: user!.id,
        wallet: address,
        nonce: "nonce-2",
        signature,
      }),
    ).rejects.toThrow(/already registered/i);
  });

  it("records a pending distributor result when distribution is enabled on the distributor", async () => {
    const pair = nacl.sign.keyPair();
    const address = bs58.encode(pair.publicKey);
    const repo = new MemoryStore();
    const campaign = await repo.getCampaign();
    await repo.saveCampaign({ ...campaign, status: "claim_open", distributionEnabled: true }, "test");
    await repo.saveVerifiedStats({
      submittedRaw: address,
      normalized: address,
      ipHash: "hash",
      user: {
        pumpUserId: "pump-2",
        username: "pending",
        canonicalWallet: address,
        profileImage: null,
        bio: null,
        banned: false,
        dataMode: "live",
      },
      snapshot: emptySnapshot(10),
      callouts: [],
      breakdown: pointsFor(10),
      settings: DEFAULT_SETTINGS,
    });
    const user = (await repo.findUserByWallet(address))!;
    const nonce = "nonce-pending";
    const message = buildClaimMessage({
      domain: "Callout Drop",
      username: "pending",
      pumpUserId: "pump-2",
      wallet: address,
      campaignId: campaign.id,
      nonce,
    });
    await repo.createNonce({
      nonce,
      wallet: address,
      userId: user.id,
      campaignId: campaign.id,
      message,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      usedAt: null,
    });
    const pending: Distributor = {
      enabled: true,
      async submit() {
        return { status: "pending_distribution", txSignature: null, failureReason: null };
      },
    };
    const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), pair.secretKey));
    const claim = await registerClaim({
      repo,
      distributor: pending,
      userId: user.id,
      wallet: address,
      nonce,
      signature,
    });
    expect(claim.status).toBe("pending_distribution");
  });
});

describe("security helpers", () => {
  it("blocks cross-origin mutations", () => {
    const request = new Request("https://airdropme.example/api/profiles", {
      headers: { origin: "https://evil.example", host: "airdropme.example" },
    });
    expect(() => assertSameOrigin(request)).toThrow(/cross-origin/i);
  });

  it("rate limits a key", () => {
    resetRateLimits();
    expect(rateLimit("k", 2, 10_000).ok).toBe(true);
    expect(rateLimit("k", 2, 10_000).ok).toBe(true);
    expect(rateLimit("k", 2, 10_000).ok).toBe(false);
  });

  it("migration defines the required tables", () => {
    const sql = readFileSync("supabase/migrations/0001_init.sql", "utf8");
    for (const table of [
      "users",
      "submitted_profiles",
      "profile_statistics_snapshots",
      "callout_records",
      "point_ledger",
      "leaderboard_cache",
      "airdrop_campaigns",
      "airdrop_claims",
      "admin_settings",
      "audit_logs",
    ]) {
      expect(sql).toContain(table);
    }
  });
});

describe("eligibility", () => {
  it("uses the claim rules and does not mark a closed campaign as eligible", () => {
    expect(
      qualification({
        hasSnapshot: true,
        points: 10,
        minPoints: 1,
        banned: false,
        flagged: false,
        claimStatus: "upcoming",
      }).status,
    ).toBe("claim_coming_soon");
    expect(
      qualification({
        hasSnapshot: true,
        points: 0,
        minPoints: 1,
        banned: false,
        flagged: false,
        claimStatus: "claim_open",
      }).status,
    ).toBe("not_eligible");
    expect(
      qualification({
        hasSnapshot: false,
        points: 10,
        minPoints: 1,
        banned: false,
        flagged: false,
        claimStatus: "claim_open",
      }).status,
    ).toBe("unavailable");
    expect(
      qualification({
        hasSnapshot: true,
        points: 10,
        minPoints: 1,
        banned: false,
        flagged: false,
        claimStatus: "claim_open",
      }).status,
    ).toBe("eligible");
  });
});

describe("missing database", () => {
  beforeEach(() => resetRateLimits());

  it("loads a public profile that is not already stored", async () => {
    const repo = new MemoryStore();
    const view = await viewProfile(repo, "demoalpha", { provider: demoProvider, ip: "203.0.113.20" });
    expect(view.user.username).toBe("DEMO_alpha");
    expect(view.user.currentPoints).toBe(182);
    expect(view.snapshot?.followers).toBe(120);
    const again = await viewProfile(new MemoryStore(), "demoalpha", { provider: demoProvider, ip: "203.0.113.21" });
    expect(again.user.username).toBe("DEMO_alpha");
  });

  it("still rejects an unknown internal id", async () => {
    await expect(viewProfile(new MemoryStore(), "11111111-1111-4111-8111-111111111111", { provider: demoProvider })).rejects.toBeInstanceOf(
      ServiceError,
    );
  });

  it("reloads profiles from the file store after a new process", async () => {
    const filePath = join(mkdtempSync(join(tmpdir(), "airdropme-")), "store.json");
    const first = new FileMemoryStore(filePath);
    await viewProfile(first, "demoalpha", { provider: demoProvider, ip: "203.0.113.22" });
    const second = new FileMemoryStore(filePath);
    const stored = await second.findUserByUsername("DEMO_alpha");
    expect(stored?.currentPoints).toBe(182);
    const board = await second.leaderboard("", 1, 10);
    expect(board.total).toBe(1);
  });

  it("reads Postgres URLs from the host variable names", () => {
    expect(resolveDatabaseUrl({ POSTGRES_URL: "postgres://db.example/app" })).toBe("postgres://db.example/app");
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgres://primary", POSTGRES_URL: "postgres://other" })).toBe("postgres://primary");
    expect(resolveDatabaseUrl({})).toBe("");
    const config = readConfig({
      PGHOST: "db.internal",
      PGUSER: "airdrop",
      PGPASSWORD: "p@ss",
      PGDATABASE: "airdropme",
    });
    expect(config.DATABASE_URL).toBe("postgresql://airdrop:p%40ss@db.internal:5432/airdropme");
  });

  it("connects the Firebase API from env", () => {
    const connected = readConfig({
      FIREBASE_PROJECT_ID: "callout-drop",
      FIREBASE_API_KEY: "test-key",
    });
    expect(connected.firebaseConnected).toBe(true);
    expect(connected.firebase).toMatchObject({
      projectId: "callout-drop",
      apiKey: "test-key",
      base: "https://firestore.googleapis.com",
    });
    const missing = readConfig({});
    expect(missing.firebase).toBeNull();
    expect(missing.firebaseConnected).toBe(false);
  });
});

function pointsFor(followers: number) {
  return calculatePoints(
    {
      followers: { status: "verified", value: followers, source: "s", detail: "d" },
      callouts: { status: "verified", value: 0, source: "s", detail: "d" },
      likes: { status: "verified", value: 0, source: "s", detail: "d" },
      reposts: { status: "verified", value: 0, source: "s", detail: "d" },
    },
    DEFAULT_SETTINGS,
  );
}

function emptySnapshot(points: number) {
  const breakdown = pointsFor(points);
  return {
    dataMode: "live" as const,
    followers: points,
    followersStatus: "verified" as const,
    followersSource: "s",
    followersDetail: "d",
    callouts: 0,
    calloutsStatus: "verified" as const,
    calloutsSource: "s",
    calloutsDetail: "d",
    likes: 0,
    likesStatus: "verified" as const,
    likesSource: "s",
    likesDetail: "d",
    reposts: 0,
    repostsStatus: "verified" as const,
    repostsSource: "s",
    repostsDetail: "d",
    upstreamComputedAt: null,
    pointsTotal: breakdown.total,
    pointsBreakdown: breakdown,
    formulaVersion: 1,
  };
}
