import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

export interface MigrateOptions {
  /** Postgres connection string. Works against a fresh self-hosted instance
   * or an existing Supabase project (Cloud or self-hosted) — the migrations
   * only ever touch the `kontrolia` schema. */
  connectionString: string;
  /** Print each statement before running it. */
  verbose?: boolean;
}

async function ensureMigrationsTable(client: Client) {
  await client.query(`
    create table if not exists kontrolia_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

/**
 * Applies every .sql file under migrations/ that hasn't run yet, in
 * filename order, inside its own transaction. Safe to re-run.
 */
export async function migrate({ connectionString, verbose = false }: MigrateOptions) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const { rows: applied } = await client.query<{ filename: string }>(
      "select filename from kontrolia_migrations",
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      if (verbose) console.log(`[kontrolia-db] applying ${file}`);

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into kontrolia_migrations (filename) values ($1)", [file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
      }
    }
  } finally {
    await client.end();
  }
}
