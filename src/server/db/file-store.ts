import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { MemoryStore, type MemoryState } from "@/server/db/memory-store";

export function defaultStorePath(): string {
  const configured = process.env.AIRDROPME_STORE_PATH?.trim();
  if (configured) return configured;
  if (process.env.VERCEL) return resolve(tmpdir(), "airdropme-store.json");
  return resolve(process.cwd(), "data", "airdropme-store.json");
}

export class FileMemoryStore extends MemoryStore {
  constructor(private readonly filePath: string) {
    super();
    this.load();
  }

  protected override persistHook(): void {
    if (!this.canPersist) return;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify(this.exportState()));
      renameSync(temporary, this.filePath);
    } catch {
      // A read-only serverless filesystem should not fail the page render.
    }
  }

  private load(): void {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as MemoryState;
      if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.snapshots)) return;
      this.importState(parsed);
    } catch {
      // A missing file is a new store.
    }
  }
}
