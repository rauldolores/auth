import { authorizePlatformAdmin } from "@/lib/gotrue-admin";
import { getGotrueExternalSettings } from "@/lib/gotrue-settings";
import { logSecurityEvent } from "@/lib/logger";
import {
  getManagementAuthConfig,
  isManagementApiConfigured,
  updateManagementAuthConfig,
  type SocialProvider,
} from "@/lib/supabase-management";
import { NextResponse } from "next/server";

/**
 * Lets a platform admin activate Google/Microsoft social login entirely
 * from admin-panel — no Supabase dashboard visit required — by driving
 * Supabase's Management API (see lib/supabase-management.ts, which prefers
 * the self-renewing OAuth connection over the fallback static
 * SUPABASE_MANAGEMENT_API_TOKEN). Read status always reflects GoTrue's own
 * live settings (works on every deployment); the write path degrades to
 * `managementApiAvailable: false` — read-only status, manual instructions —
 * when neither auth path is set up (self-hosted Docker, or a Cloud install
 * that hasn't connected either one yet).
 */

const RATE_LIMIT_KEY_PREFIX = "social-login";

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

export async function GET(request: Request) {
  const denied = await authorizePlatformAdmin(request, corsHeaders(), RATE_LIMIT_KEY_PREFIX);
  if (denied) return denied;

  const [live, configured] = await Promise.all([getGotrueExternalSettings(), isManagementApiConfigured()]);
  const managed = configured ? await getManagementAuthConfig() : null;

  return NextResponse.json(
    {
      managementApiAvailable: managed !== null,
      google: {
        liveEnabled: live.googleEnabled,
        configured: Boolean(managed?.google.clientId),
        clientId: managed?.google.clientId ?? null,
      },
      azure: {
        liveEnabled: live.azureEnabled,
        configured: Boolean(managed?.azure.clientId),
        clientId: managed?.azure.clientId ?? null,
        tenantUrl: managed?.azure.tenantUrl ?? null,
      },
    },
    { headers: corsHeaders() },
  );
}

interface PatchBody {
  enabled?: boolean;
  clientId?: string;
  secret?: string;
  tenantUrl?: string;
}

export async function PATCH(request: Request) {
  const denied = await authorizePlatformAdmin(request, corsHeaders(), RATE_LIMIT_KEY_PREFIX);
  if (denied) return denied;

  const provider = new URL(request.url).searchParams.get("provider");
  if (provider !== "google" && provider !== "azure") {
    return NextResponse.json({ error: "provider debe ser 'google' o 'azure'" }, { status: 400, headers: corsHeaders() });
  }

  if (!(await isManagementApiConfigured())) {
    return NextResponse.json(
      {
        error:
          "La activación en vivo no está disponible: conecta este servidor con Supabase desde Configuración → Inicio de sesión social, o configura SUPABASE_MANAGEMENT_API_TOKEN.",
      },
      { status: 400, headers: corsHeaders() },
    );
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (booleano) es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const current = await getManagementAuthConfig();
  const alreadyConfigured = Boolean(current?.[provider as SocialProvider].clientId);

  if (body.enabled) {
    const clientId = body.clientId?.trim() || current?.[provider as SocialProvider].clientId;
    if (!clientId) {
      return NextResponse.json({ error: "Client ID es requerido para activar este proveedor." }, { status: 400, headers: corsHeaders() });
    }
    if (!body.secret && !alreadyConfigured) {
      return NextResponse.json({ error: "Client Secret es requerido para activar este proveedor." }, { status: 400, headers: corsHeaders() });
    }
  }

  const result = await updateManagementAuthConfig(provider, {
    enabled: body.enabled,
    clientId: body.clientId?.trim() || undefined,
    secret: body.secret || undefined,
    tenantUrl: provider === "azure" ? body.tenantUrl?.trim() || undefined : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502, headers: corsHeaders() });
  }

  logSecurityEvent("social-login: provider updated", { provider, enabled: body.enabled });

  const [live, managed] = await Promise.all([getGotrueExternalSettings(), getManagementAuthConfig()]);
  return NextResponse.json(
    {
      managementApiAvailable: managed !== null,
      google: {
        liveEnabled: live.googleEnabled,
        configured: Boolean(managed?.google.clientId),
        clientId: managed?.google.clientId ?? null,
      },
      azure: {
        liveEnabled: live.azureEnabled,
        configured: Boolean(managed?.azure.clientId),
        clientId: managed?.azure.clientId ?? null,
        tenantUrl: managed?.azure.tenantUrl ?? null,
      },
    },
    { headers: corsHeaders() },
  );
}
