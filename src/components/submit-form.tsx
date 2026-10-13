"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SubmitForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: value }),
      });
      const body = (await response.json()) as { error?: string; userId?: string; message?: string };
      if (!response.ok || !body.userId) {
        setError(body.error ?? "The profile could not be submitted.");
        return;
      }
      router.push(`/p/${body.userId}?notice=${encodeURIComponent(body.message ?? "Profile saved.")}`);
    } catch {
      setError("The request failed before a profile could be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <label className="block text-sm font-medium" htmlFor="identifier">
        Pump.fun profile URL or wallet address
      </label>
      <Input
        id="identifier"
        name="identifier"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="https://pump.fun/profile/username"
        autoComplete="off"
        spellCheck={false}
        required
        aria-describedby="identifier-help"
      />
      <p id="identifier-help" className="text-sm text-mute">
        No wallet connection and no signature are required to register or refresh statistics.
      </p>
      {error ? (
        <p role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Checking public data…" : "Submit profile"}
      </Button>
    </form>
  );
}
