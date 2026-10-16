"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal, WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import "@solana/wallet-adapter-react-ui/styles.css";
import { CopyAddress } from "@/components/copy-address";

const MISSING = "We couldn't find this profile. Please check the username and try again.";
const UNAVAILABLE = "Unable to retrieve your points right now. Please try again.";
const X_URL = "https://x.com/calloutdrop";

export function CheckForm({ invitedBy = "", rpcUrl }: { invitedBy?: string; rpcUrl: string }) {
  const [followed, setFollowed] = useState(false);
  const [shared, setShared] = useState(false);
  const ready = followed && shared;

  return (
    <div className="space-y-4">
      {ready ? (
        <WalletCheck rpcUrl={rpcUrl} />
      ) : (
        <div className="flex flex-col gap-3">
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => setFollowed(true)}
            className="inline-flex h-12 w-full items-center justify-center bg-blue px-5 text-sm font-semibold text-ink"
          >
            {followed ? "X Follow · Done" : "X Follow"}
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => setShared(true)}
            className="inline-flex h-12 w-full items-center justify-center border border-line bg-panel2 px-5 text-sm font-semibold text-mist"
          >
            {shared ? "Like & Retweet · Done" : "Like & Retweet"}
          </a>
          <p className="text-sm text-mute">Open both, then the wallet step starts on its own.</p>
        </div>
      )}
      {invitedBy ? (
        <p className="border border-blue/30 bg-blue/10 px-4 py-3 text-sm text-mist">
          {invitedBy} invited you. When this account joins, you both receive 170 PTS.
        </p>
      ) : null}
    </div>
  );
}

function WalletCheck({ rpcUrl }: { rpcUrl: string }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <ConnectAndCheck />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function ConnectAndCheck() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!connected || !publicKey || started.current) return;
    started.current = true;
    const address = publicKey.toBase58();
    setPending(true);
    setError("");
    fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: address }),
    })
      .then(async (response) => {
        const body = (await response.json()) as { error?: string; userId?: string; profileKey?: string; message?: string };
        if (!response.ok || !body.userId) {
          started.current = false;
          if (response.status === 404) setError(MISSING);
          else if (response.status >= 500) setError(UNAVAILABLE);
          else setError(body.error ?? UNAVAILABLE);
          setPending(false);
          return;
        }
        const key = body.profileKey || body.userId;
        const notice = body.message ?? "Profile registered from public Pump.fun data.";
        router.push(`/p/${encodeURIComponent(key)}?notice=${encodeURIComponent(notice)}`);
      })
      .catch(() => {
        started.current = false;
        setError(UNAVAILABLE);
        setPending(false);
      });
  }, [connected, publicKey, router]);

  const address = publicKey?.toBase58() ?? "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-mute">
        Connect a Solana wallet. Checking uses that public address. This step only connects the wallet.
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
        <p className="text-sm text-mist">
          Connected address <CopyAddress address={address} />
        </p>
      ) : (
        <p className="text-sm text-mute">Phantom and Solflare can connect.</p>
      )}
      {error ? (
        <p role="alert" className="rounded-none border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
