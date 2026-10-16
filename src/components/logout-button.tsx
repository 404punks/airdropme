"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { loadReferralBook, logoutCheckSession, saveReferralBook } from "@/lib/saved-referral";

export const LOGOUT_EVENT = "calloutdrop-logout";
const WALLET_NAME_KEY = "walletName";

export function logoutSession(): void {
  const book = loadReferralBook(window.localStorage);
  saveReferralBook(window.localStorage, logoutCheckSession(book));
  window.localStorage.removeItem(WALLET_NAME_KEY);
  window.dispatchEvent(new Event(LOGOUT_EVENT));
}

export function LogoutButton({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => {
        logoutSession();
        if (redirectTo) router.push(redirectTo);
      }}
    >
      Log out
    </Button>
  );
}
