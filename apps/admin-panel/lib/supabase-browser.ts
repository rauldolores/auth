import { createClient } from "@supabase/supabase-js";
import { kontroliaClientConfig } from "./kontrolia-config";

/**
 * Read-only browser client for the kontrolia schema, used by the dashboard
 * list pages. Every query is still RLS-scoped to what the signed-in admin
 * can see — this client carries no elevated privileges.
 */
export function createKontroliaSchemaClient() {
  return createClient(kontroliaClientConfig.supabaseUrl, kontroliaClientConfig.supabaseAnonKey, {
    db: { schema: "kontrolia" },
  });
}
