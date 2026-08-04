#!/usr/bin/env node
import { migrate } from "./migrate.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[kontrolia-db] DATABASE_URL is not set. Point it at your existing Supabase project's Postgres connection string, or at the local docker-compose Postgres.",
  );
  process.exit(1);
}

migrate({ connectionString, verbose: true })
  .then(() => {
    console.log("[kontrolia-db] migrations applied successfully.");
  })
  .catch((error: unknown) => {
    console.error("[kontrolia-db] migration failed:", error);
    process.exit(1);
  });
