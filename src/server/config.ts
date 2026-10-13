import { z } from "zod";

const schema = z.object({
  PUMPFUN_API_BASE_URL: z.string().default("https://frontend-api-v3.pump.fun"),
  PUMPFUN_API_TOKEN: z.string().default(""),
  PUMPFUN_DATA_MODE: z.enum(["live", "demo"]).default("live"),
  DATABASE_URL: z.string().default(""),
  ADMIN_EMAIL: z.string().default(""),
  ADMIN_PASSWORD: z.string().default(""),
  ADMIN_SESSION_SECRET: z.string().default(""),
  IP_HASH_SALT: z.string().default("dev-only-ip-salt"),
  DISTRIBUTION_ENABLED: z.enum(["true", "false"]).default("false"),
  SOLANA_RPC_URL: z.string().default("https://api.mainnet-beta.solana.com"),
  STATS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  MIN_REFRESH_SECONDS: z.coerce.number().int().nonnegative().default(60),
  SUBMISSIONS_PER_WINDOW: z.coerce.number().int().positive().default(8),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(600),
  CALLOUT_PAGE_LIMIT: z.coerce.number().int().min(1).max(100).default(50),
  CALLOUT_MAX_PAGES: z.coerce.number().int().min(1).max(40).default(20),
});

export type AppConfig = z.infer<typeof schema> & {
  distributionEnabled: boolean;
  adminEnabled: boolean;
};

const DATABASE_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "SUPABASE_DATABASE_URL",
] as const;

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  for (const key of DATABASE_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  const host = env.PGHOST?.trim();
  const user = env.PGUSER?.trim();
  const database = env.PGDATABASE?.trim();
  if (!host || !user || !database) return "";
  const password = env.PGPASSWORD ?? "";
  const port = env.PGPORT?.trim() || "5432";
  const userInfo = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user);
  return `postgresql://${userInfo}@${host}:${port}/${encodeURIComponent(database)}`;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.parse(env);
  const adminEnabled = Boolean(
    parsed.ADMIN_EMAIL && parsed.ADMIN_PASSWORD && parsed.ADMIN_SESSION_SECRET.length >= 16,
  );
  return {
    ...parsed,
    DATABASE_URL: resolveDatabaseUrl(env),
    distributionEnabled: parsed.DISTRIBUTION_ENABLED === "true",
    adminEnabled,
  };
}

export const config = readConfig();

export const ALLOWED_PUMP_HOSTS = new Set(["frontend-api-v3.pump.fun"]);

export function assertPumpBaseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Pump.fun API base URL is invalid.");
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (local) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Local Pump.fun base URL must be http or https.");
    }
    return url;
  }
  if (url.protocol !== "https:" || !ALLOWED_PUMP_HOSTS.has(url.hostname)) {
    throw new Error("Pump.fun API base URL is not on the allowlist.");
  }
  return url;
}
