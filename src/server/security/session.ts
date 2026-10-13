import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "@/server/config";

const COOKIE = "airdropme_admin";

export interface AdminSession {
  email: string;
  role: "admin";
  exp: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeSession(session: AdminSession, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeSession(token: string, secret: string): AdminSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !secret) return null;
  const expected = sign(payload, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (parsed.role !== "admin" || typeof parsed.email !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AdminSession | null> {
  if (!config.adminEnabled) return null;
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token, config.ADMIN_SESSION_SECRET);
}

export async function setSessionCookie(email: string): Promise<void> {
  const jar = await cookies();
  const token = encodeSession(
    { email, role: "admin", exp: Date.now() + 1000 * 60 * 60 * 12 },
    config.ADMIN_SESSION_SECRET,
  );
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function requireSession(session: AdminSession | null): AdminSession {
  if (!session || session.role !== "admin") {
    throw new Error("Admin authorization required.");
  }
  return session;
}
