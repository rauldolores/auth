import * as p from "@clack/prompts";
import { type EnvValues, updateEnvValue, writeEnvFile } from "../utils/files.js";
import { registerOAuthClient } from "../utils/oauth-client.js";
import { createVercelProject, detectGitHubRepo } from "../utils/vercel-api.js";
import type { DatabaseAnswer } from "./database.js";

type DeployTarget = "docker" | "vercel" | "railway" | "render" | "coolify" | "manual";

const NEXT_STEPS: Record<DeployTarget, string> = {
  docker:
    "Ya está: los servicios auth-server y admin-panel viven en el mismo docker/docker-compose.yml. Corre `docker compose -f docker/docker-compose.yml up -d` para tenerlos arriba.",
  vercel:
    "Lo más confiable con un monorepo pnpm es conectar el repo desde el dashboard (no desplegar carpetas sueltas por CLI):\n" +
    "1) vercel.com → Add New → Project → importa este repo de GitHub.\n" +
    "2) Root Directory: apps/auth-server. Framework: Next.js (se detecta solo) — Vercel ve el pnpm-lock.yaml de la raíz del repo y usa pnpm automáticamente.\n" +
    "3) Settings → Environment Variables, pega las variables de apps/auth-server/.env.local.\n" +
    "4) Repite con un segundo proyecto: Root Directory apps/admin-panel y las variables de admin-panel/.env.local.\n" +
    "\n" +
    "Si prefieres la CLI (`npm i -g vercel`): corre `vercel` desde la RAÍZ del repo, nunca estando ya dentro de apps/auth-server — " +
    "cuando pregunte en qué carpeta está el código, contesta apps/auth-server. Si corres `vercel` estando ya adentro de esa " +
    "carpeta, solo sube esos archivos (sin el pnpm-lock.yaml ni los paquetes hermanos de la raíz) y el build falla con " +
    '"npm error Unsupported URL Type workspace:". Repite desde la raíz para admin-panel.',
  railway:
    "Recomendado: conecta el repo desde el dashboard de Railway (New Project → Deploy from GitHub repo), un servicio con " +
    "Root Directory apps/auth-server y otro con apps/admin-panel — así Railway siempre parte del repo completo.\n" +
    "Por CLI (`npm i -g @railway/cli && railway login`): corre `railway init`/`railway up` desde la RAÍZ del repo, nunca " +
    "estando ya dentro de apps/auth-server — igual que con Vercel, si subes solo esa carpeta te falta el pnpm-lock.yaml de " +
    "la raíz y el install falla contra los paquetes @kontrolia/* (workspace:*).\n" +
    "En cada servicio (dashboard de Railway → Variables) pega su .env.local.",
  render:
    "1) Sube el repo a GitHub.\n" +
    "2) En Render → New → Web Service, apúntalo a apps/auth-server (Build: `pnpm install && pnpm build`, Start: `pnpm start`).\n" +
    "3) Repite para apps/admin-panel.\n" +
    "4) En cada servicio → Environment, pega su .env.local.",
  coolify:
    "Crea dos recursos 'Next.js App' en Coolify apuntando a apps/auth-server y apps/admin-panel, y pega en cada uno las variables de su .env.local.",
  manual:
    "Corre `pnpm build && pnpm start` en apps/auth-server y apps/admin-panel en el servidor/K8s de tu elección, usando los .env.local generados.",
};

/**
 * Offers to create both Vercel projects via the REST API instead of walking
 * the user through the dashboard/CLI by hand — the same three fields that
 * are easy to get wrong doing this manually (gitRepository, rootDirectory,
 * environmentVariables) are just fields in one request body here. Returns
 * true only if both projects were created, so the caller knows whether to
 * still show the manual fallback instructions.
 */
async function tryAutoCreateVercelProjects(
  repoRoot: string,
  authServerEnv: EnvValues,
  adminPanelEnv: EnvValues,
): Promise<boolean> {
  const repo = await detectGitHubRepo(repoRoot);
  if (!repo) {
    p.note(
      "No encontré un remoto de GitHub en este repo (`git remote get-url origin`) — sin eso no puedo crear los " +
        "proyectos de Vercel por ti. Sube el repo a GitHub y vuelve a correr el instalador, o sigue los pasos " +
        "manuales de abajo.",
      "Creación automática no disponible",
    );
    return false;
  }

  const auto = await p.confirm({
    message: `¿Quieres que cree los dos proyectos de Vercel automáticamente (conectados a ${repo}, con sus variables ya puestas)? Solo necesito un API token de Vercel.`,
    initialValue: true,
  });
  if (p.isCancel(auto) || !auto) return false;

  const token = await p.password({
    message: "API token de Vercel (vercel.com/account/tokens — no se guarda, solo se usa ahora)",
    validate: (value) => (value.trim() ? undefined : "Requerido"),
  });
  if (p.isCancel(token)) return false;

  const namePrefix = repo.split("/")[1] ?? "kontrolia-auth";

  const authSpinner = p.spinner();
  authSpinner.start("Creando proyecto de Vercel para auth-server");
  const authResult = await createVercelProject({
    token,
    repo,
    name: `${namePrefix}-auth-server`,
    rootDirectory: "apps/auth-server",
    env: authServerEnv,
  });
  authSpinner.stop(authResult.ok ? "Proyecto auth-server creado" : `Falló auth-server: ${authResult.error}`);

  const adminSpinner = p.spinner();
  adminSpinner.start("Creando proyecto de Vercel para admin-panel");
  const adminResult = await createVercelProject({
    token,
    repo,
    name: `${namePrefix}-admin-panel`,
    rootDirectory: "apps/admin-panel",
    env: adminPanelEnv,
  });
  adminSpinner.stop(adminResult.ok ? "Proyecto admin-panel creado" : `Falló admin-panel: ${adminResult.error}`);

  if (authResult.ok && adminResult.ok) {
    p.note(
      "Los dos proyectos ya están conectados a tu repo, con la carpeta y las variables correctas. Entra a " +
        "vercel.com/dashboard y dale \"Deploy\" a cada uno (o empuja un commit a tu rama principal) para el primer despliegue.",
      "Listo",
    );
    return true;
  }

  p.note("Algo falló creando los proyectos — usa los pasos manuales de abajo para lo que no se haya creado.", "Revisa el error de arriba");
  return false;
}

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
      { value: "railway", label: "Railway" },
      { value: "render", label: "Render" },
      { value: "coolify", label: "Coolify" },
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

  // Registers admin-panel as a first-party OAuth 2.1 client of this
  // Supabase project so the dashboard can redirect straight through the
  // authorize/consent/token flow instead of relying on a shared cookie
  // domain — the only way SSO works when auth-server and admin-panel end up
  // on genuinely different domains, not just subdomains.
  const oauthSpinner = p.spinner();
  oauthSpinner.start("Registrando admin-panel como cliente OAuth 2.1");
  let oauthClientId: string | null = null;
  try {
    oauthClientId = await registerOAuthClient({
      supabaseUrl: db.supabaseUrl,
      serviceRoleKey: db.serviceRoleKey,
      clientName: "admin-panel",
      redirectUris: [`${adminPanelUrl}/oauth/callback`],
    });
  } catch {
    oauthClientId = null;
  }

  if (oauthClientId) {
    oauthSpinner.stop("admin-panel registrado como cliente OAuth 2.1");
  } else {
    oauthSpinner.stop("No se pudo registrar el cliente OAuth 2.1 (se omite)");
    p.note(
      "Tu proyecto Supabase no tiene habilitado el servidor OAuth 2.1 de GoTrue (GOTRUE_OAUTH_SERVER_ENABLED). " +
        "admin-panel seguirá funcionando con el enlace de login normal, pero eso solo mantiene la sesión si " +
        "auth-server y admin-panel comparten dominio (o subdominios con NEXT_PUBLIC_COOKIE_DOMAIN). " +
        "Si en el futuro necesitas dominios completamente distintos, habilita esa opción en tu proyecto y vuelve a correr el instalador.",
      "Paso manual pendiente",
    );
  }

  const s = p.spinner();
  s.start("Generando apps/auth-server/.env.local y apps/admin-panel/.env.local");

  const authServerEnv: EnvValues = {
    NEXT_PUBLIC_SUPABASE_URL: db.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: db.anonKey,
    SUPABASE_URL: db.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: db.serviceRoleKey,
    NEXT_PUBLIC_ADMIN_PANEL_URL: adminPanelUrl,
    NEXT_PUBLIC_COOKIE_DOMAIN: cookieDomain,
  };
  await writeEnvFile(`${repoRoot}/apps/auth-server/.env.local`, authServerEnv);

  const adminPanelEnv: EnvValues = {
    NEXT_PUBLIC_SUPABASE_URL: db.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: db.anonKey,
    NEXT_PUBLIC_AUTH_SERVER_URL: authServerUrl,
    NEXT_PUBLIC_COOKIE_DOMAIN: cookieDomain,
    NEXT_PUBLIC_OAUTH_CLIENT_ID: oauthClientId ?? "",
  };
  await writeEnvFile(`${repoRoot}/apps/admin-panel/.env.local`, adminPanelEnv);

  if (db.mode === "new-self-hosted") {
    // database.ts wrote SITE_URL="http://localhost:3000" as a fixed default
    // *before* this step ever asked where auth-server actually lives —
    // if authServerUrl isn't that default, GoTrue would otherwise keep
    // building its own /oauth/consent redirects (and email links) against
    // the wrong host forever.
    await updateEnvValue(`${repoRoot}/docker/.env`, "SITE_URL", authServerUrl);
    await updateEnvValue(`${repoRoot}/docker/.env`, "ADMIN_PANEL_URL", adminPanelUrl);
    if (cookieDomain) {
      await updateEnvValue(`${repoRoot}/docker/.env`, "COOKIE_DOMAIN", cookieDomain);
    }
    if (oauthClientId) {
      await updateEnvValue(`${repoRoot}/docker/.env`, "OAUTH_CLIENT_ID", oauthClientId);
    }
  }

  s.stop(".env.local generados en auth-server y admin-panel");

  if (db.mode === "new-self-hosted") {
    p.note(
      "docker/.env se actualizó con las URLs reales — como el contenedor de auth (GoTrue) ya estaba arriba con los " +
        "valores por defecto, corre `docker compose -f docker/docker-compose.yml up -d` una vez más para que los tome.",
      "Reinicia el docker-compose",
    );
  }

  const autoCreated = target === "vercel" && (await tryAutoCreateVercelProjects(repoRoot, authServerEnv, adminPanelEnv));

  if (!autoCreated) {
    p.note(NEXT_STEPS[target], `Despliegue: ${target}`);
  }
}
