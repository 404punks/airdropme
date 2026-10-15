import type { ReferralHistoryRecord, ReferralLinkRecord } from "@/server/referrals/logic";
import type { ReferralRepository } from "@/server/referrals/repository";

export class MemoryReferralStore implements ReferralRepository {
  readonly history: ReferralHistoryRecord[] = [];
  readonly links: ReferralLinkRecord[] = [];

  async getHistory(id: string): Promise<ReferralHistoryRecord | null> {
    return this.history.find((row) => row.id === id) ?? null;
  }

  async createHistory(record: ReferralHistoryRecord): Promise<"created" | "exists"> {
    if (this.history.some((row) => row.id === record.id)) return "exists";
    this.history.push(record);
    return "created";
  }

  async listHistory(): Promise<ReferralHistoryRecord[]> {
    return [...this.history];
  }

  async saveLink(record: ReferralLinkRecord): Promise<void> {
    const index = this.links.findIndex((row) => row.username.toLowerCase() === record.username.toLowerCase());
    if (index === -1) {
      this.links.push(record);
      return;
    }
    const current = this.links[index];
    this.links[index] = {
      ...current,
      username: record.username,
      profileImage: record.profileImage,
      link: record.link,
      domain: record.domain,
    };
  }

  async listLinks(): Promise<ReferralLinkRecord[]> {
    return [...this.links];
  }
}
