"use client";

import { useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import bs58 from "bs58";
import "@solana/wallet-adapter-react-ui/styles.css";
import { CopyAddress } from "@/components/copy-address";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shortKey } from "@/lib/utils";

function networkLabel(rpcUrl: string): string {
  if (rpcUrl.includes("devnet")) return "Solana Devnet";
  if (rpcUrl.includes("testnet")) return "Solana Testnet";
  return "Solana Mainnet";
}

function ClaimInner({ rpcUrl, distributionEnabled }: { rpcUrl: string; distributionEnabled: boolean }) {
  const { publicKey, signMessage, connected, disconnect, wallet } = useWallet();
  const [profileId, setProfileId] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const network = networkLabel(rpcUrl);

  async function start() {
    if (!publicKey || pending) return;
    setPending(true);
    setError("");
    setResult("");
    try {
      const response = await fetch("/api/claim/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profileId.trim(), wallet: publicKey.toBase58() }),
      });
      const body = (await response.json()) as { error?: string; message?: string; nonce?: string };
      if (!response.ok || !body.message || !body.nonce) {
        setError(body.error ?? "A claim could not be started.");
        return;
      }
      if (!signMessage) {
        setError("This wallet cannot sign messages in the browser.");
        return;
      }
      const signatureBytes = await signMessage(new TextEncoder().encode(body.message));
      const signature = bs58.encode(signatureBytes);
      const claim = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profileId.trim(),
          wallet: publicKey.toBase58(),
          nonce: body.nonce,
          signature,
        }),
      });
      const claimBody = (await claim.json()) as {
        error?: string;
        status?: string;
        txSignature?: string | null;
        failureReason?: string | null;
        message?: string;
      };
      if (!claim.ok) {
        setError(claimBody.error ?? "The claim was not completed.");
        return;
      }
      setMessage(body.message);
      setStatus(claimBody.status ?? "registered");
      setTx(claimBody.txSignature ?? null);
      if (claimBody.txSignature) {
        setResult("Your transaction was submitted. Waiting for network confirmation.");
      } else if (claimBody.status === "failed") {
        setResult(claimBody.failureReason ?? "Your transaction was not completed. Check your wallet and try again if needed.");
      } else {
        setResult(claimBody.message ?? "Claim registration recorded. No token transfer was sent.");
      }
      setConfirming(false);
    } catch {
      setError("Connection was cancelled. You can try again whenever you're ready.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-mute">Connect your Solana wallet to continue. Expected network: {network}.</p>
      {wallet && connected ? null : <WalletMultiButton />}
      {connected && publicKey ? (
        <div className="rounded-none border border-line bg-ink/60 p-4 text-sm">
          <p className="text-acid">Wallet connected successfully.</p>
          <p className="mt-2">
            <CopyAddress address={publicKey.toBase58()} />
          </p>
          <p className="mt-1 text-mute">Connected with {wallet?.adapter.name ?? "a Solana wallet"} on {network}.</p>
          <button type="button" className="mt-3 text-sm text-blue" onClick={() => disconnect()}>
            Disconnect Wallet
          </button>
        </div>
      ) : (
        <p className="text-sm text-mute">Phantom and Solflare are supported.</p>
      )}
      {!distributionEnabled ? (
        <p className="rounded-none border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Token distribution is not active. A signature only registers a claim request. It does not send tokens.
        </p>
      ) : null}
      <label className="block text-sm font-medium" htmlFor="profileId">
        Profile id from your PTS page
      </label>
      <Input
        id="profileId"
        value={profileId}
        onChange={(event) => setProfileId(event.target.value)}
        placeholder="Profile id"
        spellCheck={false}
        autoComplete="off"
      />
      {!confirming ? (
        <Button type="button" onClick={() => setConfirming(true)} disabled={!connected || !profileId.trim()}>
          Review Claim
        </Button>
      ) : (
        <div className="space-y-3 rounded-none border border-line bg-navy p-4 text-sm">
          <p>Review the destination wallet {publicKey ? shortKey(publicKey.toBase58()) : ""} before you approve a signature.</p>
          <p className="text-mute">No claim amount is shown because the backend has not confirmed a token payment.</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={start} disabled={pending}>
              {pending ? "Waiting for wallet…" : distributionEnabled ? "Claim Airdrop" : "Register claim"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Back
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="rounded-none border border-line bg-ink/50 p-4 text-sm">
          <p className="font-medium text-mist">{result}</p>
          <p className="mt-2 text-mute">Status: {status || "registered"}. This record is not a completed token transfer unless a transaction signature is shown.</p>
          {tx ? (
            <a className="mt-2 inline-block text-blue" href={`https://solscan.io/tx/${tx}`} target="_blank" rel="noreferrer">
              View Transaction
            </a>
          ) : (
            <p className="mt-2 text-mute">No transaction signature exists because distribution is not configured.</p>
          )}
          {message ? <pre className="mt-3 whitespace-pre-wrap text-xs text-mute">{message}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ClaimFlow({ rpcUrl, distributionEnabled }: { rpcUrl: string; distributionEnabled: boolean }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ClaimInner rpcUrl={rpcUrl} distributionEnabled={distributionEnabled} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
