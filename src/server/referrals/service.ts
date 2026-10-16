import {
  canAttachReferral,
  planReferral,
  pointsFromHistory,
  referralLeaderboard,
  referralUrl,
  type ReferralBoardRow,
  type ReferralHistoryRecord,
  type ReferralLinkRecord,
} from "@/server/referrals/logic";
import { config } from "@/server/config";
import { getStore } from "@/server/db";
import { FirestoreReferralStore } from "@/server/referrals/firestore";
import type { ReferralRepository } from "@/server/referrals/repository";

export interface ReferralGrant {
  status: "recorded" | "exists" | "rejected" | "skipped";
  reason?: string;
}

let cachedStore: ReferralRepository | null = null;

export function firebaseConfigured(): boolean {
  return config.firebaseConnected;
}

export function getReferralRepository(): ReferralRepository | null {
  if (!config.firebase) return null;
  if (!cachedStore) cachedStore = new FirestoreReferralStore(config.firebase);
  return cachedStore;
}

export function resetReferralRepository(): void {
  cachedStore = null;
}

export async function applyReferral(
  store: ReferralRepository,
  input: {
    referrerUsername: string;
    referredUsername: string;
    referrerImage?: string | null;
    referredImage?: string | null;
    origin: string;
    createdAt: string;
    now?: number;
    referredRewardPoints?: number;
  },
): Promise<ReferralGrant> {
  if (!canAttachReferral(input.createdAt, input.now)) {
    return { status: "skipped", reason: "This profile is already registered." };
  }
  const plan = planReferral(input);
  if (!plan.ok) return { status: "rejected", reason: plan.reason };
  const existing = await store.getHistory(plan.history.id);
  if (existing) return { status: "exists" };
  const created = await store.createHistory(plan.history);
  if (created === "exists") return { status: "exists" };
  await store.saveLink(plan.referrerLink);
  await store.saveLink(plan.referredLink);
  return { status: "recorded" };
}

export async function publishReferralLink(
  store: ReferralRepository,
  input: { username: string; profileImage: string | null; origin: string },
): Promise<string> {
  const link = referralUrl(input.origin, input.username);
  const domain = input.origin.replace(/\/$/, "");
  const record: ReferralLinkRecord = {
    username: input.username,
    profileImage: input.profileImage,
    link,
    domain,
    createdAt: new Date().toISOString(),
  };
  await store.saveLink(record);
  return link;
}

export async function loadReferralState(store: ReferralRepository): Promise<{
  history: ReferralHistoryRecord[];
  links: ReferralLinkRecord[];
  board: ReferralBoardRow[];
}> {
  const [history, links] = await Promise.all([store.listHistory(), store.listLinks()]);
  return { history, links, board: referralLeaderboard(history, links) };
}

export function summaryFor(username: string, history: ReferralHistoryRecord[]) {
  return pointsFromHistory(username, history);
}

export async function referralRewardPoints(usernames: string[]): Promise<Map<string, number>> {
  const rewards = new Map<string, number>();
  const names = [...new Set(usernames.map((name) => name.trim()).filter(Boolean))];
  if (!names.length) return rewards;
  const repo = getStore();
  await Promise.all(
    names.map(async (name) => {
      const user = await repo.findUserByUsername(name);
      if (user) rewards.set(name.toLowerCase(), user.currentPoints);
    }),
  );
  return rewards;
}
