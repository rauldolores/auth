import { createBrowserClient } from "@supabase/ssr";
import { kontroliaClientConfig } from "./kontrolia-config";

const KONTROLIA_SCHEMA = "kontrolia";

/**
 * Read-only browser client for the kontrolia schema, used by the dashboard
 * list pages. Every query is still RLS-scoped to what the signed-in admin
 * can see — this client carries no elevated privileges.
 *
 * Uses @supabase/ssr's createBrowserClient (cookie-backed, shared with the
 * session @kontrolia/react's <AuthProvider> already established) instead of
 * a plain supabase-js createClient, which would be a second, disconnected
 * anonymous session.
 *
 * Calls .schema("kontrolia") explicitly on every query rather than passing
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
