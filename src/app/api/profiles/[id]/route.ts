import { NextResponse } from "next/server";
import { getStore } from "@/server/db";
import { errorResponse } from "@/server/http";
import { publicProfileKey, viewProfile } from "@/server/services/profiles";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const view = await viewProfile(getStore(), decodeURIComponent(id));
    return NextResponse.json({
      points: view.user.currentPoints,
      username: view.user.username,
      profileKey: publicProfileKey(view.user),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
