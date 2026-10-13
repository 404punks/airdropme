import type { PointsBreakdown, ScoringSettings, MetricStatus } from "@/server/points/calculate";
import type { NormalizedCallout } from "@/server/pumpfun/types";

export interface UserRecord {
  id: string;
  pumpUserId: string;
  username: string | null;
  canonicalWallet: string | null;
  profileImage: string | null;
  bio: string | null;
  banned: boolean;
  flagged: boolean;
  flagReason: string | null;
  dataMode: "live" | "demo";
  currentPoints: number;
  formulaVersion: number;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotRecord {
  id: string;
  userId: string;
  fetchedAt: string;
  dataMode: "live" | "demo";
  followers: number | null;
  followersStatus: MetricStatus;
  followersSource: string;
  followersDetail: string;
  callouts: number | null;
  calloutsStatus: MetricStatus;
  calloutsSource: string;
  calloutsDetail: string;
  likes: number | null;
  likesStatus: MetricStatus;
  likesSource: string;
  likesDetail: string;
  reposts: number | null;
  repostsStatus: MetricStatus;
  repostsSource: string;
  repostsDetail: string;
  upstreamComputedAt: string | null;
  pointsTotal: number;
  pointsBreakdown: PointsBreakdown;
  formulaVersion: number;
}

export interface SubmissionRecord {
  id: string;
  userId: string;
  submittedRaw: string;
  normalized: string;
  ipHash: string;
  createdAt: string;
}

export interface LedgerRecord {
  id: string;
  userId: string;
  snapshotId: string;
  formulaVersion: number;
  total: number;
  breakdown: PointsBreakdown;
  idempotencyKey: string;
  createdAt: string;
}

export type CampaignStatus = "upcoming" | "active" | "claim_open" | "ended" | "paused";

export interface CampaignRecord {
  id: string;
  name: string;
  status: CampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  claimStartsAt: string | null;
  claimEndsAt: string | null;
  tokenSymbol: string | null;
  totalAllocation: string | null;
  funded: boolean;
  minPoints: number;
  description: string;
  distributionEnabled: boolean;
  updatedAt: string;
}

export type ClaimStatus = "registered" | "pending_distribution" | "submitted" | "confirmed" | "failed" | "rejected";

export interface ClaimRecord {
  id: string;
  campaignId: string;
  userId: string;
  wallet: string;
  status: ClaimStatus;
  pointsAtClaim: number;
  walletSignature: string;
  txSignature: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NonceRecord {
  nonce: string;
  wallet: string;
  userId: string;
  campaignId: string;
  message: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface FailureRecord {
  id: string;
  userId: string | null;
  identifier: string;
  endpoint: string;
  statusCode: number | null;
  message: string;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  pumpUserId: string;
  username: string | null;
  canonicalWallet: string | null;
  followers: number | null;
  callouts: number | null;
  likes: number | null;
  reposts: number | null;
  followersStatus: MetricStatus;
  calloutsStatus: MetricStatus;
  likesStatus: MetricStatus;
  repostsStatus: MetricStatus;
  points: number;
  dataMode: "live" | "demo";
  lastFetchedAt: string | null;
}

export interface SaveStatsInput {
  submittedRaw: string;
  normalized: string;
  ipHash: string;
  user: Omit<UserRecord, "id" | "flagged" | "flagReason" | "currentPoints" | "formulaVersion" | "lastFetchedAt" | "createdAt" | "updatedAt"> & {
    flagged?: boolean;
    flagReason?: string | null;
  };
  snapshot: Omit<SnapshotRecord, "id" | "userId" | "fetchedAt">;
  callouts: NormalizedCallout[];
  breakdown: PointsBreakdown;
  settings: ScoringSettings;
}

export interface Repository {
  kind: "memory" | "postgres";
  transaction<T>(work: (repo: Repository) => Promise<T>): Promise<T>;
  getSettings(): Promise<ScoringSettings>;
  saveSettings(settings: ScoringSettings, actor: string): Promise<ScoringSettings>;
  getCampaign(): Promise<CampaignRecord>;
  saveCampaign(campaign: CampaignRecord, actor: string): Promise<CampaignRecord>;
  findUserByPumpId(pumpUserId: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  findUserByUsername(username: string): Promise<UserRecord | null>;
  findUserByWallet(wallet: string): Promise<UserRecord | null>;
  listUsers(query: string, page: number, pageSize: number): Promise<{ rows: UserRecord[]; total: number }>;
  submissionCount(ipHash: string, sinceIso: string): Promise<number>;
  saveVerifiedStats(input: SaveStatsInput): Promise<{ user: UserRecord; snapshot: SnapshotRecord; created: boolean }>;
  latestSnapshot(userId: string): Promise<SnapshotRecord | null>;
  listCallouts(snapshotId: string): Promise<NormalizedCallout[]>;
  leaderboard(query: string, page: number, pageSize: number): Promise<{ rows: LeaderboardRow[]; total: number }>;
  recalculateAll(settings: ScoringSettings, actor: string): Promise<number>;
  setFlag(userId: string, flagged: boolean, reason: string | null, actor: string): Promise<UserRecord>;
  createNonce(nonce: NonceRecord): Promise<void>;
  consumeNonce(nonce: string, wallet: string): Promise<NonceRecord | null>;
  findClaimByUser(campaignId: string, userId: string): Promise<ClaimRecord | null>;
  findClaimByWallet(campaignId: string, wallet: string): Promise<ClaimRecord | null>;
  insertClaim(claim: ClaimRecord): Promise<ClaimRecord>;
  listClaims(): Promise<ClaimRecord[]>;
  insertFailures(rows: Array<Omit<FailureRecord, "id" | "createdAt">>): Promise<void>;
  listFailures(limit: number): Promise<FailureRecord[]>;
  audit(actor: string, action: string, target: string | null, metadata?: Record<string, unknown>): Promise<void>;
  listAudit(limit: number): Promise<AuditRecord[]>;
  counts(): Promise<{ users: number; snapshots: number; claims: number; failures: number }>;
}
