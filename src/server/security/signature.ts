import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";

export function createNonce(): string {
  return randomBytes(24).toString("base64url");
}

export function buildClaimMessage(input: {
  domain: string;
  username: string | null;
  pumpUserId: string;
  wallet: string;
  campaignId: string;
  nonce: string;
}): string {
  const name = input.username ?? "unnamed profile";
  return [
    `${input.domain} claim registration`,
    "",
    `Profile: ${name}`,
    `Pump user id: ${input.pumpUserId}`,
    `Wallet: ${input.wallet}`,
    `Campaign: ${input.campaignId}`,
    `Nonce: ${input.nonce}`,
    "",
    "Signing registers a claim request for this wallet.",
    "This does not transfer tokens, approve a payment, or prove anything except control of this wallet.",
  ].join("\n");
}

export function verifyWalletSignature(message: string, signature: string, wallet: string): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKey = bs58.decode(wallet);
    if (signatureBytes.length !== 64 || publicKey.length !== 32) return false;
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey);
  } catch {
    return false;
  }
}

export function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function safeEqualString(left: string, right: string): boolean {
  return timingSafeEqual(sha256(left), sha256(right));
}
