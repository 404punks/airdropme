"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RefreshButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/profiles/${userId}/refresh`, { method: "POST" });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(body.error ?? "Refresh failed.");
        return;
      }
      router.replace(`/p/${userId}?notice=${encodeURIComponent(body.message ?? "Snapshot refreshed.")}`);
      router.refresh();
    } catch {
      setError("Refresh failed before Pump.fun responded.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={refresh} disabled={pending}>
        {pending ? "Refreshing…" : "Refresh from Pump.fun"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
