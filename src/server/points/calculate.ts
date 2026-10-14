export type MetricStatus = "verified" | "unavailable" | "incomplete" | "demo";

export interface MetricValue {
  status: MetricStatus;
  value: number | null;
  source: string;
  detail: string;
}

export interface ScoringSettings {
  formulaVersion: number;
  pointsPerFollower: number;
  pointsPerCallout: number;
  pointsPerLike: number;
  pointsPerRepost: number;
  capFollowers: number;
  capCallouts: number;
  capLikes: number;
  capReposts: number;
  capTotalPoints: number;
  scoreBasis: "current_cumulative_totals";
}

export interface PointComponent {
  key: "followers" | "callouts" | "likes" | "reposts";
  label: string;
  status: MetricStatus;
  raw: number | null;
  counted: number;
  weight: number;
  points: number;
  included: boolean;
  reason: string;
}

export interface PointsBreakdown {
  formulaVersion: number;
  scoreBasis: ScoringSettings["scoreBasis"];
  components: PointComponent[];
  subtotal: number;
  total: number;
  capped: boolean;
}

export const DEFAULT_SETTINGS: ScoringSettings = {
  formulaVersion: 1,
  pointsPerFollower: 1,
  pointsPerCallout: 5,
  pointsPerLike: 1,
  pointsPerRepost: 2,
  capFollowers: 1_000_000,
  capCallouts: 50_000,
  capLikes: 5_000_000,
  capReposts: 5_000_000,
  capTotalPoints: 20_000_000,
  scoreBasis: "current_cumulative_totals",
};

const LABELS: Record<PointComponent["key"], string> = {
  followers: "Followers",
  callouts: "Callouts created",
  likes: "Likes received",
  reposts: "Reposts received",
};

function component(
  key: PointComponent["key"],
  metric: MetricValue,
  weight: number,
  cap: number,
): PointComponent {
  const base = {
    key,
    label: LABELS[key],
    status: metric.status,
    raw: metric.value,
    counted: 0,
    weight,
    points: 0,
    included: false,
    reason: metric.detail,
  };
  if (metric.status !== "verified" && metric.status !== "demo") {
    return {
      ...base,
      reason:
        metric.status === "incomplete"
          ? "Incomplete page walk. This metric is not scored."
          : "Unavailable. This metric is not scored.",
    };
  }
  if (metric.value == null || !Number.isFinite(metric.value) || metric.value < 0) {
    return { ...base, status: "unavailable", raw: null, reason: "The API value was not a usable number." };
  }
  const whole = Math.floor(metric.value);
  const counted = Math.min(whole, Math.max(0, Math.floor(cap)));
  const points = counted * Math.max(0, Math.floor(weight));
  return {
    ...base,
    raw: metric.value,
    counted,
    points,
    included: true,
    reason: counted < whole ? `Counted ${counted} after the configured cap.` : "Counted from the verified total.",
  };
}

export function calculatePoints(
  metrics: {
    followers: MetricValue;
    callouts: MetricValue;
    likes: MetricValue;
    reposts: MetricValue;
  },
  settings: ScoringSettings,
): PointsBreakdown {
  const components = [
    component("followers", metrics.followers, settings.pointsPerFollower, settings.capFollowers),
    component("callouts", metrics.callouts, settings.pointsPerCallout, settings.capCallouts),
    component("likes", metrics.likes, settings.pointsPerLike, settings.capLikes),
    component("reposts", metrics.reposts, settings.pointsPerRepost, settings.capReposts),
  ];
  const subtotal = components.reduce((sum, item) => sum + item.points, 0);
  const total = Math.min(subtotal, Math.max(0, Math.floor(settings.capTotalPoints)));
  return {
    formulaVersion: settings.formulaVersion,
    scoreBasis: settings.scoreBasis,
    components,
    subtotal,
    total,
    capped: total < subtotal,
  };
}

export function explainFormula(settings: ScoringSettings): string[] {
  return [
    `${settings.pointsPerFollower} point per verified follower`,
    `${settings.pointsPerCallout} points per verified Callout created`,
    `${settings.pointsPerLike} point per verified like received`,
    `${settings.pointsPerRepost} points per verified repost received`,
    "Unavailable or incomplete statistics are not scored.",
    "The score is recomputed from current cumulative public totals. A refresh replaces the score. It does not add the same totals again.",
    "PTS score public statistics. They are not a promise of tokens, price, or a completed airdrop.",
  ];
}

export function sanitizeSettings(input: Partial<ScoringSettings>, previous: ScoringSettings): ScoringSettings {
  const int = (value: unknown, fallback: number, max: number) => {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number) || number < 0) return fallback;
    return Math.min(max, Math.floor(number));
  };
  const next: ScoringSettings = {
    ...previous,
    pointsPerFollower: int(input.pointsPerFollower, previous.pointsPerFollower, 10_000),
    pointsPerCallout: int(input.pointsPerCallout, previous.pointsPerCallout, 10_000),
    pointsPerLike: int(input.pointsPerLike, previous.pointsPerLike, 10_000),
    pointsPerRepost: int(input.pointsPerRepost, previous.pointsPerRepost, 10_000),
    capFollowers: int(input.capFollowers, previous.capFollowers, 1_000_000_000),
    capCallouts: int(input.capCallouts, previous.capCallouts, 1_000_000_000),
    capLikes: int(input.capLikes, previous.capLikes, 1_000_000_000),
    capReposts: int(input.capReposts, previous.capReposts, 1_000_000_000),
    capTotalPoints: int(input.capTotalPoints, previous.capTotalPoints, 1_000_000_000_000),
    scoreBasis: "current_cumulative_totals",
  };
  const changed =
    next.pointsPerFollower !== previous.pointsPerFollower ||
    next.pointsPerCallout !== previous.pointsPerCallout ||
    next.pointsPerLike !== previous.pointsPerLike ||
    next.pointsPerRepost !== previous.pointsPerRepost ||
    next.capFollowers !== previous.capFollowers ||
    next.capCallouts !== previous.capCallouts ||
    next.capLikes !== previous.capLikes ||
    next.capReposts !== previous.capReposts ||
    next.capTotalPoints !== previous.capTotalPoints;
  next.formulaVersion = changed ? previous.formulaVersion + 1 : previous.formulaVersion;
  return next;
}
