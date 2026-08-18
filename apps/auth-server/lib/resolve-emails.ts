import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * kontrolia_auth.memberships has no email/name columns (those live in
 * auth.users, which RLS-scoped browser queries can never reach) — callers
 * that list members need this to resolve them server-side.
 *
 * GoTrue's admin API has no "get users by id list" endpoint — the closest
 * thing to a batch fetch is paging through listUsers() once and building a
 * lookup map, instead of one getUserById() round-trip per member.
 */

export interface ResolvedUserInfo {
  email: string;
  /** From user_metadata.full_name (set at registration) — null if never provided. */
  name: string | null;
}

async function pageThroughUsers(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[],
): Promise<Map<string, ResolvedUserInfo>> {
  const infoById = new Map<string, ResolvedUserInfo>();
  const remaining = new Set(userIds);
  const perPage = 200;
  let page = 1;

  while (remaining.size > 0) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data || data.users.length === 0) break;
    for (const user of data.users) {
      if (remaining.has(user.id)) {
        const fullName = user.user_metadata?.full_name;
        infoById.set(user.id, {
          email: user.email ?? "(desconocido)",
          name: typeof fullName === "string" && fullName.trim() ? fullName : null,
        });
        remaining.delete(user.id);
      }
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return infoById;
}

/** Email only — the original, narrower helper every existing caller uses. */
export async function resolveEmails(admin: ReturnType<typeof createSupabaseAdminClient>, userIds: string[]): Promise<Map<string, string>> {
  const infoById = await pageThroughUsers(admin, userIds);
  return new Map([...infoById].map(([id, info]) => [id, info.email]));
}

/** Email + name — for callers that need to display a person's name, not just identify them by email. */
export async function resolveUserInfo(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[],
): Promise<Map<string, ResolvedUserInfo>> {
  return pageThroughUsers(admin, userIds);
}
