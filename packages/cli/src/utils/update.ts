import * as p from "@clack/prompts";
import { run } from "./exec.js";

/**
 * Pulls the latest KontrolIA Auth code into an existing self-hosted clone.
 * Deliberately conservative: refuses to touch a working tree with local
 * changes (never discards anything), and only fast-forwards — if history
 * has diverged (a local commit, a force-push upstream), it stops and tells
 * the operator to sort it out with git directly instead of guessing.
 *
 * Returns true if the working tree ends up on the latest commit (whether or
 * not it actually moved), false if it stopped short of that for any reason.
 */
export async function pullLatest(repoRoot: string): Promise<boolean> {
  const dirty = (await run("git", ["status", "--porcelain"], { cwd: repoRoot })).trim();
  if (dirty) {
    p.log.error(
      "Hay cambios sin guardar en esta copia — no los voy a tocar. Guárdalos (git commit / git stash) y vuelve a correr `npx create-kontrolia-auth update`.",
    );
    return false;
  }

  const fetch = p.spinner();
  fetch.start("Buscando actualizaciones");
  try {
    await run("git", ["fetch", "origin"], { cwd: repoRoot });
  } catch (error) {
    fetch.stop("No se pudo conectar a GitHub");
    p.log.error((error as Error).message);
    return false;
  }

  const behindRaw = await run("git", ["rev-list", "--count", "HEAD..origin/main"], { cwd: repoRoot });
  const behind = Number(behindRaw.trim());

  if (behind === 0) {
    fetch.stop("Ya tienes la última versión");
    return true;
  }
  fetch.stop(`${behind} cambio${behind === 1 ? "" : "s"} nuevo${behind === 1 ? "" : "s"} disponible${behind === 1 ? "" : "s"}`);

  const log = await run("git", ["log", "--oneline", "HEAD..origin/main"], { cwd: repoRoot });
  p.note(log.trim(), "Qué se va a aplicar");

  const proceed = await p.confirm({ message: "¿Descargar y aplicar estos cambios ahora?", initialValue: true });
  if (p.isCancel(proceed) || !proceed) {
    p.cancel("Actualización cancelada.");
    return false;
  }

  const pull = p.spinner();
  pull.start("Descargando el código nuevo");
  try {
    await run("git", ["pull", "--ff-only", "origin", "main"], { cwd: repoRoot });
    pull.stop("Código actualizado");
  } catch (error) {
    pull.stop("No se pudo actualizar automáticamente");
    p.log.error((error as Error).message);
    p.note(
      "El historial local y el de GitHub ya no coinciden (por ejemplo, si hiciste un commit propio). Resuélvelo a mano con git, o clona de nuevo en una carpeta aparte.",
      "Requiere intervención manual",
    );
    return false;
  }

  const install = p.spinner();
  install.start("Instalando dependencias nuevas (pnpm install)");
  try {
    await run("pnpm", ["install"], { cwd: repoRoot });
    install.stop("Dependencias al día");
  } catch (error) {
    install.stop("Falló pnpm install");
    p.log.error((error as Error).message);
    return false;
  }

  return true;
}
