"use client";

import { useState } from "react";

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="break-all text-sm text-mist">{link}</p>
      <button type="button" onClick={copy} className="h-12 w-full border border-line bg-panel2 text-sm font-semibold text-mist sm:w-auto sm:px-5">
        {copied ? "Copied" : "Copy referral link"}
      </button>
    </div>
  );
}
