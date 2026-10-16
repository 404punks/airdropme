"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ConnectionProvider, useWallet, WalletProvider } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { createSolanaWallets } from "@/components/wallet-adapters";
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

export function ConnectedLogout({
  rpcUrl,
  projectId,
  redirectTo,
}: {
  rpcUrl: string;
  projectId: string;
  redirectTo?: string;
}) {
  const wallets = useMemo(() => createSolanaWallets(rpcUrl, projectId), [rpcUrl, projectId]);
  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <LogoutWhenConnected redirectTo={redirectTo} />
      </WalletProvider>
    </ConnectionProvider>
  );
}

function LogoutWhenConnected({ redirectTo }: { redirectTo?: string }) {
  const { connected, disconnect } = useWallet();
  useEffect(() => {
    function onLogout() {
      void disconnect();
    }
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout);
  }, [disconnect]);
  if (!connected) return null;
  return <LogoutButton redirectTo={redirectTo} />;
}
