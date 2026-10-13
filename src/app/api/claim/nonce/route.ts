import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import { errorResponse, readJson } from "@/server/http";
import { issueNonce } from "@/server/services/claims";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { userId?: unknown; wallet?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : "";
    const wallet = typeof body.wallet === "string" ? body.wallet : "";
    const nonce = await issueNonce({ repo: getStore(), userId, wallet });
    return NextResponse.json(nonce);
  } catch (error) {
    return errorResponse(error);
  }
}
