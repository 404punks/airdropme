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
import { FirestoreReferralStore, readFirebaseConfig } from "@/server/referrals/firestore";
import type { ReferralRepository } from "@/server/referrals/repository";

export interface ReferralGrant {
  status: "recorded" | "exists" | "rejected" | "skipped";
  reason?: string;
}

let cachedStore: ReferralRepository | null = null;

export function firebaseConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFirebaseConfig(env) != null;
}

export function getReferralRepository(env: NodeJS.ProcessEnv = process.env): ReferralRepository | null {
  const config = readFirebaseConfig(env);
  if (!config) return null;
  if (!cachedStore) cachedStore = new FirestoreReferralStore(config);
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
