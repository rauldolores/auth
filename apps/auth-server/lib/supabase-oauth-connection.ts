import { logError, logSecurityEvent } from "./logger";
import { createSupabaseAdminClient } from "./supabase-admin";

/**
 * Manages this installation's OAuth 2.1 connection to Supabase's own
 * Management API (a "Supabase OAuth App" a platform admin authorizes once
 * from admin-panel) — the self-renewing alternative to a manually-pasted
 * Personal Access Token that silently expires. Tokens live in
 * kontrolia_auth.supabase_oauth_connection (service-role only, see
 * migration 0042); getValidAccessToken() is the one function every caller
 * outside this file should use — it transparently refreshes when the
 * access_token is near expiry, so nothing else in the codebase needs to
 * know or care about token lifetimes.
 */

const TOKEN_ENDPOINT = "https://api.supabase.com/v1/oauth/token";
const TIMEOUT_MS = 10_000;
// Refresh a little before the real expiry, not exactly at it — avoids a
// request that starts just as the token turns invalid mid-flight.
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

export interface SupabaseOauthConnection {
  accessToken: string;
  expiresAt: string;
  connectedAt: string;
  connectedBy: string | null;
}

interface ConnectionRow {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  connected_at: string;
  connected_by: string | null;
}

export function isOauthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_OAUTH_CLIENT_ID) && Boolean(process.env.SUPABASE_OAUTH_CLIENT_SECRET);
}

async function getConnectionRow(): Promise<ConnectionRow | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("kontrolia_auth")
    .from("supabase_oauth_connection")
    .select("access_token, refresh_token, expires_at, connected_at, connected_by")
    .eq("id", true)
    .maybeSingle<ConnectionRow>();
  if (error) {
    logError("supabase-oauth-connection:getConnectionRow", error);
    return null;
  }
  return data;
}

/** Status only — never returns the raw tokens. Safe to expose to admin-panel. */
export async function getConnectionStatus(): Promise<SupabaseOauthConnection | null> {
  const row = await getConnectionRow();
  if (!row) return null;
  return { accessToken: row.access_token, expiresAt: row.expires_at, connectedAt: row.connected_at, connectedBy: row.connected_by };
}

async function saveConnection(input: { accessToken: string; refreshToken: string; expiresIn: number; userId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .schema("kontrolia_auth")
    .from("supabase_oauth_connection")
    .upsert({
      id: true,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      expires_at: new Date(Date.now() + input.expiresIn * 1000).toISOString(),
      connected_by: input.userId,
      connected_at: now,
      updated_at: now,
    });
  if (error) {
    logError("supabase-oauth-connection:saveConnection", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Refresh-driven update — deliberately leaves connected_by/connected_at untouched, unlike saveConnection. */
async function updateTokens(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("kontrolia_auth")
    .from("supabase_oauth_connection")
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) logError("supabase-oauth-connection:updateTokens", error);
}

export async function disconnectConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.schema("kontrolia_auth").from("supabase_oauth_connection").delete().eq("id", true);
  if (error) {
    logError("supabase-oauth-connection:disconnectConnection", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

interface TokenResult {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

async function callTokenEndpoint(params: Record<string, string>): Promise<TokenResult> {
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, error: "SUPABASE_OAUTH_CLIENT_ID/SUPABASE_OAUTH_CLIENT_SECRET no están configurados en este servidor." };
  }

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !data.access_token || !data.refresh_token || !data.expires_in) {
      logError("supabase-oauth-connection:callTokenEndpoint", data, { status: response.status });
      return { ok: false, error: data.error_description ?? data.error ?? `Supabase respondió ${response.status}` };
    }
    return { ok: true, accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
  } catch (error) {
    logError("supabase-oauth-connection:callTokenEndpoint", error);
    const message =
      error instanceof Error && error.name === "TimeoutError" ? "Supabase tardó demasiado en responder" : (error as Error).message;
    return { ok: false, error: `No se pudo contactar la API de Supabase: ${message}` };
  }
}

/** First-time (or reconnect) leg — exchanges the authorization code for the initial token pair and persists it. */
export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await callTokenEndpoint({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  if (!result.ok) return { ok: false, error: result.error! };

  const saved = await saveConnection({
    accessToken: result.accessToken!,
    refreshToken: result.refreshToken!,
    expiresIn: result.expiresIn!,
    userId: input.userId,
  });
  if (!saved.ok) return saved;

  logSecurityEvent("supabase-oauth-connection: connected", { userId: input.userId });
  return { ok: true };
}

/**
 * The one function the rest of the codebase should call. Returns null when
 * there's no connection at all, or when a refresh was needed but failed
 * (e.g. the user revoked access from their Supabase account) — callers
 * treat null the same as "not connected", never throw.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const row = await getConnectionRow();
  if (!row) return null;

  const expiresAtMs = new Date(row.expires_at).getTime();
  if (expiresAtMs - Date.now() > REFRESH_BUFFER_MS) return row.access_token;

  const refreshed = await callTokenEndpoint({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  if (!refreshed.ok) {
    logError("supabase-oauth-connection:getValidAccessToken", refreshed.error);
    return null;
  }
  await updateTokens(refreshed.accessToken!, refreshed.refreshToken!, refreshed.expiresIn!);
  return refreshed.accessToken!;
}
