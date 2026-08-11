import { createBrowserClient } from "@supabase/ssr";
import { kontroliaClientConfig } from "./kontrolia-config";

const KONTROLIA_SCHEMA = "kontrolia_auth";

/**
 * Browser client for the kontrolia_auth schema, used by the dashboard list
 * and mutation pages (invitations, role assignment, member status, etc).
 * It carries no elevated privileges of its own — every query, reads and
 * writes alike, is RLS-scoped to what the signed-in admin's own token is
 * allowed to see or change.
 *
 * Uses @supabase/ssr's createBrowserClient (cookie-backed, shared with the
 * session @kontrolia/react's <AuthProvider> already established) instead of
 * a plain supabase-js createClient, which would be a second, disconnected
 * anonymous session.
 *
 * Calls .schema("kontrolia_auth") explicitly on every query rather than passing
 * `db: { schema }` to the constructor — createBrowserClient doesn't forward
 * that option to the underlying client, so requests would otherwise hit
 * PostgREST's default `public` schema and 404.
 */
export function createKontroliaSchemaClient() {
  const client = createBrowserClient(kontroliaClientConfig.supabaseUrl, kontroliaClientConfig.supabaseAnonKey, {
    cookieOptions: kontroliaClientConfig.cookieDomain ? { domain: kontroliaClientConfig.cookieDomain } : undefined,
  });
  return client.schema(KONTROLIA_SCHEMA);
}
