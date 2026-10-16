export const REFERRAL_BOOK_KEY = "calloutdrop.wallet-referrals";

export interface SavedReferral {
  wallet: string;
  profileKey: string;
  username: string | null;
  referralLink: string | null;
  points: number | null;
}

export interface ReferralBook {
  lastWallet: string | null;
  stepsComplete: boolean;
  byWallet: Record<string, SavedReferral>;
}

export function emptyReferralBook(): ReferralBook {
  return { lastWallet: null, stepsComplete: false, byWallet: {} };
}

export function rememberWalletReferral(book: ReferralBook, entry: SavedReferral): ReferralBook {
  const wallet = entry.wallet.trim();
  if (!wallet) return book;
  const prior = book.byWallet[wallet];
  const next: SavedReferral = {
    wallet,
    profileKey: entry.profileKey || prior?.profileKey || "",
    username: entry.username ?? prior?.username ?? null,
    referralLink: entry.referralLink ?? prior?.referralLink ?? null,
    points: typeof entry.points === "number" ? entry.points : (typeof prior?.points === "number" ? prior.points : null),
  };
  return {
    lastWallet: wallet,
    stepsComplete: book.stepsComplete,
    byWallet: { ...book.byWallet, [wallet]: next },
  };
}

export function completeReferralSteps(book: ReferralBook): ReferralBook {
  return { ...book, stepsComplete: true };
}

export function logoutCheckSession(book: ReferralBook): ReferralBook {
  return { ...book, stepsComplete: false };
}

export function parseReferralBook(raw: string | null): ReferralBook {
  if (!raw) return emptyReferralBook();
  try {
    const value = JSON.parse(raw) as Partial<ReferralBook>;
    const byWallet: Record<string, SavedReferral> = {};
    const source = value.byWallet && typeof value.byWallet === "object" ? value.byWallet : {};
    for (const [key, item] of Object.entries(source)) {
      if (!item || typeof item !== "object") continue;
      const record = item as Partial<SavedReferral>;
      const wallet = typeof record.wallet === "string" && record.wallet.trim() ? record.wallet.trim() : key.trim();
      if (!wallet) continue;
      byWallet[wallet] = {
        wallet,
        profileKey: typeof record.profileKey === "string" ? record.profileKey : "",
        username: typeof record.username === "string" ? record.username : null,
        referralLink: typeof record.referralLink === "string" ? record.referralLink : null,
        points: typeof record.points === "number" && Number.isFinite(record.points) ? record.points : null,
      };
    }
    const requested = typeof value.lastWallet === "string" ? value.lastWallet : "";
    const lastWallet = byWallet[requested] ? requested : (Object.keys(byWallet).at(-1) ?? null);
    return {
      lastWallet,
      stepsComplete: value.stepsComplete === true,
      byWallet,
    };
  } catch {
    return emptyReferralBook();
  }
}

export function loadReferralBook(storage: Pick<Storage, "getItem"> | null): ReferralBook {
  if (!storage) return emptyReferralBook();
  return parseReferralBook(storage.getItem(REFERRAL_BOOK_KEY));
}

export function saveReferralBook(storage: Pick<Storage, "setItem">, book: ReferralBook): void {
  storage.setItem(REFERRAL_BOOK_KEY, JSON.stringify(book));
}
