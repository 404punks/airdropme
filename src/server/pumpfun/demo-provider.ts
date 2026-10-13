import type { FetchOutcome, StatsProvider } from "@/server/pumpfun/types";
import { ProfileNotFoundError } from "@/server/pumpfun/types";

const FIXTURES: Record<string, FetchOutcome> = {
  demoalpha: {
    profile: {
      pumpUserId: "00000000-0000-4000-8000-0000000000a1",
      username: "DEMO_alpha",
      canonicalWallet: "DemoWalletAlpha111111111111111111111111111",
      profileImage: null,
      bio: "Labeled demo fixture. Not a Pump.fun account.",
      banned: false,
      kind: "person",
    },
    metrics: {
      followers: { status: "demo", value: 120, source: "demo fixture", detail: "DEMO data, not a live Pump.fun response." },
      callouts: { status: "demo", value: 4, source: "demo fixture", detail: "DEMO data, not a live Pump.fun response." },
      likes: { status: "demo", value: 30, source: "demo fixture", detail: "DEMO data, not a live Pump.fun response." },
      reposts: { status: "demo", value: 6, source: "demo fixture", detail: "DEMO data, not a live Pump.fun response." },
    },
    callouts: [
      {
        calloutId: "demo-callout-1",
        coinMint: null,
        likes: 30,
        repostCount: 6,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    upstreamComputedAt: null,
    dataMode: "demo",
    failures: [],
  },
};

export const demoProvider: StatsProvider = {
  mode: "demo",
  async fetchProfile(lookup: string): Promise<FetchOutcome> {
    const fixture = FIXTURES[lookup.toLowerCase()];
    if (!fixture) {
      throw new ProfileNotFoundError("Demo mode only recognizes the fixture username DEMO_alpha.");
    }
    return structuredClone(fixture);
  },
};
