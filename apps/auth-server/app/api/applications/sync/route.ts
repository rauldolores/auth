import { timingSafeEqual } from "node:crypto";
import { hashApplicationApiKey } from "@kontrolia/db";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
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

function extractApiKey(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

function safeEqualHex(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
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
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: "Falta el header Authorization: Bearer <api key>" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SyncBody | null;
  if (!body?.slug || !Array.isArray(body.permissions)) {
    return NextResponse.json({ error: "slug y permissions son requeridos" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: application, error: lookupError } = await admin
    .schema("kontrolia")
    .from("applications")
    .select("id, api_key_hash")
    .eq("slug", body.slug)
    .maybeSingle<{ id: string; api_key_hash: string | null }>();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!application) return NextResponse.json({ error: "Aplicación no encontrada" }, { status: 404 });
  if (!application.api_key_hash) {
    return NextResponse.json(
      {
        error:
          "Esta aplicación no tiene una clave de sincronización. Vuelve a registrarla con el instalador (CLI) para generar una.",
      },
      { status: 403 },
    );
  }
  if (!safeEqualHex(hashApplicationApiKey(apiKey), application.api_key_hash)) {
    return NextResponse.json({ error: "Clave inválida" }, { status: 401 });
  }

  if (body.name || body.environment) {
    await admin
      .schema("kontrolia")
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
      .schema("kontrolia")
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
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
    permissionKeys.push(key);
  }

  return NextResponse.json({ applicationId: application.id, permissionKeys });
}
