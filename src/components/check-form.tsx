"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseIdentifier } from "@/server/validation/identifier";

const INVALID = "Enter a Pump.fun username or a valid Solana wallet address.";
const MISSING = "We couldn't find this profile. Please check the username and try again.";
const UNAVAILABLE = "Unable to retrieve your points right now. Please try again.";

export function CheckForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = parseIdentifier(value);
    if (!parsed.ok) {
      setError(parsed.error.startsWith("Enter a ") ? INVALID : parsed.error);
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: value.trim() }),
      });
      const body = (await response.json()) as { error?: string; userId?: string; profileKey?: string; message?: string };
      if (!response.ok || !body.userId) {
        if (response.status === 404) setError(MISSING);
        else if (response.status >= 500) setError(UNAVAILABLE);
        else setError(body.error ?? UNAVAILABLE);
        return;
      }
      const key = body.profileKey || body.userId;
      const notice = body.message ?? "Profile registered from public Pump.fun data.";
      router.push(`/p/${encodeURIComponent(key)}?notice=${encodeURIComponent(notice)}`);
    } catch {
      setError(UNAVAILABLE);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <label className="block text-sm font-medium text-mist" htmlFor="identifier">
        Pump.fun username or wallet address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="identifier"
          name="identifier"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Enter Pump.fun username or Solana wallet address"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="identifier-help"
          aria-invalid={error ? true : undefined}
        />
        <Button type="submit" disabled={pending} className="sm:min-w-44">
          {pending ? "Checking…" : "Check Eligibility"}
        </Button>
      </div>
      <p id="identifier-help" className="text-sm text-mute">
        Enter a public username or wallet address to view your available points and eligibility status.
      </p>
      {error ? (
        <p role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
