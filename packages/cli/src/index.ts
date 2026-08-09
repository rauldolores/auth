#!/usr/bin/env node
import * as p from "@clack/prompts";
import { migrate } from "@kontrolia/db";
import { askApplicationStep } from "./steps/application.js";
import { askDatabaseStep } from "./steps/database.js";
import { askDeploymentStep } from "./steps/deployment.js";
import { bringUpAndMigrate } from "./utils/docker.js";
import { runPreflight } from "./utils/preflight.js";
import { ensureRepo, isInsideRepo } from "./utils/scaffold.js";

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

  // `create <dir>` / `install <dir>` / `<dir>` / (nothing) all reach install.
  const dir = first === "create" || first === "install" ? args[1] : first;
  return runInstall(dir);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
