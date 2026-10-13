import type { MetricValue } from "@/server/points/calculate";

export interface ProviderProfile {
  pumpUserId: string;
  username: string | null;
  canonicalWallet: string | null;
  profileImage: string | null;
  bio: string | null;
  banned: boolean;
  kind: string | null;
}

export interface NormalizedCallout {
  calloutId: string;
  coinMint: string | null;
  likes: number;
  repostCount: number;
  createdAt: string | null;
}

export interface ProviderFailure {
  endpoint: string;
  statusCode: number | null;
  message: string;
}

export interface FetchOutcome {
  profile: ProviderProfile;
  metrics: {
    followers: MetricValue;
    callouts: MetricValue;
    likes: MetricValue;
    reposts: MetricValue;
  };
  callouts: NormalizedCallout[];
  upstreamComputedAt: string | null;
  dataMode: "live" | "demo";
  failures: ProviderFailure[];
}

export class ProfileNotFoundError extends Error {
  constructor(message = "No Pump.fun profile was found for that identifier.") {
    super(message);
    this.name = "ProfileNotFoundError";
  }
}

export class NotPumpProfileError extends Error {
  constructor(message = "That wallet is not a Pump.fun profile according to the API.") {
    super(message);
    this.name = "NotPumpProfileError";
  }
}

export interface StatsProvider {
  mode: "live" | "demo";
  fetchProfile(lookup: string): Promise<FetchOutcome>;
}
