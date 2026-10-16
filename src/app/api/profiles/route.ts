import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import { errorResponse, readJson } from "@/server/http";
import { clientIp } from "@/server/security/ip";
import { getProvider } from "@/server/pumpfun";
import { referrerFromCookieHeader } from "@/server/referrals/cookie";
import { originFromHeaders } from "@/server/referrals/logic";
import { profileReferralLink, publicProfileKey, submitProfile } from "@/server/services/profiles";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { identifier?: unknown };
    const identifier = typeof body.identifier === "string" ? body.identifier : "";
    const view = await submitProfile({
      repo: getStore(),
      provider: getProvider(),
      raw: identifier,
      ip: clientIp(request),
      referrerUsername: referrerFromCookieHeader(request.headers.get("cookie")),
      origin: originFromHeaders(request.headers),
    });
    return NextResponse.json({
      userId: view.user.id,
      profileKey: publicProfileKey(view.user),
      created: view.created ?? false,
      message: view.message,
      points: view.user.currentPoints,
      dataMode: view.user.dataMode,
      username: view.user.username,
      wallet: view.user.canonicalWallet,
      referralLink:
        view.user.username && view.user.canonicalWallet
          ? profileReferralLink(view.user.username, originFromHeaders(request.headers))
          : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
