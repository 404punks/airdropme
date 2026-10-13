import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import { errorResponse, readJson, requireAdmin } from "@/server/http";
import { sanitizeSettings, type ScoringSettings } from "@/server/points/calculate";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await readJson(request)) as Partial<ScoringSettings>;
    const store = getStore();
    const next = sanitizeSettings(body, await store.getSettings());
    await store.saveSettings(next, session.email);
    return NextResponse.json({ message: `Scoring saved as formula version ${next.formulaVersion}.`, settings: next });
  } catch (error) {
    return errorResponse(error);
  }
}
