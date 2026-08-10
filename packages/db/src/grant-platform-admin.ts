import { Client } from "pg";

export interface GrantPlatformAdminOptions {
  /** Postgres connection string — same trust model as migrate(): whoever has
   * this can already do anything in the database, so this bypasses the
   * app's own is_platform_admin authorization check entirely. That's the
   * point — it's the recovery path for when there are zero platform admins
   * (e.g. bootstrap_first_platform_admin() didn't fire because auth.users
   * already had rows from something else sharing the same Supabase
   * project), which the admin-panel UI can never self-serve since its API
   * requires an existing platform admin to call it. */
  connectionString: string;
  email: string;
}

export interface GrantPlatformAdminResult {
  userId: string;
  email: string;
  /** True if this user already was a platform admin — grant is idempotent. */
  alreadyGranted: boolean;
}

/** Grants platform admin directly via SQL — no HTTP layer, no JWT required. */
export async function grantPlatformAdmin({ connectionString, email }: GrantPlatformAdminOptions): Promise<GrantPlatformAdminResult> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const { rows: users } = await client.query<{ id: string; email: string }>(
      "select id, email from auth.users where lower(email) = lower($1) limit 1",
      [email],
    );
    const user = users[0];
    if (!user) {
      throw new Error(`No hay ningún usuario registrado con el correo "${email}". Regístrate primero desde auth-server.`);
    }

    const { rows: inserted } = await client.query<{ user_id: string }>(
      `insert into kontrolia_auth.platform_admins (user_id)
       values ($1)
       on conflict (user_id) do nothing
       returning user_id`,
      [user.id],
    );

    return { userId: user.id, email: user.email, alreadyGranted: inserted.length === 0 };
  } finally {
    await client.end();
  }
}
