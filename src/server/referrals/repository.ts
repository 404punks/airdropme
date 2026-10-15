import type { ReferralHistoryRecord, ReferralLinkRecord } from "@/server/referrals/logic";

export interface ReferralRepository {
  getHistory(id: string): Promise<ReferralHistoryRecord | null>;
  createHistory(record: ReferralHistoryRecord): Promise<"created" | "exists">;
  listHistory(): Promise<ReferralHistoryRecord[]>;
  saveLink(record: ReferralLinkRecord): Promise<void>;
  listLinks(): Promise<ReferralLinkRecord[]>;
}
