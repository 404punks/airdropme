import { NextResponse } from "next/server";
import { ServiceError } from "@/server/services/profiles";
import { assertSameOrigin } from "@/server/security/origin";
import { getSession } from "@/server/security/session";

export async function readJson(request: Request): Promise<unknown> {
  assertSameOrigin(request);
  return request.json();
}

export function errorResponse(error: unknown) {
  if (error instanceof ServiceError) {
    return NextResponse.json({ error: error.message, ...(error.extra ?? {}) }, { status: error.status });
  }
  if (error instanceof Error && error.message === "Cross-origin request blocked.") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof Error && error.message === "Admin authorization required.") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  console.error(error);
  return NextResponse.json({ error: "The request could not be completed." }, { status: 500 });
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Admin authorization required.");
  return session;
}
