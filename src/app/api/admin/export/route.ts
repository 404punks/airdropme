import { NextResponse } from "next/server";
import { csvCell } from "@/lib/utils";
import { getStore } from "@/server/db";
import { getSession } from "@/server/security/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });
  const store = getStore();
  const campaign = await store.getCampaign();
  const board = await store.leaderboard("", 1, 5000);
  const rows = board.rows.filter((row) => row.points >= campaign.minPoints && row.dataMode === "live");
  await store.audit(session.email, "export.eligible", campaign.id, { count: rows.length });
  const header = ["rank", "username", "pump_user_id", "canonical_wallet", "followers", "callouts", "likes", "reposts", "points", "last_fetched_at"];
  const csv = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.rank,
        row.username,
        row.pumpUserId,
        row.canonicalWallet,
        row.followers,
        row.callouts,
        row.likes,
        row.reposts,
        row.points,
        row.lastFetchedAt,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=eligible-profiles.csv",
    },
  });
}
