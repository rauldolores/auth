import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for privileged, server-only operations (e.g. reading
 * every membership of an organization for the invitations flow). Never
 * import this from a Client Component — it bypasses RLS entirely.
 */
export function createSupabaseAdminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
