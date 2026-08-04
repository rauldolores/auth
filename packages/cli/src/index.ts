#!/usr/bin/env node
import * as p from "@clack/prompts";
import { migrate } from "@kontrolia/db";
import { askApplicationStep } from "./steps/application.js";
import { askDatabaseStep } from "./steps/database.js";
import { askDeploymentStep } from "./steps/deployment.js";

async function main() {
  const repoRoot = process.cwd();

  console.clear();
  p.intro("KontrolIA Auth — instalador");

  const db = await askDatabaseStep(repoRoot);

  if (db.mode === "new-self-hosted") {
    p.note(
      "Corre `docker compose -f docker/docker-compose.yml up -d` y espera a que Postgres esté healthy antes de continuar con las migraciones.",
      "Antes de migrar",
    );
    const proceed = await p.confirm({ message: "¿Ya levantaste el docker-compose y Postgres está arriba?" });
    if (p.isCancel(proceed) || !proceed) {
      p.outro("Cuando esté listo, corre de nuevo: pnpm --filter create-kontrolia-auth dev");
      return;
    }
  }

  const s = p.spinner();
  s.start("Aplicando migraciones del schema kontrolia");
  try {
    await migrate({ connectionString: db.databaseUrl });
    s.stop("Migraciones aplicadas");
  } catch (error) {
    s.stop("Fallaron las migraciones");
    p.log.error((error as Error).message);
    process.exitCode = 1;
    return;
  }

  await askApplicationStep(db);

  await askDeploymentStep(repoRoot, db);

  p.outro("Listo. Crea tu primer usuario/organización desde /register en auth-server, y usa @kontrolia/react en tus apps.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
