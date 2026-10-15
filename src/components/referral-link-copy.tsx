"use client";

import { useMemo, useState } from "react";
import { CopyLink } from "@/components/copy-link";
import { Input } from "@/components/ui/input";
import { referralUrl } from "@/server/referrals/logic";
import { parseIdentifier } from "@/server/validation/identifier";

export function ReferralLinkCopy({ origin }: { origin: string }) {
  const [username, setUsername] = useState("");
  const trimmed = username.trim();
  const parsed = useMemo(() => (trimmed ? parseIdentifier(trimmed) : null), [trimmed]);
  const link = parsed?.ok && parsed.kind === "username" ? referralUrl(origin, parsed.lookup) : null;

  return (
    <section className="border border-line bg-panel p-4 sm:p-6">
      <h2 className="font-display text-xl">Copy your referral link</h2>
      <p className="mt-2 max-w-2xl text-sm text-mute">
        Enter your Pump.fun username. The link uses this website and that username. Copying it does not change referral history.
      </p>
      <label className="mt-4 block text-sm font-medium text-mist" htmlFor="referral-username">
        Pump.fun username
      </label>
      <Input
        id="referral-username"
        name="referral-username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="Your Pump.fun username"
        autoComplete="off"
        spellCheck={false}
        className="mt-2"
      />
      {trimmed && !link ? (
        <p className="mt-3 text-sm text-mute">Referral links use a Pump.fun username. A wallet address does not create one.</p>
      ) : null}
      {link ? (
        <div className="mt-4">
          <CopyLink link={link} />
        </div>
      ) : null}
    </section>
  );
}
