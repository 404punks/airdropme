import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { profilePath } from "@/lib/profile-key";
import { formatNumber, formatWhen, metricLabel, shortKey } from "@/lib/utils";
import { explainFormula } from "@/server/points/calculate";
import { getStore } from "@/server/db";
import { publicLeaderboard } from "@/server/services/profiles";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const page = Number(query.page ?? "1");
  const data = await publicLeaderboard(getStore(), query.q ?? "", page);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Leaderboard</h1>
        <p className="mt-3 max-w-3xl text-mute">
          Ranked by the current point total. Flagged and banned profiles are omitted. Demo rows are labeled and are
          not live Pump.fun data.
        </p>
      </div>
      <form className="flex flex-col gap-3 sm:flex-row" action="/leaderboard">
        <label className="sr-only" htmlFor="q">
          Search profile
        </label>
        <Input id="q" name="q" defaultValue={query.q ?? ""} placeholder="Search username or wallet" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {data.rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line p-8 text-mute">
          {getStore().kind === "memory"
            ? "No profiles are stored on this server yet. Submit a Pump.fun username or wallet and the public statistics will load even without DATABASE_URL."
            : "No public profiles match this search."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-3xl border border-line md:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-panel text-mute">
                <tr>
                  {["Rank", "Profile", "Followers", "Callouts", "Likes", "Reposts", "Points", "Updated"].map((heading) => (
                    <th key={heading} className="px-3 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.userId} className="border-t border-line">
                    <td className="px-3 py-3">{row.rank}</td>
                    <td className="px-3 py-3">
                      <Link className="text-acid" href={profilePath(row)}>
                        {row.username ?? shortKey(row.canonicalWallet)}
                      </Link>
                      {row.dataMode === "demo" ? <Badge tone="demo">DEMO</Badge> : null}
                    </td>
                    <td className="px-3 py-3">{metricLabel(row.followersStatus, row.followers)}</td>
                    <td className="px-3 py-3">{metricLabel(row.calloutsStatus, row.callouts)}</td>
                    <td className="px-3 py-3">{metricLabel(row.likesStatus, row.likes)}</td>
                    <td className="px-3 py-3">{metricLabel(row.repostsStatus, row.reposts)}</td>
                    <td className="px-3 py-3">{formatNumber(row.points)}</td>
                    <td className="px-3 py-3">{formatWhen(row.lastFetchedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {data.rows.map((row) => (
              <article key={row.userId} className="rounded-3xl border border-line bg-panel p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-mute">#{row.rank}</p>
                  <p className="font-semibold text-acid">{formatNumber(row.points)} pts</p>
                </div>
                <Link className="mt-1 block text-lg" href={profilePath(row)}>
                  {row.username ?? shortKey(row.canonicalWallet)}
                </Link>
                <p className="mt-2 text-sm text-mute">
                  {metricLabel(row.followersStatus, row.followers)} followers · {metricLabel(row.calloutsStatus, row.callouts)} callouts ·{" "}
                  {metricLabel(row.likesStatus, row.likes)} likes · {metricLabel(row.repostsStatus, row.reposts)} reposts
                </p>
              </article>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center justify-between text-sm">
        <p className="text-mute">
          Page {data.page} of {pages}
        </p>
        <div className="flex gap-3">
          {data.page > 1 ? (
            <Link href={`/leaderboard?q=${encodeURIComponent(query.q ?? "")}&page=${data.page - 1}`}>Previous</Link>
          ) : null}
          {data.page < pages ? (
            <Link href={`/leaderboard?q=${encodeURIComponent(query.q ?? "")}&page=${data.page + 1}`}>Next</Link>
          ) : null}
        </div>
      </div>
      <section className="rounded-3xl border border-line bg-navy p-5 text-sm">
        <h2 className="font-display text-xl">Points disclaimer</h2>
        <ul className="mt-3 space-y-1 text-mute">
          {explainFormula(data.settings).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
