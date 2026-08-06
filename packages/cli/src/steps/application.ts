import * as p from "@clack/prompts";
import { registerApplication } from "@kontrolia/db";
import type { DatabaseAnswer } from "./database.js";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

/**
 * Optional final step: registers a first application and its permission
 * catalog. kontrolia.applications/permissions have no write policy for
 * regular users (see migrations/0010_rls_policies.sql) and no admin API
 * exists yet for it, so this writes directly against Postgres — the same
 * platform-admin path migrate() already uses to apply schema changes.
 */
export async function askApplicationStep(db: DatabaseAnswer): Promise<void> {
  const wantsApp = await p.confirm({
    message: "¿Quieres registrar tu primera aplicación (con su catálogo de permisos) ahora?",
    initialValue: true,
  });
  if (p.isCancel(wantsApp)) {
    p.cancel("Instalación cancelada.");
    process.exit(0);
  }
  if (!wantsApp) {
    p.note(
      "Puedes registrar aplicaciones más tarde corriendo este wizard de nuevo, o insertando directamente en kontrolia.applications / kontrolia.permissions.",
      "Omitido",
    );
    return;
  }

  const name = await textOrExit("Nombre de la aplicación", "Facturación");
  const slug = slugify(name);

  const environment = await p.select({
    message: "Entorno",
    options: [
      { value: "development" as const, label: "development" },
      { value: "staging" as const, label: "staging" },
      { value: "production" as const, label: "production" },
    ],
    initialValue: "development" as const,
  });
  if (p.isCancel(environment)) {
    p.cancel("Instalación cancelada.");
    process.exit(0);
  }

  p.note(`Cada permiso queda como ${slug}.<recurso>.<acción> — p. ej. facturas / crear.`, "Catálogo de permisos");

  const permissions: { resource: string; action: string; description?: string }[] = [];
  let addAnother = true;
  while (addAnother) {
    const resource = await textOrExit("Recurso", "facturas");
    const action = await textOrExit("Acción", "crear");
    const description = await p.text({ message: "Descripción (opcional)", placeholder: "Crear facturas" });
    if (p.isCancel(description)) {
      p.cancel("Instalación cancelada.");
      process.exit(0);
    }
    permissions.push({ resource, action, description: description || undefined });

    const more = await p.confirm({ message: "¿Agregar otro permiso?", initialValue: false });
    if (p.isCancel(more)) {
      p.cancel("Instalación cancelada.");
      process.exit(0);
    }
    addAnother = more;
  }

  const s = p.spinner();
  s.start(`Registrando ${name} (${slug}) y ${permissions.length} permiso(s)`);
  let apiKey: string | null;
  try {
    const result = await registerApplication({
      connectionString: db.databaseUrl,
      name,
      slug,
      environment,
      permissions,
    });
    apiKey = result.apiKey;
    s.stop(`Aplicación ${slug} registrada: ${result.permissionKeys.join(", ")}`);
  } catch (error) {
    s.stop("No se pudo registrar la aplicación");
    p.log.error((error as Error).message);
    return;
  }

  if (apiKey) {
    p.note(
      `${apiKey}\n\n` +
        `Guárdala ahora — no se puede volver a mostrar (solo se guarda su hash). Ponla en ${name} como una variable ` +
        `de entorno (p. ej. KONTROLIA_APPLICATION_API_KEY) y úsala para actualizar su catálogo de permisos desde su ` +
        `propio pipeline de despliegue, sin volver a tocar esta base de datos — POST {tu-auth-server}/api/applications/sync. ` +
        `Ver la guía "Registro de aplicaciones" en la documentación para el formato exacto.`,
      `Clave de sincronización de ${slug}`,
    );
  } else {
    p.note(
      `${slug} ya existía — su clave de sincronización (si tiene una) no cambió. Si la perdiste, tendrás que borrar ` +
        "y volver a registrar la aplicación para generar una nueva.",
      "Aplicación existente",
    );
  }

  p.note(
    "Para habilitarla en una organización (kontrolia.application_organizations) y asignarla a un rol, hazlo por ahora directo en la base de datos — el admin panel todavía solo permite verla, no darla de alta.",
    "Siguiente paso",
  );
}

async function textOrExit(message: string, placeholder?: string): Promise<string> {
  const value = await p.text({ message, placeholder });
  if (p.isCancel(value)) {
    p.cancel("Instalación cancelada.");
    process.exit(0);
  }
  return value;
}
