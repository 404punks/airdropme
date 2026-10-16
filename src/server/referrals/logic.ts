export const REFERRAL_POINTS = 170;
export const REFERRAL_LEADERBOARD_LIMIT = 100;
export const REFERRAL_ATTACH_WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_SITE_ORIGIN = "https://www.calloutdrop.app";

export interface ReferralHistoryRecord {
  id: string;
  referrerUsername: string;
  referrerImage: string | null;
  referredUsername: string;
  referredImage: string | null;
  referrerPoints: number;
  referredPoints: number;
  referralLink: string;
  domain: string;
  createdAt: string;
}

export interface ReferralLinkRecord {
  username: string;
  profileImage: string | null;
  link: string;
  domain: string;
  createdAt: string;
}

export interface ReferralBoardRow {
  username: string;
  profileImage: string | null;
  referrals: number;
  points: number;
  link: string;
  domain: string;
}

export function referralDocumentId(username: string): string {
  return `join_${username.trim().toLowerCase()}`;
}

export function linkDocumentId(username: string): string {
  return `link_${username.trim().toLowerCase()}`;
}

export function referralUrl(origin: string, username: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/r/${encodeURIComponent(username)}`;
}

export function originFromHeaders(
  headers: { get(name: string): string | null },
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.SITE_URL || env.NEXT_PUBLIC_SITE_URL || "";
  const host = headers.get("x-forwarded-host") || headers.get("host");
  return siteOriginFromHost(host, configured);
}

export function siteOriginFromHost(_host: string | null, configured = ""): string {
  const explicit = configured.trim().replace(/\/$/, "");
  if (explicit) {
    try {
      const url = new URL(explicit);
      const legacy = url.hostname === "ansemmasx.fun" || url.hostname.endsWith(".ansemmasx.fun");
      if (!legacy && (url.protocol === "https:" || url.protocol === "http:")) return explicit;
    } catch {
      return DEFAULT_SITE_ORIGIN;
    }
  }
  return DEFAULT_SITE_ORIGIN;
}

export function canAttachReferral(createdAt: string, now = Date.now()): boolean {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const age = now - created;
  return age >= 0 && age <= REFERRAL_ATTACH_WINDOW_MS;
}

export function planReferral(input: {
  referrerUsername: string;
  referredUsername: string;
  referrerImage?: string | null;
  referredImage?: string | null;
  origin: string;
  createdAt?: string;
}):
  | { ok: true; history: ReferralHistoryRecord; referrerLink: ReferralLinkRecord; referredLink: ReferralLinkRecord }
  | { ok: false; reason: string } {
  const referrerUsername = input.referrerUsername.trim();
  const referredUsername = input.referredUsername.trim();
  if (!referrerUsername || !referredUsername) return { ok: false, reason: "A username is required." };
  if (referrerUsername.toLowerCase() === referredUsername.toLowerCase()) {
    return { ok: false, reason: "You cannot use your own referral link." };
  }
  const domain = input.origin.replace(/\/$/, "");
  const createdAt = input.createdAt ?? new Date().toISOString();
  const history: ReferralHistoryRecord = {
    id: referralDocumentId(referredUsername),
    referrerUsername,
    referrerImage: input.referrerImage ?? null,
    referredUsername,
    referredImage: input.referredImage ?? null,
    referrerPoints: REFERRAL_POINTS,
    referredPoints: REFERRAL_POINTS,
    referralLink: referralUrl(domain, referrerUsername),
    domain,
    createdAt,
  };
  return {
    ok: true,
    history,
    referrerLink: {
      username: referrerUsername,
      profileImage: input.referrerImage ?? null,
      link: history.referralLink,
      domain,
      createdAt,
    },
    referredLink: {
      username: referredUsername,
      profileImage: input.referredImage ?? null,
      link: referralUrl(domain, referredUsername),
      domain,
      createdAt,
    },
  };
}

export function pointsFromHistory(username: string, rows: ReferralHistoryRecord[]): {
  made: number;
  joined: number;
  points: number;
  history: ReferralHistoryRecord[];
} {
  const key = username.trim().toLowerCase();
  const history = rows.filter(
    (row) => row.referrerUsername.toLowerCase() === key || row.referredUsername.toLowerCase() === key,
  );
  const made = history.filter((row) => row.referrerUsername.toLowerCase() === key).length;
  const joined = history.filter((row) => row.referredUsername.toLowerCase() === key).length;
  const points = history.reduce((sum, row) => {
    if (row.referrerUsername.toLowerCase() === key) return sum + row.referrerPoints;
    return sum + row.referredPoints;
  }, 0);
  return { made, joined, points, history };
}

export function referralLeaderboard(rows: ReferralHistoryRecord[], links: ReferralLinkRecord[]): ReferralBoardRow[] {
  const grouped = new Map<string, ReferralBoardRow>();
  const counted = new Set<string>();
  for (const row of rows) {
    const key = row.referrerUsername.trim().toLowerCase();
    const referred = row.referredUsername.trim().toLowerCase();
    if (!key || !referred || key === referred) continue;
    const pair = `${key}\0${referred}`;
    if (counted.has(pair)) continue;
    counted.add(pair);
    const current = grouped.get(key) ?? {
      username: row.referrerUsername.trim(),
      profileImage: row.referrerImage,
      referrals: 0,
      points: 0,
      link: row.referralLink,
      domain: row.domain,
    };
    current.referrals += 1;
    current.points += row.referrerPoints;
    if (!current.profileImage && row.referrerImage) current.profileImage = row.referrerImage;
    grouped.set(key, current);
  }
  for (const link of links) {
    const key = link.username.toLowerCase();
    const current = grouped.get(key);
    if (!current) continue;
    current.username = link.username;
    current.profileImage = link.profileImage ?? current.profileImage;
    current.link = link.link;
    current.domain = link.domain;
  }
  return [...grouped.values()]
    .sort((a, b) => b.referrals - a.referrals || b.points - a.points || a.username.localeCompare(b.username))
    .slice(0, REFERRAL_LEADERBOARD_LIMIT);
}
