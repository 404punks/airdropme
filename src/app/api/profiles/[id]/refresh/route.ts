import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import { errorResponse } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";
import { clientIp } from "@/server/security/ip";
import { getProvider } from "@/server/pumpfun";
import { publicProfileKey, submitProfile } from "@/server/services/profiles";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const store = getStore();
    const stored =
      (await store.findUserById(id)) ??
      (await store.findUserByUsername(id)) ??
      (await store.findUserByWallet(id)) ??
      (await store.findUserByPumpId(id));
    const lookup = stored?.username ?? stored?.canonicalWallet ?? stored?.pumpUserId ?? decodeURIComponent(id);
    const view = await submitProfile({
      repo: store,
      provider: getProvider(),
      raw: lookup,
      ip: clientIp(request),
      force: true,
    });
    return NextResponse.json({
      userId: view.user.id,
      profileKey: publicProfileKey(view.user),
      message: view.message,
      points: view.user.currentPoints,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
