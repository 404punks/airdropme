import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import { errorResponse, readJson, requireAdmin } from "@/server/http";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await readJson(request)) as { userId?: unknown; flagged?: unknown; reason?: unknown };
    if (typeof body.userId !== "string") return NextResponse.json({ error: "Missing profile." }, { status: 400 });
    const user = await getStore().setFlag(
      body.userId,
      Boolean(body.flagged),
      typeof body.reason === "string" ? body.reason.slice(0, 200) : null,
      session.email,
    );
    return NextResponse.json({ message: user.flagged ? "Profile flagged." : "Flag removed.", userId: user.id });
  } catch (error) {
    return errorResponse(error);
  }
}
