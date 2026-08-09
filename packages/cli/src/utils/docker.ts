import * as p from "@clack/prompts";
import { migrate } from "@kontrolia/db";
import { commandExists, run } from "./exec.js";

const COMPOSE_FILE = "docker/docker-compose.yml";

/**
 * Self-hosted happy path: brings the docker-compose stack up in the
 * background, then keeps retrying the migrations while Postgres finishes
 * booting (a fresh container isn't ready to accept connections the instant
 * `up -d` returns). Returns true once the schema is applied.
 */
export async function bringUpAndMigrate(repoRoot: string, databaseUrl: string): Promise<boolean> {
  if (!commandExists("docker")) {
    p.log.error("Docker no está instalado o no está corriendo. Abre Docker Desktop y vuelve a intentar.");
    return false;
  }

  const up = p.spinner();
  up.start("Levantando Postgres + GoTrue con docker compose");
  try {
    await run("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d"], { cwd: repoRoot });
    up.stop("Contenedores arriba");
  } catch (error) {
    up.stop("No se pudo levantar docker compose");
    p.log.error((error as Error).message);
    p.log.info("¿Docker Desktop está abierto? Ábrelo y vuelve a correr el instalador.");
    return false;
  }

  const mig = p.spinner();
  mig.start("Esperando a que Postgres acepte conexiones y aplicando migraciones");
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await migrate({ connectionString: databaseUrl });
      mig.stop("Migraciones aplicadas");
      return true;
    } catch (error) {
      lastError = error as Error;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  mig.stop("Postgres no respondió a tiempo (60s)");
  if (lastError) p.log.error(lastError.message);
  p.note(
    "Los contenedores quedaron arriba. Cuando Postgres termine de iniciar corre:\n\n  npx create-kontrolia-auth migrate",
    "Reintenta las migraciones",
  );
  return false;
}
