import { formatUsdc } from "@/server/points/calculate";

export type Qualification =
  | { status: "unavailable" }
  | { status: "not_eligible"; reason: string }
  | { status: "claim_coming_soon"; detail: string }
  | { status: "eligible"; detail: string };

export function qualification(input: {
  hasSnapshot: boolean;
  points: number;
  minPoints: number;
  banned: boolean;
  flagged: boolean;
  claimStatus: string;
}): Qualification {
  if (!input.hasSnapshot) return { status: "unavailable" };
  if (input.banned) {
    return {
      status: "not_eligible",
      reason: "Pump.fun reports this profile as banned, so it does not qualify.",
    };
  }
  if (input.flagged) {
    return {
      status: "not_eligible",
      reason: "This profile is excluded from claims.",
    };
  }
  if (input.points < input.minPoints) {
    return {
      status: "not_eligible",
      reason: `This account has $${formatUsdc(input.points)} USDC. The current requirement is $${formatUsdc(input.minPoints)} USDC.`,
    };
  }
  if (input.claimStatus !== "claim_open") {
    return {
      status: "claim_coming_soon",
      detail: "This account meets the current USDC requirement. Claiming is not open yet.",
    };
  }
  return {
    status: "eligible",
    detail: "This account meets the current USDC requirement, and claiming is open.",
  };
}
