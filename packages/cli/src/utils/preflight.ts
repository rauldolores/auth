import * as p from "@clack/prompts";
import { tryVersion } from "./exec.js";

export interface PreflightNeeds {
  /** Needs git to clone the repo (turnkey install from outside the repo). */
  git?: boolean;
  /** Needs Docker for the self-hosted path. */
  docker?: boolean;
}

interface Check {
  label: string;
  ok: boolean;
  detail: string;
  hint: string;
}

/**
 * Friendly, non-technical requirements check. Prints a ✓/✗ table and, for
 * anything missing, exactly how to install it. Returns false if a required
 * tool is missing so the caller can stop before confusing the user with a
 * deep stack trace.
 */
export function runPreflight(needs: PreflightNeeds = {}): boolean {
  const checks: Check[] = [];

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    label: "Node.js",
    ok: nodeMajor >= 20,
    detail: `v${process.versions.node}`,
    hint: "Instala Node 20 o superior desde https://nodejs.org (elige la versión LTS).",
  });

  const pnpm = tryVersion("pnpm");
  checks.push({
    label: "pnpm",
    ok: Boolean(pnpm),
    detail: pnpm ?? "no encontrado",
    hint: "Instálalo con:  npm install -g pnpm",
  });

  if (needs.git) {
    const git = tryVersion("git");
    checks.push({
      label: "git",
      ok: Boolean(git),
      detail: git ?? "no encontrado",
      hint: "Instala Git desde https://git-scm.com/downloads",
    });
  }

  if (needs.docker) {
    const docker = tryVersion("docker");
    checks.push({
      label: "Docker",
      ok: Boolean(docker),
      detail: docker ?? "no encontrado",
      hint: "Instala Docker Desktop desde https://www.docker.com/products/docker-desktop y ábrelo antes de continuar.",
    });
  }

  const table = checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.label.padEnd(9)} ${c.detail}`).join("\n");
  p.note(table, "Requisitos");

  const missing = checks.filter((c) => !c.ok);
  for (const m of missing) p.log.error(`Falta ${m.label}. ${m.hint}`);

  return missing.length === 0;
}
