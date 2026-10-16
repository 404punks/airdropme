import { randomUUID } from "node:crypto";
import { config } from "@/server/config";
import type { ClaimRecord, Repository } from "@/server/db/types";
import { isSolanaAddress } from "@/server/validation/identifier";
import { buildClaimMessage, createNonce, verifyWalletSignature } from "@/server/security/signature";
import { getReferralRepository, summaryFor } from "@/server/referrals/service";
import { ServiceError } from "@/server/services/profiles";

export interface Distributor {
  enabled: boolean;
  submit(claim: ClaimRecord): Promise<Pick<ClaimRecord, "status" | "txSignature" | "failureReason">>;
}

export const unconfiguredDistributor: Distributor = {
  enabled: false,
  async submit() {
    return {
      status: "registered",
      txSignature: null,
      failureReason: null,
    };
  },
};

async function referralBonus(username: string | null): Promise<number> {
  if (!username) return 0;
  const store = getReferralRepository();
  if (!store) return 0;
  try {
    const history = await store.listHistory();
    return summaryFor(username, history).points;
  } catch {
    return 0;
  }
}

export function resolveDistributor(): Distributor {
  if (!config.distributionEnabled) return unconfiguredDistributor;
  return {
    enabled: true,
    async submit(claim) {
      return {
        status: "failed",
        txSignature: null,
        failureReason: `Distribution is enabled in the environment, but no verified claim program is configured. Claim ${claim.id} was not sent.`,
      };
    },
  };
}

export async function issueNonce(options: {
  repo: Repository;
  userId: string;
  wallet: string;
}): Promise<{ message: string; nonce: string; expiresAt: string }> {
  if (!isSolanaAddress(options.wallet)) {
    throw new ServiceError("Connect a valid Solana wallet address.", "validation", 400);
  }
  const user = await options.repo.findUserById(options.userId);
  if (!user) throw new ServiceError("Register a Pump.fun profile before claiming.", "not_found", 404);
  const campaign = await options.repo.getCampaign();
  if (campaign.status !== "claim_open") {
    throw new ServiceError("Claims are not open for this campaign.", "validation", 409);
  }
  if (!user.canonicalWallet) {
    throw new ServiceError(
      "This Pump.fun profile has no public canonical wallet, so ownership cannot be checked.",
      "validation",
      422,
    );
  }
  if (user.canonicalWallet !== options.wallet) {
    throw new ServiceError(
      "The connected wallet does not match the canonical wallet on the Pump.fun profile. A signature proves control of the connected wallet only.",
      "validation",
      422,
    );
  }
  const nonce = createNonce();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const message = buildClaimMessage({
    domain: "Callout Drop",
    username: user.username,
    pumpUserId: user.pumpUserId,
    wallet: options.wallet,
    campaignId: campaign.id,
    nonce,
  });
  await options.repo.createNonce({
    nonce,
    wallet: options.wallet,
    userId: user.id,
    campaignId: campaign.id,
    message,
    expiresAt,
    usedAt: null,
  });
  return { message, nonce, expiresAt };
}

export async function registerClaim(options: {
  repo: Repository;
  distributor: Distributor;
  userId: string;
  wallet: string;
  nonce: string;
  signature: string;
}): Promise<ClaimRecord> {
  if (!isSolanaAddress(options.wallet)) {
    throw new ServiceError("That wallet address is invalid.", "validation", 400);
  }
  const user = await options.repo.findUserById(options.userId);
  if (!user) throw new ServiceError("Profile not found.", "not_found", 404);
  const campaign = await options.repo.getCampaign();
  if (campaign.status !== "claim_open") {
    throw new ServiceError("Claims are not open for this campaign.", "validation", 409);
  }
  if (user.flagged || user.banned) {
    throw new ServiceError("This profile is not eligible.", "validation", 403);
  }
  const points = user.currentPoints + (await referralBonus(user.username));
  if (points < campaign.minPoints) {
    throw new ServiceError("This profile does not meet the USDC requirement.", "validation", 403);
  }
  if (user.canonicalWallet !== options.wallet) {
    throw new ServiceError("The wallet does not match the profile's canonical wallet.", "validation", 422);
  }
  const existingUser = await options.repo.findClaimByUser(campaign.id, user.id);
  const existingWallet = await options.repo.findClaimByWallet(campaign.id, options.wallet);
  if (existingUser || existingWallet) {
    throw new ServiceError("This profile or wallet has already registered a claim.", "validation", 409);
  }
  const nonce = await options.repo.consumeNonce(options.nonce, options.wallet);
  if (!nonce || nonce.userId !== user.id || nonce.campaignId !== campaign.id) {
    throw new ServiceError("That claim nonce is missing, expired, or already used.", "validation", 400);
  }
  if (!verifyWalletSignature(nonce.message, options.signature, options.wallet)) {
    throw new ServiceError("The wallet signature did not match the claim message.", "validation", 400);
  }
  const timestamp = new Date().toISOString();
  const provisional: ClaimRecord = {
    id: randomUUID(),
    campaignId: campaign.id,
    userId: user.id,
    wallet: options.wallet,
    status: "registered",
    pointsAtClaim: points,
    walletSignature: options.signature,
    txSignature: null,
    failureReason: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const distributed = campaign.distributionEnabled || options.distributor.enabled
    ? await options.distributor.submit(provisional)
    : await unconfiguredDistributor.submit(provisional);
  const claim: ClaimRecord = {
    ...provisional,
    status: distributed.status,
    txSignature: distributed.txSignature,
    failureReason: distributed.failureReason,
    updatedAt: new Date().toISOString(),
  };
  return options.repo.insertClaim(claim);
}
