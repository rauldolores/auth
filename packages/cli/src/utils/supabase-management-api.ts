const CUSTOM_ACCESS_TOKEN_HOOK_URI = "pg-functions://postgres/kontrolia_auth/custom_access_token_hook";

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
