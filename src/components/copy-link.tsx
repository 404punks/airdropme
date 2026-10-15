"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

async function writeClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Some mobile browsers block the async clipboard API. The selection fallback still runs.
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

export function CopyLink({ link, compact = false }: { link: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    const ok = await writeClipboard(link);
    if (!ok) {
      setCopied(false);
      setFailed(true);
      return;
    }
    setFailed(false);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-11 shrink-0 items-center justify-center border border-line bg-panel2 px-3 text-sm font-semibold text-mist"
      >
        {copied ? "Copied" : failed ? "Copy failed" : "Copy"}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <Input readOnly value={link} aria-label="Referral link" onFocus={(event) => event.currentTarget.select()} />
      <button
        type="button"
        onClick={copy}
        className="h-12 w-full border border-line bg-panel2 text-sm font-semibold text-mist sm:w-auto sm:px-5"
      >
        {copied ? "Copied" : "Copy referral link"}
      </button>
      {failed ? <p className="text-sm text-warn">Select the link above and copy it from the menu.</p> : null}
    </div>
  );
}
