#!/usr/bin/env node
import * as p from "@clack/prompts";
import { migrate } from "@kontrolia/db";
import { askApplicationStep } from "./steps/application.js";
import { askDatabaseStep, type DatabaseAnswer } from "./steps/database.js";
import { askDeploymentStep } from "./steps/deployment.js";
import { bringUpAndMigrate } from "./utils/docker.js";
import { runPreflight } from "./utils/preflight.js";
import { textOrExit } from "./utils/prompts.js";
import { ensureRepo, isInsideRepo } from "./utils/scaffold.js";
import { pullLatest } from "./utils/update.js";

/** Applies the schema against an already-reachable database, with a spinner. */
async function migrateWithSpinner(connectionString: string): Promise<boolean> {
  const s = p.spinner();
  s.start("Aplicando migraciones del schema kontrolia_auth");
  try {
    await migrate({ connectionString });
    s.stop("Migraciones aplicadas");
    return true;
  } catch (error) {
    s.stop("Fallaron las migraciones");
    p.log.error((error as Error).message);
    return false;
  }
}

/** `create-kontrolia-auth migrate` — re-run migrations against any DB later. */
async function runMigrateCommand() {
  console.clear();
  p.intro("KontrolIA Auth — migrar base de datos");
  const url = await p.text({
    message: "Connection string de Postgres",
    placeholder: "postgres://postgres:...@host:5432/postgres",
  });
  if (p.isCancel(url) || !url) {
    p.cancel("Cancelado.");
    process.exit(0);
  }
  const ok = await migrateWithSpinner(url);
  if (!ok) process.exitCode = 1;
  p.outro(ok ? "Base de datos al día." : "Revisa la connection string y vuelve a intentar.");
}

/** `create-kontrolia-auth doctor` — just the requirements check. */
async function runDoctor() {
  console.clear();
  p.intro("KontrolIA Auth — diagnóstico del entorno");
  const ok = runPreflight({ git: true, docker: true });
  p.outro(ok ? "Todo listo para instalar." : "Instala lo marcado con ✗ y vuelve a correr.");
}

/**
 * `create-kontrolia-auth update` — pulls the latest code into an existing
 * self-hosted clone and re-applies migrations. Only makes sense from inside
 * a clone (this is not how someone consuming @kontrolia/* as npm
 * dependencies in their own app updates — for that, bumping the package
 * versions and re-running the app's own migrate step is the right path).
 */
async function runUpdateCommand() {
  console.clear();
  p.intro("KontrolIA Auth — actualizar instalación");

  if (!isInsideRepo(process.cwd())) {
    p.log.error(
      "Este comando actualiza una copia clonada de KontrolIA Auth — corre esto dentro de la carpeta donde instalaste todo (la que tiene docker/docker-compose.yml).",
    );
    p.outro("Nada que hacer aquí.");
    process.exitCode = 1;
    return;
  }

  if (!runPreflight({ git: true })) {
    p.outro("Instala lo que falta (arriba) y vuelve a correr.");
    process.exitCode = 1;
    return;
  }

  const updated = await pullLatest(process.cwd());
  if (!updated) {
    process.exitCode = 1;
    return;
  }

  const url = await p.text({
    message: "Connection string de Postgres (para aplicar las migraciones nuevas, si hay)",
    placeholder: "postgres://postgres:...@host:5432/postgres",
  });
  if (p.isCancel(url) || !url) {
    p.outro("Código actualizado. Corre `npx create-kontrolia-auth migrate` cuando quieras aplicar la base de datos.");
    return;
  }

  const migrated = await migrateWithSpinner(url);
  p.outro(
    migrated
      ? "Listo. Si despliegas con Docker: `docker compose -f docker/docker-compose.yml up -d --build`. Si usas Vercel/Railway/Render/Coolify, vuelve a desplegar (push a tu rama, o su CLI) para que tomen el código nuevo."
      : "El código ya está actualizado, pero revisa el error de las migraciones antes de redesplegar.",
  );
}

/**
 * `create-kontrolia-auth deploy` — jumps straight to the deployment step
 * (URLs, OAuth client, .env.local generation, and the Vercel auto-create
 * offer) without repeating the database/application questions. For anyone
 * who already has everything running and just wants to (re)connect a
 * deploy target — e.g. adding admin-panel after auth-server was already
 * deployed. Doesn't persist Supabase credentials anywhere between runs, so
 * it still has to ask for them once here.
 */
async function runDeployCommand() {
  console.clear();
  p.intro("KontrolIA Auth — desplegar auth-server / admin-panel");

  if (!isInsideRepo(process.cwd())) {
    p.log.error(
      "Corre esto dentro de la carpeta donde instalaste KontrolIA Auth (la que tiene docker/docker-compose.yml).",
    );
    p.outro("Nada que hacer aquí.");
    process.exitCode = 1;
    return;
  }

  const supabaseUrl = await textOrExit("URL de tu proyecto Supabase", "https://tu-proyecto.supabase.co");
  const anonKey = await textOrExit("Anon/public key");
  const serviceRoleKey = await textOrExit("Service role key (server-only, nunca la expongas al navegador)");

  const db: DatabaseAnswer = { mode: "existing", databaseUrl: "", supabaseUrl, anonKey, serviceRoleKey };

  await askDeploymentStep(process.cwd(), db);
  p.outro("Listo.");
}

/** Default flow: preflight → (scaffold if outside repo) → DB → migrate → app → deploy. */
async function runInstall(targetDirArg?: string) {
  console.clear();
  p.intro("KontrolIA Auth — instalador");

  const inRepo = isInsideRepo(process.cwd());
  if (!runPreflight({ git: !inRepo })) {
    p.outro("Instala lo que falta (arriba) y vuelve a correr el instalador.");
    process.exitCode = 1;
    return;
  }

  const scaffold = await ensureRepo(process.cwd(), targetDirArg);
  if (!scaffold) {
    process.exitCode = 1;
    return;
  }
  const { repoRoot, scaffolded, dirName } = scaffold;

  const db = await askDatabaseStep(repoRoot);

  let migrated = false;
  if (db.mode === "new-self-hosted") {
    const auto = await p.confirm({
      message: "¿Levanto los contenedores (docker compose up -d) y aplico las migraciones por ti ahora?",
      initialValue: true,
    });
    if (p.isCancel(auto)) {
      p.cancel("Instalación cancelada.");
      process.exit(0);
    }
    if (auto) {
      migrated = await bringUpAndMigrate(repoRoot, db.databaseUrl);
    } else {
      p.note(
        "Cuando quieras:\n\n  docker compose -f docker/docker-compose.yml up -d\n  npx create-kontrolia-auth migrate",
        "Lo harás a mano",
      );
    }
  } else {
    migrated = await migrateWithSpinner(db.databaseUrl);
  }

  // Registering the first application writes to kontrolia_auth tables, so it
  // only makes sense once the schema exists. Env generation below is always
  // useful (it never touches the DB), so it runs either way.
  if (migrated) {
    await askApplicationStep(db);
  } else {
    p.note(
      "Cuando la base de datos esté lista corre `npx create-kontrolia-auth migrate`, y registra tu primera aplicación desde admin-panel.",
      "Migraciones pendientes",
    );
  }

  await askDeploymentStep(repoRoot, db);

  const cdHint = scaffolded && dirName ? `cd ${dirName} && ` : "";
  p.outro(
    `Listo. Arranca en local con \`${cdHint}pnpm dev\`, crea tu primer usuario/organización en /register, y usa @kontrolia/react en tus apps.`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const first = args[0];

  if (first === "migrate") return runMigrateCommand();
  if (first === "doctor") return runDoctor();
  if (first === "update") return runUpdateCommand();
  if (first === "deploy") return runDeployCommand();

  // `create <dir>` / `install <dir>` / `<dir>` / (nothing) all reach install.
  const dir = first === "create" || first === "install" ? args[1] : first;
  return runInstall(dir);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
