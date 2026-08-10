import * as p from "@clack/prompts";
import { generateJwtSecret } from "../utils/secrets.js";
import { generateSupabaseKeys } from "../utils/supabase-keys.js";
import { writeEnvFile } from "../utils/files.js";
import { textOrExit } from "../utils/prompts.js";

export interface DatabaseAnswer {
  mode: "existing" | "new-self-hosted";
  databaseUrl: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

/**
 * Question A from the architecture plan: where does Postgres + GoTrue come
 * from? Two fully independent paths — neither assumes Docker.
 */
export async function askDatabaseStep(repoRoot: string): Promise<DatabaseAnswer> {
  const mode = await p.select({
    message: "¿De dónde sale tu Supabase (Postgres + Auth)?",
    options: [
      {
        value: "existing" as const,
        label: "Ya tengo un proyecto Supabase (Cloud o self-hosted)",
        hint: "pegas la URL y las keys, sin Docker",
      },
      {
        value: "new-self-hosted" as const,
        label: "Crear uno nuevo self-hosted con Docker",
        hint: "levanta Postgres + GoTrue + PostgREST + Kong localmente",
      },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Instalación cancelada.");
    process.exit(0);
  }

  if (mode === "existing") {
    const supabaseUrl = await textOrExit("URL de tu proyecto Supabase", "https://tu-proyecto.supabase.co");
    const anonKey = await textOrExit("Anon/public key");
    const serviceRoleKey = await textOrExit("Service role key (server-only, nunca la expongas al navegador)");
    const databaseUrl = await textOrExit("Connection string de Postgres", "postgres://postgres:...@db.tu-proyecto.supabase.co:5432/postgres");

    p.note(
      "Si tu proyecto es Supabase Cloud (o self-hosted fuera de nuestro docker-compose), hay dos ajustes que solo se pueden hacer desde el Dashboard — la API de Supabase no los expone:\n\n" +
        "1. Authentication → Hooks → activa kontrolia_auth.custom_access_token_hook.\n" +
        "2. Project Settings → Data API → en \"Exposed schemas\" agrega kontrolia_auth (queda como: public, graphql_public, kontrolia_auth). " +
        "Sin esto, crear una organización u otras operaciones fallan con \"Invalid schema: kontrolia_auth\".",
      "2 pasos manuales pendientes",
    );

    return { mode, databaseUrl, supabaseUrl, anonKey, serviceRoleKey };
  }

  const jwtSecret = generateJwtSecret();
  const { anonKey, serviceRoleKey } = await generateSupabaseKeys(jwtSecret);
  const postgresPassword = generateJwtSecret().slice(0, 24);

  const s = p.spinner();
  s.start("Generando docker/.env");
  await writeEnvFile(`${repoRoot}/docker/.env`, {
    POSTGRES_PASSWORD: postgresPassword,
    POSTGRES_PORT: "5432",
    JWT_SECRET: jwtSecret,
    ANON_KEY: anonKey,
    SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_PORT: "8000",
    SUPABASE_PUBLIC_URL: "http://localhost:8000",
    SITE_URL: "http://localhost:3000",
    GOTRUE_MAILER_AUTOCONFIRM: "true",
  });
  s.stop("docker/.env generado");

  p.note(
    "docker compose -f docker/docker-compose.yml up -d\n(corre esto ahora, o después — el wizard no lo hace por ti para que puedas revisar docker/.env primero)",
    "Siguiente paso",
  );

  return {
    mode,
    databaseUrl: `postgres://postgres:${postgresPassword}@localhost:5432/postgres`,
    supabaseUrl: "http://localhost:8000",
    anonKey,
    serviceRoleKey,
  };
}
