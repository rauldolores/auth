const CUSTOM_ACCESS_TOKEN_HOOK_URI = "pg-functions://postgres/kontrolia_auth/custom_access_token_hook";
/** GoTrue's internal route for the OAuth 2.1 authorization endpoint — the API rejects oauth_server_enabled without it. */
const OAUTH_SERVER_AUTHORIZATION_PATH = "/oauth/authorize";

export interface ManagementApiResult {
  ok: boolean;
  /** Only present when ok is false. */
  error?: string;
}

/**
 * Extracts the project ref (subdomain) from a Supabase Cloud URL, e.g.
 * "https://abcxyz.supabase.co" -> "abcxyz". Returns null for anything else
 * (self-hosted, a custom domain) — those aren't reachable through Supabase's
 * account-level Management API, which only knows about Cloud projects.
 */
export function extractProjectRef(supabaseUrl: string): string | null {
  const match = supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/);
  return match ? (match[1] as string) : null;
}

async function managementApiFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.supabase.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
}

/**
 * Adds a schema to the project's exposed-schemas list (PostgREST's
 * `db_schema`) if it isn't there already — idempotent, and preserves
 * whatever schemas were already exposed instead of overwriting them, since
 * `db_schema` is a single string representing the *entire* list, not a
 * per-schema toggle.
 */
export async function addExposedSchema(token: string, projectRef: string, schema: string): Promise<ManagementApiResult> {
  let getRes: Response;
  try {
    getRes = await managementApiFetch(`/projects/${projectRef}/postgrest`, token);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (!getRes.ok) {
    const body = (await getRes.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, error: body?.message ?? `HTTP ${getRes.status} leyendo la config actual` };
  }
  const current = (await getRes.json()) as { db_schema?: string };
  const schemas = (current.db_schema ?? "public")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (schemas.includes(schema)) return { ok: true };
  schemas.push(schema);

  let patchRes: Response;
  try {
    patchRes = await managementApiFetch(`/projects/${projectRef}/postgrest`, token, {
      method: "PATCH",
      body: JSON.stringify({ db_schema: schemas.join(",") }),
    });
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (patchRes.ok) return { ok: true };
  const body = (await patchRes.json().catch(() => null)) as { message?: string } | null;
  return { ok: false, error: body?.message ?? `HTTP ${patchRes.status}` };
}

/**
 * Enables the Custom Access Token Hook against
 * kontrolia_auth.custom_access_token_hook — the function that injects
 * organization_id/roles/permissions into the JWT. Cloud projects' database
 * is always named "postgres", so the pg-functions:// URI is fixed.
 */
export async function enableCustomAccessTokenHook(token: string, projectRef: string): Promise<ManagementApiResult> {
  let res: Response;
  try {
    res = await managementApiFetch(`/projects/${projectRef}/config/auth`, token, {
      method: "PATCH",
      body: JSON.stringify({
        hook_custom_access_token_enabled: true,
        hook_custom_access_token_uri: CUSTOM_ACCESS_TOKEN_HOOK_URI,
      }),
    });
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return { ok: false, error: body?.message ?? `HTTP ${res.status}` };
}

/**
 * Enables GoTrue's OAuth 2.1 authorization server — what makes cross-domain
 * SSO possible (admin-panel exchanging a PKCE code for its own session
 * instead of relying on a shared cookie). Without this, registering an OAuth
 * client during install/deploy silently fails with
 * `{"error_code":"feature_disabled","msg":"OAuth server is disabled"}`, and
 * any third-party app trying to log in via the OAuth flow hits the same
 * error. The API rejects `oauth_server_enabled` unless
 * `oauth_server_authorization_path` is sent in the same request, even though
 * conceptually it's just an on/off toggle.
 */
export async function enableOAuthServer(token: string, projectRef: string): Promise<ManagementApiResult> {
  let res: Response;
  try {
    res = await managementApiFetch(`/projects/${projectRef}/config/auth`, token, {
      method: "PATCH",
      body: JSON.stringify({
        oauth_server_enabled: true,
        oauth_server_authorization_path: OAUTH_SERVER_AUTHORIZATION_PATH,
      }),
    });
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return { ok: false, error: body?.message ?? `HTTP ${res.status}` };
}
