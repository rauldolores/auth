import { verifyRequest } from "@kontrolia/auth/server";
import { getInstanceSettings } from "@/lib/instance-settings";
import { logError, logSecurityEvent } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

/** Upload/remove the custom logo shown on auth-server's hosted auth screens instead of the default KontrolIA Auth mark. */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

async function authorizePlatformAdmin(request: Request): Promise<{ userId: string } | NextResponse> {
  try {
    const { claims } = await verifyRequest(request, { supabaseUrl: process.env.SUPABASE_URL! });
    if (!claims.is_platform_admin) {
      return NextResponse.json({ error: "Se requiere ser platform admin" }, { status: 403, headers: corsHeaders() });
    }
    return { userId: claims.sub };
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders() });
  }
}

const BUCKET = "branding";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};
const KNOWN_LOGO_PATHS = Object.values(ALLOWED_TYPES).map((ext) => `logo.${ext}`);

export async function POST(request: Request) {
  const authResult = await authorizePlatformAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Formato no soportado — usa PNG, JPG, SVG o WebP." },
      { status: 400, headers: corsHeaders() },
    );
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "El logo no puede pesar más de 2MB." }, { status: 400, headers: corsHeaders() });
  }

  const admin = createSupabaseAdminClient();

  // Clear any previously-uploaded logo under a different extension first —
  // otherwise switching from a .png to a .svg would leave both in the
  // bucket, with only one actually referenced by logo_url.
  await admin.storage.from(BUCKET).remove(KNOWN_LOGO_PATHS);

  const path = `logo.${ext}`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (uploadError) {
    logError("POST /api/instance-settings/logo", uploadError, { userId: authResult.userId });
    return NextResponse.json({ error: uploadError.message }, { status: 500, headers: corsHeaders() });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust so a re-upload with the same extension shows immediately —
  // the bucket is public and CDN/browser-cached by URL.
  const logoUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await admin
    .schema("kontrolia_auth")
    .from("instance_settings")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString(), updated_by: authResult.userId })
    .eq("id", true);
  if (updateError) {
    logError("POST /api/instance-settings/logo (update row)", updateError, { userId: authResult.userId });
    return NextResponse.json({ error: updateError.message }, { status: 500, headers: corsHeaders() });
  }

  logSecurityEvent("instance-settings: logo uploaded", { userId: authResult.userId });
  return NextResponse.json({ logoUrl }, { headers: corsHeaders() });
}

export async function DELETE(request: Request) {
  const authResult = await authorizePlatformAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const admin = createSupabaseAdminClient();
  await admin.storage.from(BUCKET).remove(KNOWN_LOGO_PATHS);

  const { error } = await admin
    .schema("kontrolia_auth")
    .from("instance_settings")
    .update({ logo_url: null, updated_at: new Date().toISOString(), updated_by: authResult.userId })
    .eq("id", true);
  if (error) {
    logError("DELETE /api/instance-settings/logo", error, { userId: authResult.userId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  logSecurityEvent("instance-settings: logo removed", { userId: authResult.userId });
  return NextResponse.json(await getInstanceSettings(), { headers: corsHeaders() });
}
