export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) throw new Error("Cross-origin request blocked.");
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("Cross-origin request blocked.");
  }
  if (parsed.host !== host) throw new Error("Cross-origin request blocked.");
}
