import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

export interface MigrateOptions {
  /** Postgres connection string. Works against a fresh self-hosted instance
   * or an existing Supabase project (Cloud or self-hosted) — the migrations
   * only ever touch the `kontrolia_auth` schema. */
  connectionString: string;
  /** Print each statement before running it. */
  verbose?: boolean;
}

/**
 * Bootstraps (and self-heals the location of) the migration-tracking
 * table, then returns its schema-qualified name for the rest of migrate()
 * to use. On a genuinely fresh database neither `kontrolia` nor
 * `kontrolia_auth` exists yet — migration 0001 is what creates the former,
 * 0020 renames it to the latter — so this table has nowhere but `public`
 * to start out in. Once `kontrolia_auth` exists (every subsequent run,
 * fresh or not), it belongs there instead: an install that ran migrate()
 * before this fix shipped may still have it sitting in `public`, so this
 * relocates it once, idempotently, rather than leaving two copies around.
 */
async function ensureMigrationsTable(client: Client): Promise<string> {
  const { rows: schemaRows } = await client.query<{ exists: boolean }>(
    `select exists (select 1 from information_schema.schemata where schema_name = 'kontrolia_auth') as exists`,
  );
  const kontroliaAuthExists = schemaRows[0]?.exists ?? false;

  if (kontroliaAuthExists) {
    const { rows: publicRows } = await client.query<{ exists: boolean }>(
      `select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'kontrolia_migrations') as exists`,
    );
    if (publicRows[0]?.exists) {
      await client.query("alter table public.kontrolia_migrations set schema kontrolia_auth");
    }
  }

  const schema = kontroliaAuthExists ? "kontrolia_auth" : "public";
  await client.query(`
    create table if not exists ${schema}.kontrolia_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  return schema;
}

/**
 * Applies every .sql file under migrations/ that hasn't run yet, in
 * filename order, inside its own transaction. Safe to re-run.
 */
export async function migrate({ connectionString, verbose = false }: MigrateOptions) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const migrationsTable = `${await ensureMigrationsTable(client)}.kontrolia_migrations`;

    const { rows: applied } = await client.query<{ filename: string }>(
      `select filename from ${migrationsTable}`,
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
        await client.query(`insert into ${migrationsTable} (filename) values ($1)`, [file]);
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
