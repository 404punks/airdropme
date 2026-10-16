"use client";

import { useEffect, useState } from "react";
import { UsdcAmount } from "@/components/usdc-amount";
import { loadReferralBook } from "@/lib/saved-referral";

export function ClaimReward() {
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    const book = loadReferralBook(window.localStorage);
    const saved = book.lastWallet ? book.byWallet[book.lastWallet] : undefined;
    if (!saved) return;
    if (typeof saved.points === "number") setPoints(saved.points);
    if (!saved.profileKey) return;
    let cancelled = false;
    fetch(`/api/profiles/${encodeURIComponent(saved.profileKey)}`)
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { points?: unknown };
        if (cancelled || typeof body.points !== "number") return;
        setPoints(body.points);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (points == null) return null;

  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-[0.16em] text-mute">Your reward</p>
      <p className="mt-2 font-display text-3xl text-mist">
        <UsdcAmount points={points} markClassName="h-6 w-6" />
      </p>
    </div>
  );
}
