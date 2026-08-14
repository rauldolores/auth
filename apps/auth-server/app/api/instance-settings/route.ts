import { verifyRequest } from "@kontrolia/auth/server";
import { getInstanceSettings } from "@/lib/instance-settings";
import { logError, logSecurityEvent } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

/**
 * Instance-wide branding/behavior settings — read by anyone (auth-server's
 * own unauthenticated login/register screens need this before anyone is
 * signed in), written only by platform admins (admin-panel's Apariencia
 * page).
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
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

export async function GET() {
  const settings = await getInstanceSettings();
  return NextResponse.json(settings, { headers: corsHeaders() });
}

const THEMES = ["light", "dark", "system"] as const;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

interface PatchBody {
  registrationEnabled?: boolean;
  theme?: string;
  buttonColor?: string | null;
}

export async function PATCH(request: Request) {
  const authResult = await authorizePlatformAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400, headers: corsHeaders() });

  const updates: Record<string, unknown> = {};

  if (body.registrationEnabled !== undefined) {
    if (typeof body.registrationEnabled !== "boolean") {
      return NextResponse.json({ error: "registrationEnabled debe ser booleano" }, { status: 400, headers: corsHeaders() });
    }
    updates.registration_enabled = body.registrationEnabled;
  }

  if (body.theme !== undefined) {
    if (!THEMES.includes(body.theme as (typeof THEMES)[number])) {
      return NextResponse.json({ error: "theme debe ser light, dark o system" }, { status: 400, headers: corsHeaders() });
    }
    updates.theme = body.theme;
  }

  if (body.buttonColor !== undefined) {
    if (body.buttonColor !== null && !HEX_COLOR.test(body.buttonColor)) {
      return NextResponse.json({ error: "buttonColor debe ser un color hex (#rrggbb) o null" }, { status: 400, headers: corsHeaders() });
    }
    updates.button_color = body.buttonColor;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400, headers: corsHeaders() });
  }

  updates.updated_at = new Date().toISOString();
  updates.updated_by = authResult.userId;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.schema("kontrolia_auth").from("instance_settings").update(updates).eq("id", true);
  if (error) {
    logError("PATCH /api/instance-settings", error, { userId: authResult.userId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  logSecurityEvent("instance-settings: update", { userId: authResult.userId, fields: Object.keys(updates) });
  return NextResponse.json(await getInstanceSettings(), { headers: corsHeaders() });
}
