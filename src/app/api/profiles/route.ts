import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import { errorResponse, readJson } from "@/server/http";
import { clientIp } from "@/server/security/ip";
import { getProvider } from "@/server/pumpfun";
import { publicProfileKey, submitProfile } from "@/server/services/profiles";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { identifier?: unknown };
    const identifier = typeof body.identifier === "string" ? body.identifier : "";
    const view = await submitProfile({
      repo: getStore(),
      provider: getProvider(),
      raw: identifier,
      ip: clientIp(request),
    });
    return NextResponse.json({
      userId: view.user.id,
      profileKey: publicProfileKey(view.user),
      created: view.created ?? false,
      message: view.message,
      points: view.user.currentPoints,
      dataMode: view.user.dataMode,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
