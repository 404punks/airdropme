import { NextResponse } from "next/server";
import { assertPumpBaseUrl, config } from "@/server/config";
import { getStore } from "@/server/db";
import { pumpMetrics } from "@/server/pumpfun/http";

export async function GET() {
  const metrics = pumpMetrics();
  let apiHost = "invalid";
  try {
    apiHost = assertPumpBaseUrl(config.PUMPFUN_API_BASE_URL).host;
  } catch {
    apiHost = "invalid";
  }
  const counts = await getStore().counts();
  return NextResponse.json({
    ok: true,
    dataMode: config.PUMPFUN_DATA_MODE,
    store: getStore().kind,
    apiHost,
    distributionEnabled: false,
    counts,
    lastSuccessAt: metrics.lastSuccessAt,
    lastError: metrics.lastError,
  });
}
