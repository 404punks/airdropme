"use client";

import { useState } from "react";
import { shortKey } from "@/lib/utils";

export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm">{shortKey(address)}</span>
      <button type="button" onClick={copy} className="text-sm text-blue hover:text-white">
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
