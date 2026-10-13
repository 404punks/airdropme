import { randomUUID } from "node:crypto";
import { calculatePoints, DEFAULT_SETTINGS, type ScoringSettings } from "@/server/points/calculate";
import type { NormalizedCallout } from "@/server/pumpfun/types";
import type {
  AuditRecord,
  CampaignRecord,
  ClaimRecord,
  FailureRecord,
  LeaderboardRow,
  NonceRecord,
  Repository,
  SaveStatsInput,
  SnapshotRecord,
  SubmissionRecord,
  UserRecord,
} from "@/server/db/types";

function nowIso(): string {
  return new Date().toISOString();
}

function defaultCampaign(): CampaignRecord {
  return {
    id: "campaign_default",
    name: "Community score campaign",
    status: "upcoming",
    startsAt: null,
    endsAt: null,
    claimStartsAt: null,
    claimEndsAt: null,
    tokenSymbol: null,
    totalAllocation: null,
    funded: false,
    minPoints: 1,
    description:
      "Points rank public Pump.fun activity for this campaign. No token allocation is configured or funded, and connecting a wallet only registers a claim request.",
    distributionEnabled: false,
    updatedAt: nowIso(),
  };
}

export interface MemoryState {
  settings: ScoringSettings;
  campaign: CampaignRecord;
  users: UserRecord[];
  snapshots: SnapshotRecord[];
  callouts: Array<[string, NormalizedCallout[]]>;
  submissions: SubmissionRecord[];
  claims: ClaimRecord[];
  nonces: NonceRecord[];
  failures: FailureRecord[];
  audits: AuditRecord[];
}

export class MemoryStore implements Repository {
  kind = "memory" as const;
  protected canPersist = true;
  private settings: ScoringSettings = { ...DEFAULT_SETTINGS };
  private campaign: CampaignRecord = defaultCampaign();
  private users = new Map<string, UserRecord>();
  private snapshots: SnapshotRecord[] = [];
  private callouts = new Map<string, NormalizedCallout[]>();
  private submissions: SubmissionRecord[] = [];
  private claims: ClaimRecord[] = [];
  private nonces = new Map<string, NonceRecord>();
  private failures: FailureRecord[] = [];
  private audits: AuditRecord[] = [];
  private board: LeaderboardRow[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private depth = 0;

  async transaction<T>(work: (repo: Repository) => Promise<T>): Promise<T> {
    if (this.depth > 0) return work(this);
    const run = this.queue.then(async () => {
      this.depth += 1;
      try {
        return await work(this);
      } finally {
        this.depth -= 1;
      }
    });
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  protected persistHook(): void {}

  exportState(): MemoryState {
    return {
      settings: { ...this.settings },
      campaign: { ...this.campaign },
      users: [...this.users.values()],
      snapshots: this.snapshots.map((row) => ({ ...row })),
      callouts: [...this.callouts.entries()],
      submissions: [...this.submissions],
      claims: [...this.claims],
      nonces: [...this.nonces.values()],
      failures: [...this.failures],
      audits: [...this.audits],
    };
  }

  importState(state: MemoryState): void {
    this.canPersist = false;
    try {
      this.settings = { ...DEFAULT_SETTINGS, ...state.settings };
      this.campaign = { ...state.campaign };
      this.users = new Map(state.users.map((user) => [user.id, user]));
      this.snapshots = [...state.snapshots];
      this.callouts = new Map(state.callouts);
      this.submissions = [...state.submissions];
      this.claims = [...state.claims];
      this.nonces = new Map(state.nonces.map((nonce) => [nonce.nonce, nonce]));
      this.failures = [...state.failures];
      this.audits = [...state.audits];
      this.rebuild();
    } finally {
      this.canPersist = true;
    }
  }

  async getSettings(): Promise<ScoringSettings> {
    return { ...this.settings };
  }

  async saveSettings(settings: ScoringSettings, actor: string): Promise<ScoringSettings> {
    this.settings = { ...settings };
    await this.audit(actor, "settings.update", "admin_settings", { formulaVersion: settings.formulaVersion });
    return { ...this.settings };
  }

  async getCampaign(): Promise<CampaignRecord> {
    return { ...this.campaign };
  }

  async saveCampaign(campaign: CampaignRecord, actor: string): Promise<CampaignRecord> {
    this.campaign = { ...campaign, updatedAt: nowIso() };
    await this.audit(actor, "campaign.update", campaign.id, { status: campaign.status });
    return { ...this.campaign };
  }

  async findUserByPumpId(pumpUserId: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.pumpUserId === pumpUserId) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async findUserByUsername(username: string): Promise<UserRecord | null> {
    const needle = username.toLowerCase();
    return [...this.users.values()].find((user) => user.username?.toLowerCase() === needle) ?? null;
  }

  async findUserByWallet(wallet: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.canonicalWallet === wallet) ?? null;
  }

  async listUsers(query: string, page: number, pageSize: number): Promise<{ rows: UserRecord[]; total: number }> {
    const needle = query.trim().toLowerCase();
    const filtered = [...this.users.values()]
      .filter((user) => {
        if (!needle) return true;
        return [user.username, user.canonicalWallet, user.pumpUserId, user.id].some((value) =>
          value?.toLowerCase().includes(needle),
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = Math.max(0, (page - 1) * pageSize);
    return { rows: filtered.slice(start, start + pageSize), total: filtered.length };
  }

  async submissionCount(ipHash: string, sinceIso: string): Promise<number> {
    return this.submissions.filter((row) => row.ipHash === ipHash && row.createdAt >= sinceIso).length;
  }

  async saveVerifiedStats(input: SaveStatsInput): Promise<{ user: UserRecord; snapshot: SnapshotRecord; created: boolean }> {
    return this.transaction(async () => {
      const existing = await this.findUserByPumpId(input.user.pumpUserId);
      const timestamp = nowIso();
      const created = !existing;
      const user: UserRecord = {
        id: existing?.id ?? randomUUID(),
        pumpUserId: input.user.pumpUserId,
        username: input.user.username,
        canonicalWallet: input.user.canonicalWallet,
        profileImage: input.user.profileImage,
        bio: input.user.bio,
        banned: input.user.banned,
        flagged: Boolean(existing?.flagged || input.user.flagged),
        flagReason: input.user.flagReason ?? existing?.flagReason ?? null,
        dataMode: input.user.dataMode,
        currentPoints: input.snapshot.pointsTotal,
        formulaVersion: input.breakdown.formulaVersion,
        lastFetchedAt: timestamp,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      this.users.set(user.id, user);
      const snapshot: SnapshotRecord = {
        ...input.snapshot,
        id: randomUUID(),
        userId: user.id,
        fetchedAt: timestamp,
      };
      this.snapshots.push(snapshot);
      this.callouts.set(snapshot.id, input.callouts);
      this.submissions.push({
        id: randomUUID(),
        userId: user.id,
        submittedRaw: input.submittedRaw,
        normalized: input.normalized,
        ipHash: input.ipHash,
        createdAt: timestamp,
      });
      const idempotencyKey = `${user.id}:${snapshot.id}:${input.breakdown.formulaVersion}`;
      if (!this.audits.some((row) => row.metadata.idempotencyKey === idempotencyKey)) {
        await this.audit("system", "points.calculate", user.id, {
          idempotencyKey,
          total: input.breakdown.total,
          formulaVersion: input.breakdown.formulaVersion,
        });
      }
      await this.rebuild();
      return { user, snapshot, created };
    });
  }

  async latestSnapshot(userId: string): Promise<SnapshotRecord | null> {
    const rows = this.snapshots.filter((row) => row.userId === userId);
    return rows.at(-1) ?? null;
  }

  async listCallouts(snapshotId: string): Promise<NormalizedCallout[]> {
    return this.callouts.get(snapshotId) ?? [];
  }

  async leaderboard(query: string, page: number, pageSize: number): Promise<{ rows: LeaderboardRow[]; total: number }> {
    const needle = query.trim().toLowerCase();
    const filtered = this.board.filter((row) => {
      if (!needle) return true;
      return [row.username, row.canonicalWallet, row.pumpUserId].some((value) => value?.toLowerCase().includes(needle));
    });
    const ranked = filtered.map((row, index) => ({ ...row, rank: index + 1 }));
    const start = Math.max(0, (page - 1) * pageSize);
    return { rows: ranked.slice(start, start + pageSize), total: ranked.length };
  }

  async recalculateAll(settings: ScoringSettings, actor: string): Promise<number> {
    return this.transaction(async () => {
      let count = 0;
      for (const user of this.users.values()) {
        const snapshot = await this.latestSnapshot(user.id);
        if (!snapshot || user.flagged || user.banned) continue;
        const breakdown = calculatePoints(
          {
            followers: { status: snapshot.followersStatus, value: snapshot.followers, source: snapshot.followersSource, detail: snapshot.followersDetail },
            callouts: { status: snapshot.calloutsStatus, value: snapshot.callouts, source: snapshot.calloutsSource, detail: snapshot.calloutsDetail },
            likes: { status: snapshot.likesStatus, value: snapshot.likes, source: snapshot.likesSource, detail: snapshot.likesDetail },
            reposts: { status: snapshot.repostsStatus, value: snapshot.reposts, source: snapshot.repostsSource, detail: snapshot.repostsDetail },
          },
          settings,
        );
        user.currentPoints = breakdown.total;
        user.formulaVersion = settings.formulaVersion;
        user.updatedAt = nowIso();
        snapshot.pointsTotal = breakdown.total;
        snapshot.pointsBreakdown = breakdown;
        snapshot.formulaVersion = settings.formulaVersion;
        count += 1;
      }
      await this.rebuild();
      await this.audit(actor, "points.recalculate", "point_ledger", { count, formulaVersion: settings.formulaVersion });
      return count;
    });
  }

  async setFlag(userId: string, flagged: boolean, reason: string | null, actor: string): Promise<UserRecord> {
    const user = this.users.get(userId);
    if (!user) throw new Error("Profile not found.");
    user.flagged = flagged;
    user.flagReason = reason;
    user.updatedAt = nowIso();
    await this.rebuild();
    await this.audit(actor, flagged ? "profile.flag" : "profile.unflag", userId, { reason });
    return user;
  }

  async createNonce(nonce: NonceRecord): Promise<void> {
    this.nonces.set(nonce.nonce, nonce);
    this.persistHook();
  }

  async consumeNonce(nonce: string, wallet: string): Promise<NonceRecord | null> {
    return this.transaction(async () => {
      const row = this.nonces.get(nonce);
      if (!row || row.wallet !== wallet || row.usedAt || row.expiresAt < nowIso()) return null;
      row.usedAt = nowIso();
      this.persistHook();
      return { ...row };
    });
  }

  async findClaimByUser(campaignId: string, userId: string): Promise<ClaimRecord | null> {
    return this.claims.find((claim) => claim.campaignId === campaignId && claim.userId === userId) ?? null;
  }

  async findClaimByWallet(campaignId: string, wallet: string): Promise<ClaimRecord | null> {
    return this.claims.find((claim) => claim.campaignId === campaignId && claim.wallet === wallet) ?? null;
  }

  async insertClaim(claim: ClaimRecord): Promise<ClaimRecord> {
    return this.transaction(async () => {
      const duplicateUser = await this.findClaimByUser(claim.campaignId, claim.userId);
      const duplicateWallet = await this.findClaimByWallet(claim.campaignId, claim.wallet);
      if (duplicateUser || duplicateWallet) {
        throw new Error("A claim already exists for this profile or wallet.");
      }
      this.claims.push(claim);
      await this.audit("system", "claim.create", claim.id, { status: claim.status, wallet: claim.wallet });
      return claim;
    });
  }

  async listClaims(): Promise<ClaimRecord[]> {
    return [...this.claims].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async insertFailures(rows: Array<Omit<FailureRecord, "id" | "createdAt">>): Promise<void> {
    for (const row of rows) {
      this.failures.push({ ...row, id: randomUUID(), createdAt: nowIso() });
    }
    if (rows.length) this.persistHook();
  }

  async listFailures(limit: number): Promise<FailureRecord[]> {
    return [...this.failures].reverse().slice(0, limit);
  }

  async audit(actor: string, action: string, target: string | null, metadata: Record<string, unknown> = {}): Promise<void> {
    this.audits.push({ id: randomUUID(), actor, action, target, metadata, createdAt: nowIso() });
    this.persistHook();
  }

  async listAudit(limit: number): Promise<AuditRecord[]> {
    return [...this.audits].reverse().slice(0, limit);
  }

  async counts(): Promise<{ users: number; snapshots: number; claims: number; failures: number }> {
    return {
      users: this.users.size,
      snapshots: this.snapshots.length,
      claims: this.claims.length,
      failures: this.failures.length,
    };
  }

  private rebuild(): void {
    const rows: LeaderboardRow[] = [];
    for (const user of this.users.values()) {
      if (user.flagged || user.banned) continue;
      const snapshot = this.snapshots.filter((row) => row.userId === user.id).at(-1);
      if (!snapshot) continue;
      rows.push({
        rank: 0,
        userId: user.id,
        pumpUserId: user.pumpUserId,
        username: user.username,
        canonicalWallet: user.canonicalWallet,
        followers: snapshot.followers,
        callouts: snapshot.callouts,
        likes: snapshot.likes,
        reposts: snapshot.reposts,
        followersStatus: snapshot.followersStatus,
        calloutsStatus: snapshot.calloutsStatus,
        likesStatus: snapshot.likesStatus,
        repostsStatus: snapshot.repostsStatus,
        points: user.currentPoints,
        dataMode: user.dataMode,
        lastFetchedAt: user.lastFetchedAt,
      });
    }
    rows.sort((a, b) => b.points - a.points || (a.lastFetchedAt ?? "").localeCompare(b.lastFetchedAt ?? ""));
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });
    this.board = rows;
    this.persistHook();
  }
}
