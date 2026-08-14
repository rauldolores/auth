import { logError } from "@/lib/logger";
import { authenticateApplication } from "@/lib/application-auth";
import { NextResponse } from "next/server";

interface PermissionInput {
  resource: string;
  action: string;
  description?: string;
}

interface SyncBody {
  slug?: string;
  name?: string;
  environment?: "development" | "staging" | "production";
  permissions?: PermissionInput[];
}

/**
 * Lets an already-registered application push updates to its own permission
 * catalog — resources/actions are added or their description updated, never
 * deleted, so a deploy that temporarily omits one can't silently break a
 * role that already grants it. Authenticated with the per-application API
 * key shown once at registration (CLI's "register your first application"
 * step), never a user session — meant to be called from the application's
 * own deploy pipeline, not a browser. See the "Registro de aplicaciones"
 * guide in the documentation for the exact contract client apps should
 * implement.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SyncBody | null;
  if (!body?.slug || !Array.isArray(body.permissions)) {
    return NextResponse.json({ error: "slug y permissions son requeridos" }, { status: 400 });
  }

  const auth = await authenticateApplication(request, body.slug, "applications/sync");
  if (auth instanceof NextResponse) return auth;
  const { application, admin } = auth;

  // Any active key for this application can sync its permission catalog —
  // that's global, not org-scoped. Renaming the application or changing its
  // environment is metadata about the application itself, though, so only a
  // key scoped to its actual owner org (not just any org that enabled it)
  // may touch that part of the request.
  if ((body.name || body.environment) && application.organizationId !== application.ownerOrganizationId) {
    return NextResponse.json(
      { error: "Solo una clave de la organización propietaria puede actualizar el nombre o entorno de la aplicación." },
      { status: 403 },
    );
  }

  if (body.name || body.environment) {
    await admin
      .schema("kontrolia_auth")
      .from("applications")
      .update({
        ...(body.name ? { name: body.name } : {}),
        ...(body.environment ? { environment: body.environment } : {}),
      })
      .eq("id", application.id);
  }

  const permissionKeys: string[] = [];
  for (const permission of body.permissions) {
    if (!permission.resource || !permission.action) continue;
    const key = `${body.slug}.${permission.resource}.${permission.action}`;
    const { error: upsertError } = await admin
      .schema("kontrolia_auth")
      .from("permissions")
      .upsert(
        {
          application_id: application.id,
          resource: permission.resource,
          action: permission.action,
          key,
          description: permission.description ?? null,
        },
        { onConflict: "key" },
      );
    if (upsertError) {
      logError("POST /api/applications/sync", upsertError, { slug: body.slug, permissionKey: key });
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
    permissionKeys.push(key);
  }

  return NextResponse.json({ applicationId: application.id, permissionKeys });
}
