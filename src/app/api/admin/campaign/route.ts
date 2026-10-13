import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import type { CampaignRecord, CampaignStatus } from "@/server/db/types";
import { errorResponse, readJson, requireAdmin } from "@/server/http";

const STATUSES = new Set<CampaignStatus>(["upcoming", "active", "claim_open", "ended", "paused"]);

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await readJson(request)) as Partial<CampaignRecord>;
    const current = await getStore().getCampaign();
    if (body.status && !STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Unknown campaign status." }, { status: 400 });
    }
    const next: CampaignRecord = {
      ...current,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : current.name,
      status: body.status ?? current.status,
      startsAt: body.startsAt ?? current.startsAt,
      endsAt: body.endsAt ?? current.endsAt,
      claimStartsAt: body.claimStartsAt ?? current.claimStartsAt,
      claimEndsAt: body.claimEndsAt ?? current.claimEndsAt,
      tokenSymbol: body.tokenSymbol ? String(body.tokenSymbol).slice(0, 16) : null,
      totalAllocation: body.totalAllocation ? String(body.totalAllocation).slice(0, 64) : null,
      funded: Boolean(body.funded) && Boolean(body.totalAllocation),
      minPoints: Number.isFinite(Number(body.minPoints)) ? Math.max(0, Math.floor(Number(body.minPoints))) : current.minPoints,
      description: typeof body.description === "string" ? body.description.slice(0, 2000) : current.description,
      distributionEnabled: false,
    };
    if (next.funded && !next.totalAllocation) next.funded = false;
    const saved = await getStore().saveCampaign(next, session.email);
    return NextResponse.json({ message: "Campaign saved. Token distribution remains off in this build.", campaign: saved });
  } catch (error) {
    return errorResponse(error);
  }
}
