import { describe, expect, it, vi } from "vitest";
import { profileNotice } from "@/lib/notices";
import { referrerFromCookieHeader } from "@/server/referrals/cookie";
import { FirestoreReferralStore, type FirebaseConfig } from "@/server/referrals/firestore";
import {
  canAttachReferral,
  planReferral,
  pointsFromHistory,
  referralLeaderboard,
  referralUrl,
  siteOriginFromHost,
  REFERRAL_LEADERBOARD_LIMIT,
  REFERRAL_POINTS,
  type ReferralHistoryRecord,
} from "@/server/referrals/logic";
import { MemoryReferralStore } from "@/server/referrals/memory";
import { applyReferral } from "@/server/referrals/service";

const origin = "https://www.calloutdrop.app";

describe("referral rules", () => {
  it("builds a username link on the site domain", () => {
    expect(referralUrl(origin, "Chjokka")).toBe("https://www.calloutdrop.app/r/Chjokka");
    expect(siteOriginFromHost("preview.example.com")).toBe(origin);
    expect(siteOriginFromHost("www.ansemmasx.fun")).toBe(origin);
    expect(siteOriginFromHost("localhost:3000")).toBe(origin);
    expect(siteOriginFromHost("www.calloutdrop.app")).toBe(origin);
    expect(siteOriginFromHost("localhost:3000", "https://www.ansemmasx.fun")).toBe(origin);
    expect(siteOriginFromHost("localhost:3000", "https://staging.example.com")).toBe("https://staging.example.com");
  });

  it("pays 170 points to both sides once", async () => {
    const store = new MemoryReferralStore();
    const now = Date.parse("2026-10-15T12:00:00.000Z");
    const first = await applyReferral(store, {
      referrerUsername: "DEMO_alpha",
      referredUsername: "DEMO_beta",
      origin,
      createdAt: new Date(now).toISOString(),
      now,
    });
    const second = await applyReferral(store, {
      referrerUsername: "DEMO_alpha",
      referredUsername: "DEMO_beta",
      origin,
      createdAt: new Date(now).toISOString(),
      now,
    });
    expect(first.status).toBe("recorded");
    expect(second.status).toBe("exists");
    expect(store.history).toHaveLength(1);
    expect(store.history[0].referrerPoints).toBe(REFERRAL_POINTS);
    expect(store.history[0].referredPoints).toBe(REFERRAL_POINTS);
    expect(pointsFromHistory("DEMO_alpha", store.history).points).toBe(170);
    expect(pointsFromHistory("DEMO_beta", store.history).points).toBe(170);
    expect(store.links.map((link) => link.link)).toContain(`${origin}/r/DEMO_alpha`);
  });

  it("rejects a self referral and an old account", async () => {
    const store = new MemoryReferralStore();
    const now = Date.parse("2026-10-15T12:00:00.000Z");
    const self = await applyReferral(store, {
      referrerUsername: "DEMO_alpha",
      referredUsername: "demo_alpha",
      origin,
      createdAt: new Date(now).toISOString(),
      now,
    });
    expect(self.status).toBe("rejected");
    expect(store.history).toHaveLength(0);
    expect(canAttachReferral(new Date(now - 16 * 60 * 1000).toISOString(), now)).toBe(false);
    const stale = await applyReferral(store, {
      referrerUsername: "DEMO_alpha",
      referredUsername: "DEMO_beta",
      origin,
      createdAt: new Date(now - 16 * 60 * 1000).toISOString(),
      now,
    });
    expect(stale.status).toBe("skipped");
  });

  it("ranks the leaderboard by referrals, logo, username, and domain link", () => {
    const planA = planReferral({
      referrerUsername: "Alpha",
      referredUsername: "Beta",
      referrerImage: "https://cdn.example/a.png",
      origin,
      createdAt: "2026-10-15T00:00:00.000Z",
    });
    const planB = planReferral({
      referrerUsername: "Alpha",
      referredUsername: "Gamma",
      origin,
      createdAt: "2026-10-15T00:00:00.000Z",
    });
    const planC = planReferral({
      referrerUsername: "Zed",
      referredUsername: "BetaTwo",
      origin,
      createdAt: "2026-10-15T00:00:00.000Z",
    });
    if (!planA.ok || !planB.ok || !planC.ok) throw new Error("plans should be valid");
    const board = referralLeaderboard(
      [planA.history, planB.history, planC.history],
      [{ username: "Alpha", profileImage: "https://cdn.example/a.png", link: referralUrl(origin, "Alpha"), domain: origin, createdAt: "2026-10-15T00:00:00.000Z" }],
    );
    expect(board.map((row) => [row.username, row.referrals, row.points, row.domain, row.link])).toEqual([
      ["Alpha", 2, 340, origin, `${origin}/r/Alpha`],
      ["Zed", 1, 170, origin, `${origin}/r/Zed`],
    ]);
    expect(board[0].profileImage).toBe("https://cdn.example/a.png");
    expect(board.find((row) => row.username === "Beta")).toBeUndefined();
  });

  it("counts each joined account once and keeps the top 100 referrers", () => {
    const createdAt = "2026-10-15T00:00:00.000Z";
    const rows: ReferralHistoryRecord[] = [];
    for (let index = 0; index < 101; index += 1) {
      const plan = planReferral({
        referrerUsername: `User${String(index).padStart(3, "0")}`,
        referredUsername: `Join${index}`,
        origin,
        createdAt,
      });
      if (!plan.ok) throw new Error("plan should be valid");
      rows.push(plan.history, { ...plan.history, id: `${plan.history.id}-duplicate` });
    }
    const extra = planReferral({
      referrerUsername: "User000",
      referredUsername: "JoinExtra",
      referrerImage: "https://cdn.example/top.png",
      origin,
      createdAt,
    });
    if (!extra.ok) throw new Error("plan should be valid");
    rows.push(extra.history);
    const board = referralLeaderboard(rows, [
      {
        username: "User000",
        profileImage: "https://cdn.example/top.png",
        link: referralUrl(origin, "User000"),
        domain: origin,
        createdAt,
      },
    ]);
    expect(REFERRAL_LEADERBOARD_LIMIT).toBe(100);
    expect(board).toHaveLength(100);
    expect(board[0]).toMatchObject({
      username: "User000",
      profileImage: "https://cdn.example/top.png",
      referrals: 2,
      points: 340,
    });
    expect(board.some((row) => row.username === "User100")).toBe(false);
    expect(board[1].referrals).toBe(1);
    expect(board[1].points).toBe(170);
  });

  it("keeps the referral result on the profile notice", () => {
    expect(
      profileNotice(
        "Profile registered from public Pump.fun data. You joined from a referral link. You and your referrer each received 170 PTS. This referral is stored in Firebase and is not deleted.",
      ),
    ).toContain("each received 170 PTS");
  });

  it("reads the referrer cookie and ignores wallets", () => {
    expect(referrerFromCookieHeader("am_ref=Chjokka")).toBe("Chjokka");
    expect(referrerFromCookieHeader("theme=dark; am_ref=DEMO_alpha")).toBe("DEMO_alpha");
    expect(referrerFromCookieHeader("am_ref=11111111111111111111111111111111")).toBeNull();
  });
});

describe("firebase referral api", () => {
  const config: FirebaseConfig = {
    projectId: "ansemmas-pts",
    apiKey: "test-key",
    base: "https://firestore.googleapis.com",
    clientEmail: "",
    privateKey: "",
  };

  it("creates history and links without sending a delete", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (method === "GET" && !url.includes("pageSize=")) {
        return new Response("", { status: 404 });
      }
      if (method === "GET") {
        return Response.json({ documents: [] });
      }
      if (method === "POST" && url.includes("documentId=join_demo_beta")) {
        return Response.json({ name: "projects/ansemmas-pts/databases/(default)/documents/referralHistory/join_demo_beta" });
      }
      if (method === "POST") return Response.json({ name: "projects/ansemmas-pts/databases/(default)/documents/referralLinks/link" });
      return new Response("unexpected", { status: 500 });
    });
    const store = new FirestoreReferralStore(config, fetchImpl);
    const plan = planReferral({
      referrerUsername: "DEMO_alpha",
      referredUsername: "DEMO_beta",
      origin,
      createdAt: "2026-10-15T12:00:00.000Z",
    });
    if (!plan.ok) throw new Error("plan should be valid");
    expect(await store.getHistory(plan.history.id)).toBeNull();
    expect(await store.createHistory(plan.history)).toBe("created");
    await store.saveLink(plan.referrerLink);
    expect(calls.every((call) => call.method !== "DELETE")).toBe(true);
    expect(calls.some((call) => call.method === "POST" && call.url.includes("/referralHistory?") && call.url.includes("key=test-key"))).toBe(true);
    expect(calls.some((call) => call.url.includes("documentId=join_demo_beta"))).toBe(true);
    expect(calls.some((call) => call.url.startsWith("https://firestore.googleapis.com/v1/projects/ansemmas-pts/"))).toBe(true);
  });

  it("keeps an existing history document instead of replacing it", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "POST") return new Response(JSON.stringify({ error: { status: "ALREADY_EXISTS" } }), { status: 409 });
      return Response.json({
        name: "projects/ansemmas-pts/databases/(default)/documents/referralHistory/join_demo_beta",
        fields: {
          referrerUsername: { stringValue: "DEMO_alpha" },
          referrerImage: { nullValue: null },
          referredUsername: { stringValue: "DEMO_beta" },
          referredImage: { nullValue: null },
          referrerPoints: { integerValue: "170" },
          referredPoints: { integerValue: "170" },
          referralLink: { stringValue: "https://www.ansemmasx.fun/r/DEMO_alpha" },
          domain: { stringValue: origin },
          createdAt: { stringValue: "2026-10-15T12:00:00.000Z" },
        },
      });
    });
    const store = new FirestoreReferralStore(config, fetchImpl);
    const plan = planReferral({
      referrerUsername: "Other",
      referredUsername: "DEMO_beta",
      origin,
      createdAt: "2026-10-15T13:00:00.000Z",
    });
    if (!plan.ok) throw new Error("plan should be valid");
    expect(await store.createHistory(plan.history)).toBe("exists");
    const stored = await store.getHistory("join_demo_beta");
    expect(stored?.referrerUsername).toBe("DEMO_alpha");
    expect(stored?.referrerPoints).toBe(170);
  });
});
