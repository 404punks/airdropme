"use client";

import { useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import bs58 from "bs58";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ClaimInner({ rpcUrl }: { rpcUrl: string }) {
  const { publicKey, signMessage, connected } = useWallet();
  const [profileId, setProfileId] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function start() {
    if (!publicKey) return;
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
        setError(body.error ?? "A claim nonce could not be issued.");
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
        setError(claimBody.error ?? "Claim registration failed.");
        return;
      }
      setMessage(body.message);
      setStatus(claimBody.status ?? "registered");
      setTx(claimBody.txSignature ?? null);
      setResult(claimBody.message ?? "Claim registration recorded.");
    } catch {
      setError("The wallet signature was cancelled or the request failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-mute">Endpoint used by the adapter: {rpcUrl}. No transaction is sent by this page.</p>
      <WalletMultiButton />
      <label className="block text-sm font-medium" htmlFor="profileId">
        Registered profile id
      </label>
      <Input
        id="profileId"
        value={profileId}
        onChange={(event) => setProfileId(event.target.value)}
        placeholder="Profile id from your statistics page"
        spellCheck={false}
      />
      <Button type="button" onClick={start} disabled={!connected || pending || !profileId.trim()}>
        {pending ? "Waiting for signature…" : "Sign claim registration"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {result ? (
        <div className="rounded-2xl border border-line bg-ink/50 p-4 text-sm">
          <p className="font-semibold text-acid">{result}</p>
          <p className="mt-2 text-mute">Status: {status || "registered"}. This is a claim record, not a token transfer.</p>
          {tx ? (
            <a className="mt-2 inline-block text-violet" href={`https://solscan.io/tx/${tx}`} target="_blank" rel="noreferrer">
              View {tx} on Solscan
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

export function ClaimFlow({ rpcUrl }: { rpcUrl: string }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ClaimInner rpcUrl={rpcUrl} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
