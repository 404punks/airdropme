const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const RESERVED = new Set([
  "api",
  "admin",
  "advanced",
  "board",
  "callout",
  "callouts",
  "campaign",
  "claim",
  "create",
  "docs",
  "faq",
  "leaderboard",
  "live",
  "p",
  "profile",
  "submit",
]);

export type ParsedIdentifier =
  | { ok: true; lookup: string; kind: "wallet" | "username" }
  | { ok: false; error: string };

export function decodeBase58(value: string): Uint8Array | null {
  if (!value || value.length > 44) return null;
  let zeroes = 0;
  while (zeroes < value.length && value[zeroes] === "1") zeroes += 1;
  const bytes: number[] = [];
  for (let index = zeroes; index < value.length; index += 1) {
    const digit = BASE58.indexOf(value[index]);
    if (digit < 0) return null;
    let carry = digit;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const output = new Uint8Array(zeroes + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) output[output.length - 1 - i] = bytes[i];
  return output;
}

export function isSolanaAddress(value: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  const decoded = decodeBase58(value);
  return decoded?.length === 32;
}

function cleanSegment(segment: string): string {
  return decodeURIComponent(segment).trim().replace(/^@/, "");
}

export function parseIdentifier(input: string): ParsedIdentifier {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter a Pump.fun profile URL or wallet address." };
  if (raw.length > 200) return { ok: false, error: "That identifier is too long." };
  if (/[\u0000-\u001f\u007f]/.test(raw)) {
    return { ok: false, error: "That identifier contains invalid characters." };
  }

  let candidate = raw;
  if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return { ok: false, error: "That URL could not be parsed." };
    }
    const host = url.hostname.toLowerCase();
    if (host !== "pump.fun" && host !== "www.pump.fun") {
      return {
        ok: false,
        error: "Only pump.fun profile URLs are accepted. Other links are not fetched.",
      };
    }
    const parts = url.pathname.split("/").filter(Boolean).map(cleanSegment);
    if (parts.length === 1) {
      if (RESERVED.has(parts[0].toLowerCase())) {
        return { ok: false, error: "That pump.fun link is not a profile URL." };
      }
      candidate = parts[0];
    } else if (parts.length === 2 && parts[0].toLowerCase() === "profile") {
      candidate = parts[1];
    } else {
      return { ok: false, error: "Use a profile URL such as https://pump.fun/profile/username." };
    }
  } else if (raw.includes("/") || raw.includes("\\") || raw.includes("?")) {
    return { ok: false, error: "Paste a profile URL or a public wallet address, not a path." };
  } else {
    candidate = cleanSegment(raw);
  }

  if (isSolanaAddress(candidate)) {
    return { ok: true, lookup: candidate, kind: "wallet" };
  }
  if (/^[A-Za-z0-9_.-]{2,32}$/.test(candidate) && !RESERVED.has(candidate.toLowerCase())) {
    return { ok: true, lookup: candidate, kind: "username" };
  }
  return {
    ok: false,
    error: "Enter a valid Pump.fun username or a Solana wallet address.",
  };
}
