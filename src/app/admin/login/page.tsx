import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { config } from "@/server/config";
import { getSession, setSessionCookie } from "@/server/security/session";
import { rateLimit } from "@/server/security/rate-limit";
import { safeEqualString } from "@/server/security/signature";

async function login(formData: FormData) {
  "use server";
  if (!config.adminEnabled) return;
  const limited = rateLimit("admin-login", 8, 15 * 60 * 1000);
  if (!limited.ok) return;
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!safeEqualString(email, config.ADMIN_EMAIL) || !safeEqualString(password, config.ADMIN_PASSWORD)) return;
  await setSessionCookie(email);
  redirect("/admin");
}

export default async function AdminLoginPage() {
  if (await getSession()) redirect("/admin");
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-4xl">Admin</h1>
      {config.adminEnabled ? (
        <form action={login} className="space-y-3 rounded-3xl border border-line bg-panel p-5">
          <label className="block text-sm" htmlFor="email">
            Email
            <Input className="mt-1" id="email" name="email" type="email" autoComplete="username" required />
          </label>
          <label className="block text-sm" htmlFor="password">
            Password
            <Input className="mt-1" id="password" name="password" type="password" autoComplete="current-password" required />
          </label>
          <Button type="submit">Sign in</Button>
        </form>
      ) : (
        <p className="text-sm text-mute">
          Admin login is disabled until ADMIN_EMAIL, ADMIN_PASSWORD, and an ADMIN_SESSION_SECRET of at least 16
          characters are set on the server.
        </p>
      )}
    </div>
  );
}
