import * as p from "@clack/prompts";
import { writeEnvFile } from "../utils/files.js";
import type { DatabaseAnswer } from "./database.js";

type DeployTarget = "docker" | "vercel" | "coolify" | "railway" | "manual";

const NEXT_STEPS: Record<DeployTarget, string> = {
  docker: "Se despliegan como parte del mismo docker/docker-compose.yml (servicios auth-server y admin-panel).",
  vercel: "vercel deploy en apps/auth-server y apps/admin-panel por separado, configurando las mismas variables en el dashboard de Vercel.",
  coolify: "Crea dos recursos 'Next.js App' en Coolify apuntando a apps/auth-server y apps/admin-panel, con las variables de .env.local generadas.",
  railway: "railway up en apps/auth-server y apps/admin-panel, o conéctalos como servicios desde el repo en el dashboard de Railway.",
  manual: "Corre `pnpm build && pnpm start` en apps/auth-server y apps/admin-panel en el servidor/K8s de tu elección, usando los .env.local generados.",
};

/**
 * Question B from the architecture plan: where do auth-server/admin-panel
 * run? Fully independent from the database question above — this only
 * ever generates env files, it never touches the database connection.
 */
export async function askDeploymentStep(repoRoot: string, db: DatabaseAnswer): Promise<void> {
  const target = await p.select<DeployTarget>({
    message: "¿Dónde vas a desplegar auth-server / admin-panel?",
    options: [
      { value: "docker", label: "Docker (incluido en el mismo docker-compose)" },
      { value: "vercel", label: "Vercel" },
      { value: "coolify", label: "Coolify" },
      { value: "railway", label: "Railway" },
      { value: "manual", label: "Otro / Kubernetes / manual" },
    ],
  });

  if (p.isCancel(target)) {
    p.cancel("Instalación cancelada.");
    process.exit(0);
  }

  const authServerUrl = await p.text({
    message: "¿En qué URL va a vivir auth-server? (admin-panel la usa para enviar ahí a quien no tenga sesión)",
    placeholder: "http://localhost:3000",
    defaultValue: "http://localhost:3000",
  });
  if (p.isCancel(authServerUrl)) {
    p.cancel("Instalación cancelada.");
    process.exit(0);
  }

  const adminPanelUrl = await p.text({
    message:
      "¿Y en qué URL va a vivir admin-panel? (auth-server la usa para regresar ahí después de iniciar sesión, en vez de mandarte a su propia pantalla de inicio)",
    placeholder: "http://localhost:3001",
    defaultValue: "http://localhost:3001",
  });
  if (p.isCancel(adminPanelUrl)) {
    p.cancel("Instalación cancelada.");
    process.exit(0);
  }

  const cookieDomain = await p.text({
    message:
      "¿auth-server y admin-panel van a vivir en subdominios del mismo dominio (ej. auth.tuempresa.com y admin.tuempresa.com)? " +
      "Si es así, escribe el dominio compartido empezando con un punto (ej. .tuempresa.com). Si comparten el mismo host, o no lo sabes todavía, déjalo vacío.",
    placeholder: "",
    defaultValue: "",
  });
  if (p.isCancel(cookieDomain)) {
    p.cancel("Instalación cancelada.");
    process.exit(0);
  }

  const s = p.spinner();
  s.start("Generando apps/auth-server/.env.local y apps/admin-panel/.env.local");

  await writeEnvFile(`${repoRoot}/apps/auth-server/.env.local`, {
    NEXT_PUBLIC_SUPABASE_URL: db.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: db.anonKey,
    SUPABASE_URL: db.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: db.serviceRoleKey,
    NEXT_PUBLIC_ADMIN_PANEL_URL: adminPanelUrl,
    NEXT_PUBLIC_COOKIE_DOMAIN: cookieDomain,
  });

  await writeEnvFile(`${repoRoot}/apps/admin-panel/.env.local`, {
    NEXT_PUBLIC_SUPABASE_URL: db.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: db.anonKey,
    NEXT_PUBLIC_AUTH_SERVER_URL: authServerUrl,
    NEXT_PUBLIC_COOKIE_DOMAIN: cookieDomain,
  });

  s.stop(".env.local generados en auth-server y admin-panel");

  p.note(NEXT_STEPS[target], `Despliegue: ${target}`);
}
