import { existsSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import { run } from "./exec.js";

const REPO_URL = "https://github.com/rauldolores/auth.git";

/** Heuristic: are we already standing inside a checkout of the monorepo? */
export function isInsideRepo(dir: string): boolean {
  return existsSync(join(dir, "docker", "docker-compose.yml")) && existsSync(join(dir, "packages", "cli"));
}

export interface ScaffoldResult {
  repoRoot: string;
  /** true when we cloned a fresh copy (vs. running inside an existing one). */
  scaffolded: boolean;
  /** the folder name we cloned into, for the closing "cd" hint. */
  dirName?: string;
}

/**
 * Turnkey entrypoint: guarantees there's a working copy of KontrolIA Auth to
 * configure. Run from inside the repo (dev, or an already-cloned copy) it's a
 * no-op. Run from anywhere else (`npx create-kontrolia-auth mi-app`) it does a
 * shallow clone into the target folder and installs dependencies, so a
 * non-technical user never has to know what git or pnpm are.
 *
 * Returns null on any failure the user needs to fix (folder exists, clone or
 * install failed) — the caller stops with a friendly message.
 */
export async function ensureRepo(cwd: string, targetDirArg?: string): Promise<ScaffoldResult | null> {
  if (isInsideRepo(cwd)) return { repoRoot: cwd, scaffolded: false };

  let dir = targetDirArg;
  if (!dir) {
    const answer = await p.text({
      message: "¿En qué carpeta quieres instalar KontrolIA Auth?",
      placeholder: "kontrolia-auth",
      defaultValue: "kontrolia-auth",
    });
    if (p.isCancel(answer)) {
      p.cancel("Instalación cancelada.");
      process.exit(0);
    }
    dir = answer || "kontrolia-auth";
  }

  const target = join(cwd, dir);
  if (existsSync(target)) {
    p.log.error(`La carpeta "${dir}" ya existe. Elige otro nombre, o bórrala y vuelve a intentar.`);
    return null;
  }

  const clone = p.spinner();
  clone.start(`Descargando KontrolIA Auth en ./${dir}`);
  try {
    await run("git", ["clone", "--depth", "1", REPO_URL, target]);
    clone.stop(`Código descargado en ./${dir}`);
  } catch (error) {
    clone.stop("No se pudo descargar el repositorio");
    p.log.error((error as Error).message);
    return null;
  }

  const install = p.spinner();
  install.start("Instalando dependencias (pnpm install) — puede tardar un par de minutos");
  try {
    await run("pnpm", ["install"], { cwd: target });
    install.stop("Dependencias instaladas");
  } catch (error) {
    install.stop("Falló pnpm install");
    p.log.error((error as Error).message);
    p.note(`Entra a la carpeta y corre pnpm install a mano:\n\n  cd ${dir}\n  pnpm install`, "Puedes reintentar");
    return null;
  }

  return { repoRoot: target, scaffolded: true, dirName: dir };
}
