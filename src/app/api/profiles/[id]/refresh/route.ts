import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import { errorResponse } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";
import { clientIp } from "@/server/security/ip";
import { getProvider } from "@/server/pumpfun";
import { ServiceError, submitProfile, viewProfile } from "@/server/services/profiles";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const existing = await viewProfile(getStore(), id);
    const lookup = existing.user.username ?? existing.user.canonicalWallet ?? existing.user.pumpUserId;
    const view = await submitProfile({
      repo: getStore(),
      provider: getProvider(),
      raw: lookup,
      ip: clientIp(request),
      force: true,
    });
    return NextResponse.json({ userId: view.user.id, message: view.message, points: view.user.currentPoints });
  } catch (error) {
    if (error instanceof ServiceError) return errorResponse(error);
    return errorResponse(error);
  }
}
