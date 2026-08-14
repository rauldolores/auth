import { logError } from "@/lib/logger";

/**
 * Talks to Supabase's Management API (api.supabase.com) — the only way to
 * configure a Cloud-hosted project's external OAuth providers (Google,
 * Azure) programmatically, since GoTrue itself exposes no write API for its
 * own config and Supabase Cloud's copy of GoTrue isn't something this app's
 * SUPABASE_SERVICE_ROLE_KEY can reach. Requires a Management API personal
 * access token (SUPABASE_MANAGEMENT_API_TOKEN) — a much broader credential
 * than anything else this app stores, since it can manage the *entire*
 * Supabase account, not just this one project. Deliberately optional: a
 * self-hosted Docker install (or a Cloud install that hasn't set the token)
 * has no live-write capability here, and every caller must check
 * isManagementApiConfigured() first and degrade to read-only status +
 * manual instructions rather than erroring.
 */

const MANAGEMENT_API_BASE = "https://api.supabase.com/v1";
const TIMEOUT_MS = 10_000;

function getProjectRef(): string | null {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  // Only Supabase Cloud project URLs carry a ref this API can use — a
  // self-hosted SUPABASE_URL (localhost, a custom domain fronting
  // docker-compose's own Kong/GoTrue) has no equivalent Management API at
  // all, so those never match and the feature correctly reports itself
  // unavailable rather than guessing.
  const match = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url);
  return match ? match[1]! : null;
}

export function isManagementApiConfigured(): boolean {
  return Boolean(process.env.SUPABASE_MANAGEMENT_API_TOKEN) && getProjectRef() !== null;
}

export interface SocialProviderConfig {
  enabled: boolean;
  /** Not a secret — OAuth client IDs are meant to be public. Safe to return to admin-panel. */
  clientId: string | null;
}

export interface AuthProviderConfig {
  google: SocialProviderConfig;
  azure: SocialProviderConfig & { tenantUrl: string | null };
}

/** Reads current provider config from Supabase. Never includes client secrets in the returned shape — deliberately not modeled, so no call site can accidentally leak one to the browser. */
export async function getManagementAuthConfig(): Promise<AuthProviderConfig | null> {
  const ref = getProjectRef();
  const token = process.env.SUPABASE_MANAGEMENT_API_TOKEN;
  if (!ref || !token) return null;

  try {
    const response = await fetch(`${MANAGEMENT_API_BASE}/projects/${ref}/config/auth`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      logError("supabase-management:getManagementAuthConfig", { status: response.status });
      return null;
    }
    const data = (await response.json()) as Record<string, unknown>;
    return {
      google: {
        enabled: Boolean(data.external_google_enabled),
        clientId: (data.external_google_client_id as string | null) ?? null,
      },
      azure: {
        enabled: Boolean(data.external_azure_enabled),
        clientId: (data.external_azure_client_id as string | null) ?? null,
        tenantUrl: (data.external_azure_url as string | null) ?? null,
      },
    };
  } catch (error) {
    logError("supabase-management:getManagementAuthConfig", error);
    return null;
  }
}

export type SocialProvider = "google" | "azure";

export interface UpdateProviderInput {
  enabled: boolean;
  clientId?: string;
  secret?: string;
  /** Azure/Entra ID only — the tenant-scoped authorization endpoint base URL. */
  tenantUrl?: string;
}

function buildPatchBody(provider: SocialProvider, input: UpdateProviderInput): Record<string, string | boolean> {
  const prefix = provider === "google" ? "external_google" : "external_azure";
  const patch: Record<string, string | boolean> = { [`${prefix}_enabled`]: input.enabled };
  if (input.clientId !== undefined) patch[`${prefix}_client_id`] = input.clientId;
  if (input.secret !== undefined) patch[`${prefix}_secret`] = input.secret;
  if (provider === "azure" && input.tenantUrl !== undefined) patch.external_azure_url = input.tenantUrl;
  return patch;
}

export async function updateManagementAuthConfig(
  provider: SocialProvider,
  input: UpdateProviderInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ref = getProjectRef();
  const token = process.env.SUPABASE_MANAGEMENT_API_TOKEN;
  if (!ref || !token) {
    return { ok: false, error: "La API de administración de Supabase no está configurada en este servidor." };
  }

  try {
    const response = await fetch(`${MANAGEMENT_API_BASE}/projects/${ref}/config/auth`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildPatchBody(provider, input)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      logError("supabase-management:updateManagementAuthConfig", body, { provider, status: response.status });
      return { ok: false, error: body.message ?? `Supabase respondió con un error (${response.status}).` };
    }
    return { ok: true };
  } catch (error) {
    logError("supabase-management:updateManagementAuthConfig", error, { provider });
    const message =
      error instanceof Error && error.name === "TimeoutError" ? "Supabase tardó demasiado en responder" : (error as Error).message;
    return { ok: false, error: `No se pudo contactar la API de Supabase: ${message}` };
  }
}
