export default function DataSourcesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Data sources</h1>
        <p className="mt-3 max-w-3xl text-mute">
          Checked against live responses from frontend-api-v3.pump.fun on 13 October 2026, using the community index at
          github.com/BankkRoll/pumpfun-apis only as a map. That repository is not an official Pump.fun spec.
        </p>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-panel text-mute">
            <tr>
              {["Field", "Endpoint", "Access", "How used"].map((heading) => (
                <th key={heading} className="px-3 py-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Profile identity", "GET /users/{id}/overview", "Public, no token", "Resolves username, user id, and canonical wallet"],
              ["Followers", "overview counts.followers, else GET /following/v3/followers/count/{userId}", "Public", "Direct count"],
              ["Callouts created", "GET /users/{address}/callout-stats allTime.totalCallouts", "Public", "Direct total"],
              ["Likes and reposts", "GET /callout/list/{userId}", "Public, paginated", "Calculated sum, deduped by calloutId"],
              ["Retweets", "No field", "Unavailable", "Shown as Unavailable"],
              ["Social engagement rollup", "GET /users/{address}/social-stats", "401 without a token", "Not used"],
              ["Global callout ranking API", "GET /callout/leaderboard", "401 without a token", "Not used"],
              ["Follower list", "GET /following/followers/{id}", "403 Client not allowed", "Not used"],
            ].map((row) => (
              <tr key={row[0]} className="border-t border-line">
                {row.map((cell) => (
                  <td key={cell} className="px-3 py-3 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-mute">
        Observed rate-limit headers varied by route, commonly 30 to 60 requests per 60 seconds. Those headers are
        observations, not a published contract. advanced-api-v2.pump.fun did not resolve on the check date. The full
        write-up is in docs/API_FEASIBILITY.md.
      </p>
    </div>
  );
}
