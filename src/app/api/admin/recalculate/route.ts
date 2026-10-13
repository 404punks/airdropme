import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import { errorResponse, requireAdmin } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const store = getStore();
    const count = await store.recalculateAll(await store.getSettings(), session.email);
    return NextResponse.json({ message: `Recalculated ${count} profiles from stored snapshots.` });
  } catch (error) {
    return errorResponse(error);
  }
}
