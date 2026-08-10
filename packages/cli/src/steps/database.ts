import * as p from "@clack/prompts";
import { generateJwtSecret } from "../utils/secrets.js";
import { generateSupabaseKeys } from "../utils/supabase-keys.js";
import { writeEnvFile } from "../utils/files.js";
import { textOrExit } from "../utils/prompts.js";
import { addExposedSchema, enableCustomAccessTokenHook, extractProjectRef } from "../utils/supabase-management-api.js";

export interface DatabaseAnswer {
  mode: "existing" | "new-self-hosted";
  databaseUrl: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

/**
 * Offers to configure the two Supabase Cloud dashboard-only settings
 * (exposed schemas + Custom Access Token Hook) via the Management API
 * instead of leaving them as manual steps — mirrors the Vercel deploy
 * automation: a separate, more powerful "Personal Access Token" (account
 * level, not the project's anon/service keys), captured with masked input
 * and never persisted. Only offered for Supabase Cloud URLs (self-hosted
 * projects and custom domains have no Management API to call). Returns
 * which parts actually succeeded so the caller can fall back to a manual
 * note for whichever one didn't.
 */
async function tryAutoConfigureSupabaseCloud(supabaseUrl: string): Promise<{ schemaDone: boolean; hookDone: boolean }> {
  const projectRef = extractProjectRef(supabaseUrl);
  if (!projectRef) return { schemaDone: false, hookDone: false };

  const auto = await p.confirm({
    message:
      "¿Quieres que configure automáticamente el schema expuesto y el Custom Access Token Hook en tu proyecto Supabase? " +
      "Necesito un Personal Access Token de tu cuenta Supabase (distinto a las keys del proyecto que ya diste).",
    initialValue: true,
  });
  if (p.isCancel(auto) || !auto) return { schemaDone: false, hookDone: false };

  p.note(
    "1. Entra a supabase.com/dashboard/account/tokens\n" +
      '2. Dale click a "Generate new token"\n' +
      "3. Ponle un nombre, confirma y cópialo (solo se ve una vez)\n" +
      "4. Pégalo aquí abajo",
    "Cómo conseguir el Personal Access Token de Supabase",
  );
  const managementToken = await p.password({
    message: "Personal Access Token de Supabase (no se guarda, solo se usa ahora)",
    validate: (value) => (value.trim() ? undefined : "Requerido"),
  });
  if (p.isCancel(managementToken)) return { schemaDone: false, hookDone: false };

  const schemaSpinner = p.spinner();
  schemaSpinner.start("Exponiendo el schema kontrolia_auth en la API de datos");
  const schemaResult = await addExposedSchema(managementToken, projectRef, "kontrolia_auth");
  schemaSpinner.stop(schemaResult.ok ? "Schema kontrolia_auth expuesto" : `Falló: ${schemaResult.error}`);

  const hookSpinner = p.spinner();
  hookSpinner.start("Activando el Custom Access Token Hook");
  const hookResult = await enableCustomAccessTokenHook(managementToken, projectRef);
  hookSpinner.stop(hookResult.ok ? "Hook activado" : `Falló: ${hookResult.error}`);

  return { schemaDone: schemaResult.ok, hookDone: hookResult.ok };
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

    const { schemaDone, hookDone } = await tryAutoConfigureSupabaseCloud(supabaseUrl);

    if (!schemaDone || !hookDone) {
      const pending: string[] = [];
      if (!hookDone) pending.push("Authentication → Hooks → activa kontrolia_auth.custom_access_token_hook.");
      if (!schemaDone) {
        pending.push(
          "Project Settings → Data API → en \"Exposed schemas\" agrega kontrolia_auth (queda como: public, graphql_public, kontrolia_auth). " +
            "Sin esto, crear una organización u otras operaciones fallan con \"Invalid schema: kontrolia_auth\".",
        );
      }
      p.note(
        "Si tu proyecto es Supabase Cloud (o self-hosted fuera de nuestro docker-compose), estos ajustes solo se pueden hacer " +
          "desde el Dashboard — la API de Supabase no los expone del todo:\n\n" +
          pending.map((line, i) => `${i + 1}. ${line}`).join("\n"),
        pending.length > 1 ? "Pasos manuales pendientes" : "Paso manual pendiente",
      );
    }

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
