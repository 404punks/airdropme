import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import { errorResponse, readJson } from "@/server/http";
import { registerClaim, resolveDistributor } from "@/server/services/claims";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as {
      userId?: unknown;
      wallet?: unknown;
      nonce?: unknown;
      signature?: unknown;
    };
    const claim = await registerClaim({
      repo: getStore(),
      distributor: resolveDistributor(),
      userId: typeof body.userId === "string" ? body.userId : "",
      wallet: typeof body.wallet === "string" ? body.wallet : "",
      nonce: typeof body.nonce === "string" ? body.nonce : "",
      signature: typeof body.signature === "string" ? body.signature : "",
    });
    const message =
      claim.status === "registered"
        ? "Claim registration recorded. No tokens were sent."
        : claim.status === "failed"
          ? "The claim was recorded as failed. No tokens were sent."
          : `Claim status: ${claim.status}.`;
    return NextResponse.json({
      id: claim.id,
      status: claim.status,
      txSignature: claim.txSignature,
      failureReason: claim.failureReason,
      message,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
