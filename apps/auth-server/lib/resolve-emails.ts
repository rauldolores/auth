import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * kontrolia_auth.memberships has no email column (that lives in auth.users,
 * which RLS-scoped browser queries can never reach) — callers that list
 * members need this to resolve emails server-side.
 *
 * GoTrue's admin API has no "get users by id list" endpoint — the closest
 * thing to a batch fetch is paging through listUsers() once and building a
 * lookup map, instead of one getUserById() round-trip per member.
 */
export async function resolveEmails(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const emailById = new Map<string, string>();
  const remaining = new Set(userIds);
  const perPage = 200;
  let page = 1;

  while (remaining.size > 0) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data || data.users.length === 0) break;
    for (const user of data.users) {
      if (remaining.has(user.id)) {
        emailById.set(user.id, user.email ?? "(desconocido)");
        remaining.delete(user.id);
      }
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return emailById;
}
