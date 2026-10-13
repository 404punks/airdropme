"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CampaignRecord, ClaimRecord, FailureRecord, UserRecord } from "@/server/db/types";
import type { ScoringSettings } from "@/server/points/calculate";
import { formatNumber, formatWhen } from "@/lib/utils";

export interface AdminData {
  settings: ScoringSettings;
  campaign: CampaignRecord;
  users: UserRecord[];
  claims: ClaimRecord[];
  failures: FailureRecord[];
  audit: { id: string; actor: string; action: string; target: string | null; createdAt: string }[];
  counts: { users: number; snapshots: number; claims: number; failures: number };
  health: {
    dataMode: string;
    store: string;
    apiHost: string;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    rateLimitRemaining: string | null;
    rateLimitLimit: string | null;
  };
}

const statuses = ["upcoming", "active", "claim_open", "ended", "paused"] as const;

export function AdminDashboard({ data }: { data: AdminData }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(data.settings);
  const [campaign, setCampaign] = useState(data.campaign);

  async function post(url: string, body: unknown) {
    setError("");
    setNotice("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(payload.error ?? "Request failed.");
      return;
    }
    setNotice(payload.message ?? "Saved.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {notice ? <p className="text-sm text-acid">{notice}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Profiles", data.counts.users],
          ["Snapshots", data.counts.snapshots],
          ["Claims", data.counts.claims],
          ["Fetch failures", data.counts.failures],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-3xl border border-line bg-panel p-4">
            <p className="text-sm text-mute">{label}</p>
            <p className="font-display text-3xl">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-2xl">API health</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>Data mode: {data.health.dataMode}</div>
          <div>Store: {data.health.store}</div>
          <div>API host: {data.health.apiHost}</div>
          <div>
            Observed limit remaining: {data.health.rateLimitRemaining ?? "—"} / {data.health.rateLimitLimit ?? "—"}
          </div>
          <div>Last success: {formatWhen(data.health.lastSuccessAt)}</div>
          <div>Last error: {data.health.lastError ?? "None"} {data.health.lastErrorAt ? `(${formatWhen(data.health.lastErrorAt)})` : ""}</div>
        </dl>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-2xl">Scoring weights</h2>
        <p className="mt-2 text-sm text-mute">Formula version {settings.formulaVersion}. Saving a change increments the version.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(
            [
              ["pointsPerFollower", "Points per follower"],
              ["pointsPerCallout", "Points per Callout"],
              ["pointsPerLike", "Points per like"],
              ["pointsPerRepost", "Points per repost"],
              ["capFollowers", "Follower cap"],
              ["capCallouts", "Callout cap"],
              ["capLikes", "Like cap"],
              ["capReposts", "Repost cap"],
              ["capTotalPoints", "Total points cap"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={settings[key]}
                onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" onClick={() => post("/api/admin/settings", settings)}>
            Save scoring
          </Button>
          <Button type="button" variant="outline" onClick={() => post("/api/admin/recalculate", {})}>
            Recalculate stored snapshots
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-2xl">Campaign</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Name
            <Input className="mt-1" value={campaign.name} onChange={(event) => setCampaign({ ...campaign, name: event.target.value })} />
          </label>
          <label className="text-sm">
            Status
            <select
              className="mt-1 h-12 w-full rounded-2xl border border-line bg-ink px-3"
              value={campaign.status}
              onChange={(event) => setCampaign({ ...campaign, status: event.target.value as CampaignRecord["status"] })}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Minimum points
            <Input className="mt-1" type="number" min={0} value={campaign.minPoints} onChange={(event) => setCampaign({ ...campaign, minPoints: Number(event.target.value) })} />
          </label>
          <label className="text-sm">
            Token symbol, only if real
            <Input className="mt-1" value={campaign.tokenSymbol ?? ""} onChange={(event) => setCampaign({ ...campaign, tokenSymbol: event.target.value || null })} />
          </label>
          <label className="text-sm">
            Total allocation, blank if not configured
            <Input className="mt-1" value={campaign.totalAllocation ?? ""} onChange={(event) => setCampaign({ ...campaign, totalAllocation: event.target.value || null })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={campaign.funded} onChange={(event) => setCampaign({ ...campaign, funded: event.target.checked })} />
            Allocation is funded
          </label>
          {(
            [
              ["startsAt", "Starts"],
              ["endsAt", "Ends"],
              ["claimStartsAt", "Claim opens"],
              ["claimEndsAt", "Claim closes"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <Input
                className="mt-1"
                type="datetime-local"
                value={toLocalInput(campaign[key])}
                onChange={(event) =>
                  setCampaign({ ...campaign, [key]: event.target.value ? new Date(event.target.value).toISOString() : null })
                }
              />
            </label>
          ))}
          <label className="text-sm md:col-span-2">
            Description
            <textarea
              className="mt-1 min-h-28 w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm"
              value={campaign.description}
              onChange={(event) => setCampaign({ ...campaign, description: event.target.value })}
            />
          </label>
        </div>
        <Button className="mt-4" type="button" onClick={() => post("/api/admin/campaign", campaign)}>
          Save campaign
        </Button>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Profiles</h2>
          <a className="text-sm text-acid" href="/api/admin/export">
            Export eligible CSV
          </a>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-mute">
              <tr>
                <th className="py-2">Profile</th>
                <th>Points</th>
                <th>Updated</th>
                <th>Mode</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id} className="border-t border-line">
                  <td className="py-3">
                    <a className="text-acid" href={`/p/${encodeURIComponent(user.username ?? user.canonicalWallet ?? user.pumpUserId)}`}>
                      {user.username ?? user.pumpUserId}
                    </a>
                    <p className="text-xs text-mute">{user.flagged ? `Flagged: ${user.flagReason ?? "yes"}` : user.canonicalWallet}</p>
                  </td>
                  <td>{formatNumber(user.currentPoints)}</td>
                  <td>{formatWhen(user.lastFetchedAt)}</td>
                  <td>{user.dataMode}</td>
                  <td>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        post("/api/admin/flag", {
                          userId: user.id,
                          flagged: !user.flagged,
                          reason: user.flagged ? null : "Marked for review",
                        })
                      }
                    >
                      {user.flagged ? "Unflag" : "Flag"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.users.length === 0 ? <p className="text-sm text-mute">No profiles submitted.</p> : null}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-2xl">Failed fetches</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.failures.map((failure) => (
            <li key={failure.id} className="rounded-2xl bg-ink/40 px-3 py-2">
              {failure.endpoint} · {failure.statusCode ?? "network"} · {failure.message}
            </li>
          ))}
          {data.failures.length === 0 ? <li className="text-mute">No failed fetches recorded.</li> : null}
        </ul>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-2xl">Claims</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.claims.map((claim) => (
            <li key={claim.id}>
              {claim.status} · {claim.wallet} · {formatNumber(claim.pointsAtClaim)} pts
              {claim.failureReason ? ` · ${claim.failureReason}` : ""}
              {claim.txSignature ? ` · ${claim.txSignature}` : ""}
            </li>
          ))}
          {data.claims.length === 0 ? <li className="text-mute">No claim records.</li> : null}
        </ul>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-2xl">Audit log</h2>
        <ul className="mt-3 space-y-2 text-sm text-mute">
          {data.audit.map((row) => (
            <li key={row.id}>
              {formatWhen(row.createdAt)} · {row.actor} · {row.action} · {row.target}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
