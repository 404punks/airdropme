import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { assertPumpBaseUrl, config } from "@/server/config";
import { getStore } from "@/server/db";
import { pumpMetrics } from "@/server/pumpfun/http";
import { clearSessionCookie, getSession } from "@/server/security/session";

async function logout() {
  "use server";
  await clearSessionCookie();
  redirect("/admin/login");
}

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const store = getStore();
  const [settings, campaign, users, claims, failures, audit, counts] = await Promise.all([
    store.getSettings(),
    store.getCampaign(),
    store.listUsers("", 1, 100),
    store.listClaims(),
    store.listFailures(50),
    store.listAudit(50),
    store.counts(),
  ]);
  const metrics = pumpMetrics();
  let apiHost = "unconfigured";
  try {
    apiHost = assertPumpBaseUrl(config.PUMPFUN_API_BASE_URL).host;
  } catch {
    apiHost = "invalid";
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl">Admin</h1>
        <form action={logout}>
          <button className="text-sm text-mute" type="submit">
            Sign out
          </button>
        </form>
      </div>
      <AdminDashboard
        data={{
          settings,
          campaign,
          users: users.rows,
          claims,
          failures,
          audit,
          counts,
          health: {
            dataMode: config.PUMPFUN_DATA_MODE,
            store: store.kind,
            apiHost,
            lastSuccessAt: metrics.lastSuccessAt,
            lastErrorAt: metrics.lastErrorAt,
            lastError: metrics.lastError,
            rateLimitRemaining: metrics.rateLimitRemaining,
            rateLimitLimit: metrics.rateLimitLimit,
          },
        }}
      />
    </div>
  );
}
