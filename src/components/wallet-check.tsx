"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal, WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { CopyAddress } from "@/components/copy-address";
import { LOGOUT_EVENT } from "@/components/logout-button";
import { createSolanaWallets } from "@/components/wallet-adapters";
import type { SavedReferral } from "@/lib/saved-referral";

const MISSING = "We couldn't find this profile. Please check the username and try again.";
const UNAVAILABLE = "Unable to retrieve your USDC right now. Please try again.";

export function WalletCheck({
  rpcUrl,
  projectId,
  onSaved,
}: {
  rpcUrl: string;
  projectId: string;
  onSaved: (entry: SavedReferral) => void;
}) {
  const wallets = useMemo(() => createSolanaWallets(rpcUrl, projectId), [rpcUrl, projectId]);
  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ConnectAndCheck onSaved={onSaved} walletConnectReady={Boolean(projectId.trim())} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function ConnectAndCheck({
  onSaved,
  walletConnectReady,
}: {
  onSaved: (entry: SavedReferral) => void;
  walletConnectReady: boolean;
}) {
  const router = useRouter();
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const started = useRef("");
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (!connected || !publicKey) return;
    const address = publicKey.toBase58();
    if (started.current === address) return;
    started.current = address;
    setPending(true);
    setError("");
    fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: address }),
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          error?: string;
          userId?: string;
          profileKey?: string;
          message?: string;
          username?: string | null;
          wallet?: string | null;
          referralLink?: string | null;
          points?: number;
        };
        if (!response.ok || !body.userId) {
          started.current = "";
          if (response.status === 404) setError(MISSING);
          else if (response.status >= 500) setError(UNAVAILABLE);
          else setError(body.error ?? UNAVAILABLE);
          setPending(false);
          return;
        }
        const profileKey = body.profileKey || body.userId;
        const entry: SavedReferral = {
          wallet: address,
          profileKey,
          username: body.username ?? null,
          referralLink: body.referralLink ?? null,
          points: typeof body.points === "number" ? body.points : null,
        };
        onSavedRef.current(entry);
        if (body.wallet && body.wallet !== address) onSavedRef.current({ ...entry, wallet: body.wallet });
        const notice = body.message ?? "Profile registered from public Pump.fun data.";
        router.push(`/p/${encodeURIComponent(profileKey)}?notice=${encodeURIComponent(notice)}`);
      })
      .catch(() => {
        started.current = "";
        setError(UNAVAILABLE);
        setPending(false);
      });
  }, [connected, publicKey, router]);

  useEffect(() => {
    function onLogout() {
      started.current = "";
      void disconnect();
    }
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout);
  }, [disconnect]);

  const address = publicKey?.toBase58() ?? "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-mute">
        Connect a Solana wallet with WalletConnect, Phantom, or Solflare. Chrome and wallet apps can connect. This step
        only connects the wallet and does not ask for a seed phrase.
      </p>
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center bg-blue px-5 text-sm font-semibold text-ink disabled:opacity-50"
      >
        {pending ? "Checking…" : "Connect Solana Wallet"}
      </button>
      {connected && address ? (
        <div className="text-sm text-mist">
          <p>
            Connected address <CopyAddress address={address} />
          </p>
          <button type="button" className="mt-2 text-sm text-blue" onClick={() => disconnect()}>
            Disconnect wallet
          </button>
          <p className="mt-1 text-mute">Disconnecting does not remove the referral link saved for this wallet.</p>
        </div>
      ) : (
        <p className="text-sm text-mute">
          {walletConnectReady
            ? "Choose WalletConnect for a phone wallet, or Phantom and Solflare in Chrome."
            : "Phantom and Solflare can connect in Chrome."}
        </p>
      )}
      {error ? (
        <p role="alert" className="rounded-none border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
