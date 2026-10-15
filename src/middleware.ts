import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { REFERRER_COOKIE } from "@/server/referrals/cookie";
import { parseIdentifier } from "@/server/validation/identifier";

export function middleware(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  const response = NextResponse.next();
  if (!ref) return response;
  const parsed = parseIdentifier(ref);
  if (!parsed.ok || parsed.kind !== "username") return response;
  response.cookies.set(REFERRER_COOKIE, parsed.lookup, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|logo.png|favicon.ico).*)"],
};
