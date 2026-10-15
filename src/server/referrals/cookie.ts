import { parseIdentifier } from "@/server/validation/identifier";

export const REFERRER_COOKIE = "am_ref";

export function referrerFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== REFERRER_COOKIE) continue;
    let raw = rest.join("=");
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return null;
    }
    const parsed = parseIdentifier(raw);
    if (!parsed.ok || parsed.kind !== "username") return null;
    return parsed.lookup;
  }
  return null;
}
