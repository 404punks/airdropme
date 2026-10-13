import { config } from "@/server/config";
import { demoProvider } from "@/server/pumpfun/demo-provider";
import { createLiveProvider } from "@/server/pumpfun/live-provider";
import type { StatsProvider } from "@/server/pumpfun/types";

export function getProvider(): StatsProvider {
  if (config.PUMPFUN_DATA_MODE === "demo") return demoProvider;
  return createLiveProvider({
    baseUrl: config.PUMPFUN_API_BASE_URL,
    token: config.PUMPFUN_API_TOKEN || undefined,
    pageLimit: config.CALLOUT_PAGE_LIMIT,
    maxPages: config.CALLOUT_MAX_PAGES,
  });
}
