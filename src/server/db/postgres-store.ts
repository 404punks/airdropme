import pg from "pg";
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
  UserRecord,
} from "@/server/db/types";

const { Pool } = pg;

function settingsFromRow(row: Record<string, unknown>): ScoringSettings {
  return {
    formulaVersion: Number(row.formula_version),
    pointsPerFollower: Number(row.points_per_follower),
    pointsPerCallout: Number(row.points_per_callout),
    pointsPerLike: Number(row.points_per_like),
    pointsPerRepost: Number(row.points_per_repost),
    capFollowers: Number(row.cap_followers),
    capCallouts: Number(row.cap_callouts),
    capLikes: Number(row.cap_likes),
    capReposts: Number(row.cap_reposts),
    capTotalPoints: Number(row.cap_total_points),
    scoreBasis: "current_cumulative_totals",
  };
}

function userFromRow(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    pumpUserId: String(row.pump_user_id),
    username: (row.username as string | null) ?? null,
    canonicalWallet: (row.canonical_wallet as string | null) ?? null,
    profileImage: (row.profile_image as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    banned: Boolean(row.banned),
    flagged: Boolean(row.flagged),
    flagReason: (row.flag_reason as string | null) ?? null,
    dataMode: row.data_mode === "demo" ? "demo" : "live",
    currentPoints: Number(row.current_points),
    formulaVersion: Number(row.formula_version),
    lastFetchedAt: row.last_fetched_at ? new Date(String(row.last_fetched_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function snapshotFromRow(row: Record<string, unknown>): SnapshotRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    fetchedAt: new Date(String(row.fetched_at)).toISOString(),
    dataMode: row.data_mode === "demo" ? "demo" : "live",
    followers: row.followers == null ? null : Number(row.followers),
    followersStatus: row.followers_status as SnapshotRecord["followersStatus"],
    followersSource: String(row.followers_source),
    followersDetail: String(row.followers_detail),
    callouts: row.callouts == null ? null : Number(row.callouts),
    calloutsStatus: row.callouts_status as SnapshotRecord["calloutsStatus"],
    calloutsSource: String(row.callouts_source),
    calloutsDetail: String(row.callouts_detail),
    likes: row.likes == null ? null : Number(row.likes),
    likesStatus: row.likes_status as SnapshotRecord["likesStatus"],
    likesSource: String(row.likes_source),
    likesDetail: String(row.likes_detail),
    reposts: row.reposts == null ? null : Number(row.reposts),
    repostsStatus: row.reposts_status as SnapshotRecord["repostsStatus"],
    repostsSource: String(row.reposts_source),
    repostsDetail: String(row.reposts_detail),
    upstreamComputedAt: row.upstream_computed_at ? new Date(String(row.upstream_computed_at)).toISOString() : null,
    pointsTotal: Number(row.points_total),
    pointsBreakdown: row.points_breakdown as SnapshotRecord["pointsBreakdown"],
    formulaVersion: Number(row.formula_version),
  };
}

function campaignFromRow(row: Record<string, unknown>): CampaignRecord {
  const iso = (value: unknown) => (value ? new Date(String(value)).toISOString() : null);
  return {
    id: String(row.id),
    name: String(row.name),
    status: row.status as CampaignRecord["status"],
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    claimStartsAt: iso(row.claim_starts_at),
    claimEndsAt: iso(row.claim_ends_at),
    tokenSymbol: (row.token_symbol as string | null) ?? null,
    totalAllocation: (row.total_allocation as string | null) ?? null,
    funded: Boolean(row.funded),
    minPoints: Number(row.min_points),
    description: String(row.description),
    distributionEnabled: Boolean(row.distribution_enabled),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function claimFromRow(row: Record<string, unknown>): ClaimRecord {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    userId: String(row.user_id),
    wallet: String(row.wallet_address),
    status: row.status as ClaimRecord["status"],
    pointsAtClaim: Number(row.points_at_claim),
    walletSignature: String(row.wallet_signature),
    txSignature: (row.tx_signature as string | null) ?? null,
    failureReason: (row.failure_reason as string | null) ?? null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export class PostgresStore implements Repository {
  kind = "postgres" as const;
  private pool: pg.Pool;

  constructor(connectionString: string, private client?: pg.PoolClient, pool?: pg.Pool) {
    this.pool = pool ?? new Pool({ connectionString, max: 8 });
  }

  private query(text: string, params: unknown[] = []) {
    const runner = this.client ?? this.pool;
    return runner.query(text, params);
  }

  async transaction<T>(work: (repo: Repository) => Promise<T>): Promise<T> {
    if (this.client) return work(this);
    const client = await this.pool.connect();
    const tx = new PostgresStore("", client, this.pool);
    try {
      await client.query("BEGIN");
      const result = await work(tx);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSettings(): Promise<ScoringSettings> {
    const result = await this.query("select * from admin_settings where id = 1");
    if (!result.rows[0]) return { ...DEFAULT_SETTINGS };
    return settingsFromRow(result.rows[0]);
  }

  async saveSettings(settings: ScoringSettings, actor: string): Promise<ScoringSettings> {
    await this.query(
      `insert into admin_settings (
        id, formula_version, points_per_follower, points_per_callout, points_per_like, points_per_repost,
        cap_followers, cap_callouts, cap_likes, cap_reposts, cap_total_points, score_basis, updated_at
      ) values (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
      on conflict (id) do update set
        formula_version = excluded.formula_version,
        points_per_follower = excluded.points_per_follower,
        points_per_callout = excluded.points_per_callout,
        points_per_like = excluded.points_per_like,
        points_per_repost = excluded.points_per_repost,
        cap_followers = excluded.cap_followers,
        cap_callouts = excluded.cap_callouts,
        cap_likes = excluded.cap_likes,
        cap_reposts = excluded.cap_reposts,
        cap_total_points = excluded.cap_total_points,
        score_basis = excluded.score_basis,
        updated_at = now()`,
      [
        settings.formulaVersion,
        settings.pointsPerFollower,
        settings.pointsPerCallout,
        settings.pointsPerLike,
        settings.pointsPerRepost,
        settings.capFollowers,
        settings.capCallouts,
        settings.capLikes,
        settings.capReposts,
        settings.capTotalPoints,
        settings.scoreBasis,
      ],
    );
    await this.audit(actor, "settings.update", "admin_settings", { formulaVersion: settings.formulaVersion });
    return settings;
  }

  async getCampaign(): Promise<CampaignRecord> {
    const result = await this.query("select * from airdrop_campaigns where id = 'campaign_default'");
    if (!result.rows[0]) throw new Error("Campaign row is missing. Run the database migration.");
    return campaignFromRow(result.rows[0]);
  }

  async saveCampaign(campaign: CampaignRecord, actor: string): Promise<CampaignRecord> {
    await this.query(
      `update airdrop_campaigns set
        name = $2, status = $3, starts_at = $4, ends_at = $5, claim_starts_at = $6, claim_ends_at = $7,
        token_symbol = $8, total_allocation = $9, funded = $10, min_points = $11, description = $12,
        distribution_enabled = $13, updated_at = now()
      where id = $1`,
      [
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.startsAt,
        campaign.endsAt,
        campaign.claimStartsAt,
        campaign.claimEndsAt,
        campaign.tokenSymbol,
        campaign.totalAllocation,
        campaign.funded,
        campaign.minPoints,
        campaign.description,
        campaign.distributionEnabled,
      ],
    );
    await this.audit(actor, "campaign.update", campaign.id, { status: campaign.status });
    return this.getCampaign();
  }

  async findUserByPumpId(pumpUserId: string): Promise<UserRecord | null> {
    const result = await this.query("select * from users where pump_user_id = $1", [pumpUserId]);
    return result.rows[0] ? userFromRow(result.rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const result = await this.query("select * from users where id = $1", [id]);
    return result.rows[0] ? userFromRow(result.rows[0]) : null;
  }

  async findUserByUsername(username: string): Promise<UserRecord | null> {
    const result = await this.query("select * from users where lower(username) = lower($1) limit 1", [username]);
    return result.rows[0] ? userFromRow(result.rows[0]) : null;
  }

  async findUserByWallet(wallet: string): Promise<UserRecord | null> {
    const result = await this.query("select * from users where canonical_wallet = $1 limit 1", [wallet]);
    return result.rows[0] ? userFromRow(result.rows[0]) : null;
  }

  async listUsers(query: string, page: number, pageSize: number): Promise<{ rows: UserRecord[]; total: number }> {
    const needle = `%${query.trim().toLowerCase()}%`;
    const where = query.trim()
      ? "where lower(coalesce(username, '')) like $1 or lower(coalesce(canonical_wallet, '')) like $1 or lower(pump_user_id) like $1"
      : "";
    const params = query.trim() ? [needle] : [];
    const total = await this.query(`select count(*)::int as count from users ${where}`, params);
    const rows = await this.query(
      `select * from users ${where} order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, pageSize, Math.max(0, (page - 1) * pageSize)],
    );
    return { rows: rows.rows.map(userFromRow), total: Number(total.rows[0].count) };
  }

  async submissionCount(ipHash: string, sinceIso: string): Promise<number> {
    const result = await this.query(
      "select count(*)::int as count from submitted_profiles where ip_hash = $1 and created_at >= $2",
      [ipHash, sinceIso],
    );
    return Number(result.rows[0].count);
  }

  async saveVerifiedStats(input: SaveStatsInput): Promise<{ user: UserRecord; snapshot: SnapshotRecord; created: boolean }> {
    return this.transaction(async (repo) => {
      const tx = repo as PostgresStore;
      const existing = await tx.findUserByPumpId(input.user.pumpUserId);
      const upsert = await tx.query(
        `insert into users (
          pump_user_id, username, canonical_wallet, profile_image, bio, banned, flagged, flag_reason,
          data_mode, current_points, formula_version, last_fetched_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now())
        on conflict (pump_user_id) do update set
          username = excluded.username,
          canonical_wallet = excluded.canonical_wallet,
          profile_image = excluded.profile_image,
          bio = excluded.bio,
          banned = excluded.banned,
          flagged = users.flagged or excluded.flagged,
          flag_reason = coalesce(excluded.flag_reason, users.flag_reason),
          data_mode = excluded.data_mode,
          current_points = excluded.current_points,
          formula_version = excluded.formula_version,
          last_fetched_at = now(),
          updated_at = now()
        returning *`,
        [
          input.user.pumpUserId,
          input.user.username,
          input.user.canonicalWallet,
          input.user.profileImage,
          input.user.bio,
          input.user.banned,
          input.user.flagged ?? false,
          input.user.flagReason ?? null,
          input.user.dataMode,
          input.snapshot.pointsTotal,
          input.breakdown.formulaVersion,
        ],
      );
      const user = userFromRow(upsert.rows[0]);
      const snapshotResult = await tx.query(
        `insert into profile_statistics_snapshots (
          user_id, data_mode, followers, followers_status, followers_source, followers_detail,
          callouts, callouts_status, callouts_source, callouts_detail,
          likes, likes_status, likes_source, likes_detail,
          reposts, reposts_status, reposts_source, reposts_detail,
          upstream_computed_at, points_total, points_breakdown, formula_version
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22
        ) returning *`,
        [
          user.id,
          input.snapshot.dataMode,
          input.snapshot.followers,
          input.snapshot.followersStatus,
          input.snapshot.followersSource,
          input.snapshot.followersDetail,
          input.snapshot.callouts,
          input.snapshot.calloutsStatus,
          input.snapshot.calloutsSource,
          input.snapshot.calloutsDetail,
          input.snapshot.likes,
          input.snapshot.likesStatus,
          input.snapshot.likesSource,
          input.snapshot.likesDetail,
          input.snapshot.reposts,
          input.snapshot.repostsStatus,
          input.snapshot.repostsSource,
          input.snapshot.repostsDetail,
          input.snapshot.upstreamComputedAt,
          input.snapshot.pointsTotal,
          JSON.stringify(input.snapshot.pointsBreakdown),
          input.snapshot.formulaVersion,
        ],
      );
      const snapshot = snapshotFromRow(snapshotResult.rows[0]);
      for (const callout of input.callouts) {
        await tx.query(
          `insert into callout_records (snapshot_id, user_id, callout_id, coin_mint, likes, repost_count, created_at)
           values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (snapshot_id, callout_id) do nothing`,
          [snapshot.id, user.id, callout.calloutId, callout.coinMint, callout.likes, callout.repostCount, callout.createdAt],
        );
      }
      const idempotencyKey = `${user.id}:${snapshot.id}:${input.breakdown.formulaVersion}`;
      await tx.query(
        `insert into point_ledger (user_id, snapshot_id, formula_version, total, breakdown, idempotency_key)
         values ($1,$2,$3,$4,$5::jsonb,$6)
         on conflict (idempotency_key) do nothing`,
        [user.id, snapshot.id, input.breakdown.formulaVersion, input.breakdown.total, JSON.stringify(input.breakdown), idempotencyKey],
      );
      await tx.query(
        `insert into submitted_profiles (user_id, submitted_raw, normalized, ip_hash) values ($1,$2,$3,$4)`,
        [user.id, input.submittedRaw, input.normalized, input.ipHash],
      );
      await tx.rebuild();
      return { user, snapshot, created: !existing };
    });
  }

  async latestSnapshot(userId: string): Promise<SnapshotRecord | null> {
    const result = await this.query(
      "select * from profile_statistics_snapshots where user_id = $1 order by fetched_at desc limit 1",
      [userId],
    );
    return result.rows[0] ? snapshotFromRow(result.rows[0]) : null;
  }

  async listCallouts(snapshotId: string): Promise<NormalizedCallout[]> {
    const result = await this.query(
      "select callout_id, coin_mint, likes, repost_count, created_at from callout_records where snapshot_id = $1 order by created_at desc nulls last",
      [snapshotId],
    );
    return result.rows.map((row) => ({
      calloutId: String(row.callout_id),
      coinMint: (row.coin_mint as string | null) ?? null,
      likes: Number(row.likes),
      repostCount: Number(row.repost_count),
      createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    }));
  }

  async leaderboard(query: string, page: number, pageSize: number): Promise<{ rows: LeaderboardRow[]; total: number }> {
    const needle = `%${query.trim().toLowerCase()}%`;
    const where = query.trim()
      ? "where lower(coalesce(username, '')) like $1 or lower(coalesce(canonical_wallet, '')) like $1 or lower(pump_user_id) like $1"
      : "";
    const params = query.trim() ? [needle] : [];
    const total = await this.query(`select count(*)::int as count from leaderboard_cache ${where}`, params);
    const rows = await this.query(
      `select * from leaderboard_cache ${where} order by points desc, rank asc limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, pageSize, Math.max(0, (page - 1) * pageSize)],
    );
    return {
      total: Number(total.rows[0].count),
      rows: rows.rows.map((row, index) => ({
        rank: query.trim() ? Math.max(0, (page - 1) * pageSize) + index + 1 : Number(row.rank),
        userId: String(row.user_id),
        pumpUserId: String(row.pump_user_id),
        username: (row.username as string | null) ?? null,
        canonicalWallet: (row.canonical_wallet as string | null) ?? null,
        followers: row.followers == null ? null : Number(row.followers),
        callouts: row.callouts == null ? null : Number(row.callouts),
        likes: row.likes == null ? null : Number(row.likes),
        reposts: row.reposts == null ? null : Number(row.reposts),
        followersStatus: row.followers_status,
        calloutsStatus: row.callouts_status,
        likesStatus: row.likes_status,
        repostsStatus: row.reposts_status,
        points: Number(row.points),
        dataMode: row.data_mode === "demo" ? "demo" : "live",
        lastFetchedAt: row.last_fetched_at ? new Date(String(row.last_fetched_at)).toISOString() : null,
      })),
    };
  }

  async recalculateAll(settings: ScoringSettings, actor: string): Promise<number> {
    return this.transaction(async (repo) => {
      const tx = repo as PostgresStore;
      const users = await tx.query("select id from users where flagged = false and banned = false");
      let count = 0;
      for (const row of users.rows) {
        const snapshot = await tx.latestSnapshot(String(row.id));
        if (!snapshot) continue;
        const breakdown = calculatePoints(
          {
            followers: { status: snapshot.followersStatus, value: snapshot.followers, source: snapshot.followersSource, detail: snapshot.followersDetail },
            callouts: { status: snapshot.calloutsStatus, value: snapshot.callouts, source: snapshot.calloutsSource, detail: snapshot.calloutsDetail },
            likes: { status: snapshot.likesStatus, value: snapshot.likes, source: snapshot.likesSource, detail: snapshot.likesDetail },
            reposts: { status: snapshot.repostsStatus, value: snapshot.reposts, source: snapshot.repostsSource, detail: snapshot.repostsDetail },
          },
          settings,
        );
        await tx.query(
          "update users set current_points = $2, formula_version = $3, updated_at = now() where id = $1",
          [row.id, breakdown.total, settings.formulaVersion],
        );
        await tx.query(
          "update profile_statistics_snapshots set points_total = $2, points_breakdown = $3::jsonb, formula_version = $4 where id = $1",
          [snapshot.id, breakdown.total, JSON.stringify(breakdown), settings.formulaVersion],
        );
        count += 1;
      }
      await tx.rebuild();
      await tx.audit(actor, "points.recalculate", "point_ledger", { count, formulaVersion: settings.formulaVersion });
      return count;
    });
  }

  async setFlag(userId: string, flagged: boolean, reason: string | null, actor: string): Promise<UserRecord> {
    const result = await this.query(
      `update users set flagged = $2, flag_reason = $3, updated_at = now()
       where id = $1 returning *`,
      [userId, flagged, reason],
    );
    if (!result.rows[0]) throw new Error("Profile not found.");
    await this.rebuild();
    await this.audit(actor, flagged ? "profile.flag" : "profile.unflag", userId, { reason });
    return userFromRow(result.rows[0]);
  }

  async createNonce(nonce: NonceRecord): Promise<void> {
    await this.query(
      `insert into claim_nonces (nonce, wallet_address, user_id, campaign_id, message, expires_at) values ($1,$2,$3,$4,$5,$6)`,
      [nonce.nonce, nonce.wallet, nonce.userId, nonce.campaignId, nonce.message, nonce.expiresAt],
    );
  }

  async consumeNonce(nonce: string, wallet: string): Promise<NonceRecord | null> {
    return this.transaction(async (repo) => {
      const tx = repo as PostgresStore;
      const result = await tx.query(
        `update claim_nonces set used_at = now()
         where nonce = $1 and wallet_address = $2 and used_at is null and expires_at > now()
         returning *`,
        [nonce, wallet],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        nonce: String(row.nonce),
        wallet: String(row.wallet_address),
        userId: String(row.user_id),
        campaignId: String(row.campaign_id),
        message: String(row.message),
        expiresAt: new Date(String(row.expires_at)).toISOString(),
        usedAt: new Date(String(row.used_at)).toISOString(),
      };
    });
  }

  async findClaimByUser(campaignId: string, userId: string): Promise<ClaimRecord | null> {
    const result = await this.query("select * from airdrop_claims where campaign_id = $1 and user_id = $2", [campaignId, userId]);
    return result.rows[0] ? claimFromRow(result.rows[0]) : null;
  }

  async findClaimByWallet(campaignId: string, wallet: string): Promise<ClaimRecord | null> {
    const result = await this.query(
      "select * from airdrop_claims where campaign_id = $1 and wallet_address = $2",
      [campaignId, wallet],
    );
    return result.rows[0] ? claimFromRow(result.rows[0]) : null;
  }

  async insertClaim(claim: ClaimRecord): Promise<ClaimRecord> {
    try {
      const result = await this.query(
        `insert into airdrop_claims (
          id, campaign_id, user_id, wallet_address, status, points_at_claim, wallet_signature, tx_signature, failure_reason
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [
          claim.id,
          claim.campaignId,
          claim.userId,
          claim.wallet,
          claim.status,
          claim.pointsAtClaim,
          claim.walletSignature,
          claim.txSignature,
          claim.failureReason,
        ],
      );
      await this.audit("system", "claim.create", claim.id, { status: claim.status });
      return claimFromRow(result.rows[0]);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        throw new Error("A claim already exists for this profile or wallet.");
      }
      throw error;
    }
  }

  async listClaims(): Promise<ClaimRecord[]> {
    const result = await this.query("select * from airdrop_claims order by created_at desc");
    return result.rows.map(claimFromRow);
  }

  async insertFailures(rows: Array<Omit<FailureRecord, "id" | "createdAt">>): Promise<void> {
    for (const row of rows) {
      await this.query(
        `insert into fetch_failures (user_id, identifier, endpoint, status_code, message) values ($1,$2,$3,$4,$5)`,
        [row.userId, row.identifier, row.endpoint, row.statusCode, row.message],
      );
    }
  }

  async listFailures(limit: number): Promise<FailureRecord[]> {
    const result = await this.query("select * from fetch_failures order by created_at desc limit $1", [limit]);
    return result.rows.map((row) => ({
      id: String(row.id),
      userId: (row.user_id as string | null) ?? null,
      identifier: String(row.identifier),
      endpoint: String(row.endpoint),
      statusCode: row.status_code == null ? null : Number(row.status_code),
      message: String(row.message),
      createdAt: new Date(String(row.created_at)).toISOString(),
    }));
  }

  async audit(actor: string, action: string, target: string | null, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.query("insert into audit_logs (actor, action, target, metadata) values ($1,$2,$3,$4::jsonb)", [
      actor,
      action,
      target,
      JSON.stringify(metadata),
    ]);
  }

  async listAudit(limit: number): Promise<AuditRecord[]> {
    const result = await this.query("select * from audit_logs order by created_at desc limit $1", [limit]);
    return result.rows.map((row) => ({
      id: String(row.id),
      actor: String(row.actor),
      action: String(row.action),
      target: (row.target as string | null) ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(row.created_at)).toISOString(),
    }));
  }

  async counts(): Promise<{ users: number; snapshots: number; claims: number; failures: number }> {
    const result = await this.query(
      `select
        (select count(*) from users)::int as users,
        (select count(*) from profile_statistics_snapshots)::int as snapshots,
        (select count(*) from airdrop_claims)::int as claims,
        (select count(*) from fetch_failures)::int as failures`,
    );
    return {
      users: Number(result.rows[0].users),
      snapshots: Number(result.rows[0].snapshots),
      claims: Number(result.rows[0].claims),
      failures: Number(result.rows[0].failures),
    };
  }

  private async rebuild(): Promise<void> {
    await this.query("delete from leaderboard_cache");
    await this.query(
      `insert into leaderboard_cache (
        user_id, rank, pump_user_id, username, canonical_wallet, followers, callouts, likes, reposts,
        followers_status, callouts_status, likes_status, reposts_status, points, data_mode, last_fetched_at
      )
      select user_id, row_number() over (order by points desc, last_fetched_at asc nulls last),
        pump_user_id, username, canonical_wallet, followers, callouts, likes, reposts,
        followers_status, callouts_status, likes_status, reposts_status, points, data_mode, last_fetched_at
      from (
        select u.id as user_id, u.pump_user_id, u.username, u.canonical_wallet, u.current_points as points,
          u.data_mode, u.last_fetched_at, s.followers, s.callouts, s.likes, s.reposts,
          s.followers_status, s.callouts_status, s.likes_status, s.reposts_status
        from users u
        join lateral (
          select * from profile_statistics_snapshots where user_id = u.id order by fetched_at desc limit 1
        ) s on true
        where u.flagged = false and u.banned = false
      ) ranked`,
    );
  }
}
