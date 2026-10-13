import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0001_init.sql"), "utf8");
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query(sql);
  console.log("Applied supabase/migrations/0001_init.sql");
} finally {
  await client.end();
}
