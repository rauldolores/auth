import { logError } from "@/lib/logger";

const GOTRUE_ADMIN_TIMEOUT_MS = 10_000;

/**
 * GoTrue's admin API has no "get user by exact email" endpoint — `filter` is
 * a substring match, so the result still needs an exact (case-insensitive)
 * comparison against the candidates it returns.
 */
export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
      {
        signal: AbortSignal.timeout(GOTRUE_ADMIN_TIMEOUT_MS),
        // Kong (Supabase Cloud's gateway) requires `apikey` on every request
        // independent of Authorization — same gap fixed in oauth-clients.
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { users: { id: string; email: string }[] };
    return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
  } catch (error) {
    // A hung/unreachable GoTrue would otherwise hang this route indefinitely
    // (no timeout) or crash it with an unlogged uncaught rejection (no
    // try/catch) — bound it and let the caller treat this the same as
    // "no user found".
    logError("findUserByEmail", error);
    return null;
  }
}
