"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CopyLink } from "@/components/copy-link";
import {
  completeReferralSteps,
  emptyReferralBook,
  loadReferralBook,
  rememberWalletReferral,
  saveReferralBook,
  type ReferralBook,
  type SavedReferral,
} from "@/lib/saved-referral";

const X_URL = "https://x.com/calloutdrop";

const WalletCheck = dynamic(() => import("@/components/wallet-check").then((mod) => mod.WalletCheck), {
  ssr: false,
  loading: () => <p className="text-sm text-mute">Loading wallet connection…</p>,
});

export function CheckForm({
  invitedBy = "",
  rpcUrl,
  projectId = "",
}: {
  invitedBy?: string;
  rpcUrl: string;
  projectId?: string;
}) {
  const [book, setBook] = useState<ReferralBook>(emptyReferralBook);
  const [ready, setReady] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [shared, setShared] = useState(false);
  const followedRef = useRef(false);
  const sharedRef = useRef(false);
  const bookRef = useRef<ReferralBook>(emptyReferralBook());

  function persist(next: ReferralBook) {
    bookRef.current = next;
    saveReferralBook(window.localStorage, next);
    setBook(next);
  }

  useEffect(() => {
    const stored = loadReferralBook(window.localStorage);
    bookRef.current = stored;
    setBook(stored);
    if (stored.stepsComplete) {
      followedRef.current = true;
      sharedRef.current = true;
      setFollowed(true);
      setShared(true);
      setReady(true);
    }
  }, []);

  function finishStep(kind: "follow" | "share") {
    if (kind === "follow") {
      followedRef.current = true;
      setFollowed(true);
    } else {
      sharedRef.current = true;
      setShared(true);
    }
    if (followedRef.current && sharedRef.current) {
      setReady(true);
      persist(completeReferralSteps(bookRef.current));
    }
  }

  function remember(entry: SavedReferral) {
    persist(rememberWalletReferral(bookRef.current, entry));
  }

  const saved = book.lastWallet ? book.byWallet[book.lastWallet] : undefined;

  return (
    <div className="space-y-4">
      {saved?.referralLink ? (
        <div className="border border-line bg-navy p-4">
          <p className="text-sm text-mist">Your referral link stays with this wallet. A refresh or disconnect does not remove it.</p>
          <div className="mt-3">
            <CopyLink link={saved.referralLink} />
          </div>
        </div>
      ) : null}
      {ready ? (
        <WalletCheck rpcUrl={rpcUrl} projectId={projectId} onSaved={remember} />
      ) : (
        <div className="flex flex-col gap-3">
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => finishStep("follow")}
            className="inline-flex h-12 w-full items-center justify-center bg-blue px-5 text-sm font-semibold text-ink"
          >
            {followed ? "X Follow · Done" : "X Follow"}
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => finishStep("share")}
            className="inline-flex h-12 w-full items-center justify-center border border-line bg-panel2 px-5 text-sm font-semibold text-mist"
          >
            {shared ? "Like & Retweet · Done" : "Like & Retweet"}
          </a>
          <p className="text-sm text-mute">Open both, then the wallet step starts on its own.</p>
        </div>
      )}
      {invitedBy ? (
        <p className="border border-blue/30 bg-blue/10 px-4 py-3 text-sm text-mist">
          {invitedBy} invited you. They receive 1% of this account&apos;s reward.
        </p>
      ) : null}
    </div>
  );
}
