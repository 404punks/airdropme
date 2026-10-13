import { resolveDatabaseUrl } from "@/server/config";
import { defaultStorePath, FileMemoryStore } from "@/server/db/file-store";
import { PostgresStore } from "@/server/db/postgres-store";
import type { Repository } from "@/server/db/types";

const globalStore = globalThis as unknown as { __airdropmeStore?: Repository };

export function getStore(): Repository {
  if (!globalStore.__airdropmeStore) {
    const databaseUrl = resolveDatabaseUrl();
    globalStore.__airdropmeStore = databaseUrl
      ? new PostgresStore(databaseUrl)
      : new FileMemoryStore(defaultStorePath());
  }
  return globalStore.__airdropmeStore;
}
