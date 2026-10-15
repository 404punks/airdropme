import https from "node:https";
import { assertPumpBaseUrl } from "@/server/config";

export class PumpRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = "PumpRequestError";
  }
}

export interface PumpResponse {
  status: number;
  json: unknown;
  rateLimit: { limit: string | null; remaining: string | null; reset: string | null };
}

const metrics = {
  lastSuccessAt: null as string | null,
  lastErrorAt: null as string | null,
  lastError: null as string | null,
  lastStatus: null as number | null,
  rateLimitRemaining: null as string | null,
  rateLimitLimit: null as string | null,
};

export function pumpMetrics() {
  return { ...metrics };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RawResponse {
  status: number;
  body: string;
  header(name: string): string | null;
}

function nodeGet(url: URL, headers: Record<string, string>, timeoutMs: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            header(name: string) {
              const value = res.headers[name.toLowerCase()];
              if (Array.isArray(value)) return value[0] ?? null;
              return value ?? null;
            },
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function fetchGet(url: URL, headers: Record<string, string>, timeoutMs: number, fetchImpl: typeof fetch): Promise<RawResponse> {
  const response = await fetchImpl(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  return {
    status: response.status,
    body: await response.text(),
    header(name: string) {
      return response.headers.get(name);
    },
  };
}

export async function pumpGet(options: {
  baseUrl: string;
  path: string;
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
}): Promise<PumpResponse> {
  if (!options.path.startsWith("/") || options.path.startsWith("//") || options.path.includes("://")) {
    throw new PumpRequestError("Blocked a non-relative Pump.fun path.", null, options.path);
  }
  const base = assertPumpBaseUrl(options.baseUrl);
  const url = new URL(options.path, base);
  if (url.origin !== base.origin) {
    throw new PumpRequestError("Blocked a request that left the Pump.fun API origin.", null, options.path);
  }
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 8000;
  let lastError: PumpRequestError | null = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        Origin: "https://pump.fun",
        "User-Agent": "Mozilla/5.0 (compatible; CalloutDrop/1.0; +https://pump.fun)",
      };
      if (options.token) headers.Authorization = `Bearer ${options.token}`;
      const response = options.fetchImpl
        ? await fetchGet(url, headers, timeoutMs, options.fetchImpl)
        : await nodeGet(url, headers, timeoutMs);
      const rateLimit = {
        limit: response.header("x-ratelimit-limit"),
        remaining: response.header("x-ratelimit-remaining"),
        reset: response.header("x-ratelimit-reset"),
      };
      metrics.rateLimitLimit = rateLimit.limit;
      metrics.rateLimitRemaining = rateLimit.remaining;
      let json: unknown = null;
      if (response.body) {
        try {
          json = JSON.parse(response.body);
        } catch {
          json = { raw: response.body.slice(0, 300) };
        }
      }
      if (response.status >= 200 && response.status < 300) {
        metrics.lastSuccessAt = new Date().toISOString();
        metrics.lastStatus = response.status;
        return { status: response.status, json, rateLimit };
      }
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new PumpRequestError(`Pump.fun returned ${response.status}.`, response.status, options.path);
      metrics.lastErrorAt = new Date().toISOString();
      metrics.lastError = lastError.message;
      metrics.lastStatus = response.status;
      if (!retryable || attempt === retries - 1) throw lastError;
      const retryAfter = Number(response.header("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt;
      await sleep(Math.min(backoff, 5000));
    } catch (error) {
      if (error instanceof PumpRequestError) {
        if (attempt === retries - 1) throw error;
        const retryable = error.status === 429 || (error.status != null && error.status >= 500);
        if (!retryable) throw error;
        await sleep(400 * 2 ** attempt);
        continue;
      }
      lastError = new PumpRequestError("The Pump.fun request timed out or failed.", null, options.path);
      metrics.lastErrorAt = new Date().toISOString();
      metrics.lastError = lastError.message;
      if (attempt === retries - 1) throw lastError;
      await sleep(400 * 2 ** attempt);
    }
  }
  throw lastError ?? new PumpRequestError("The Pump.fun request failed.", null, options.path);
}
