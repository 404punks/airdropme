import { parseIdentifier } from "@/server/validation/identifier";

export function publicProfileKey(user: {
  username: string | null;
  canonicalWallet: string | null;
  pumpUserId: string;
}): string {
  if (user.username && parseIdentifier(user.username).ok) return user.username;
  if (user.canonicalWallet && parseIdentifier(user.canonicalWallet).ok) return user.canonicalWallet;
  return user.pumpUserId;
}

export function profilePath(user: {
  username: string | null;
  canonicalWallet: string | null;
  pumpUserId: string;
}): string {
  return `/p/${encodeURIComponent(publicProfileKey(user))}`;
}
