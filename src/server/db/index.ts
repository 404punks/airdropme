import { config } from "@/server/config";
import { MemoryStore } from "@/server/db/memory-store";
import { PostgresStore } from "@/server/db/postgres-store";
import type { Repository } from "@/server/db/types";

const globalStore = globalThis as unknown as { __airdropmeStore?: Repository };

export function getStore(): Repository {
  if (!globalStore.__airdropmeStore) {
    globalStore.__airdropmeStore = config.DATABASE_URL
      ? new PostgresStore(config.DATABASE_URL)
      : new MemoryStore();
  }
  return globalStore.__airdropmeStore;
}
