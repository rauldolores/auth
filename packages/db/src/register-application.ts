import { Client } from "pg";

export interface PermissionInput {
  resource: string;
  action: string;
  description?: string;
}

export interface RegisterApplicationOptions {
  /** Postgres connection string — same one migrate() uses. */
  connectionString: string;
  name: string;
  slug: string;
  environment: "development" | "staging" | "production";
  permissions: PermissionInput[];
}

export interface RegisteredApplication {
  applicationId: string;
  permissionKeys: string[];
}

/**
 * Inserts an application and its permission catalog directly against
 * Postgres. kontrolia.applications/permissions have no insert policy for
 * regular users (see migrations/0010_rls_policies.sql — writes are meant to
 * go through a platform-admin path) and no such admin API exists yet, so
 * this is that path: a direct, service-role-equivalent write, the same way
 * migrate() bypasses RLS to apply schema changes. Safe to re-run — the slug
 * and permission key are both upserted.
 */
export async function registerApplication(options: RegisterApplicationOptions): Promise<RegisteredApplication> {
  const client = new Client({ connectionString: options.connectionString });
  await client.connect();

  try {
    const {
      rows: [application],
    } = await client.query<{ id: string }>(
      `insert into kontrolia.applications (name, slug, environment)
       values ($1, $2, $3)
       on conflict (slug) do update set name = excluded.name, environment = excluded.environment
       returning id`,
      [options.name, options.slug, options.environment],
    );
    if (!application) throw new Error(`Failed to upsert application "${options.slug}"`);

    const permissionKeys: string[] = [];
    for (const permission of options.permissions) {
      const key = `${options.slug}.${permission.resource}.${permission.action}`;
      await client.query(
        `insert into kontrolia.permissions (application_id, resource, action, key, description)
         values ($1, $2, $3, $4, $5)
         on conflict (key) do update set description = excluded.description`,
        [application.id, permission.resource, permission.action, key, permission.description ?? null],
      );
      permissionKeys.push(key);
    }

    return { applicationId: application.id, permissionKeys };
  } finally {
    await client.end();
  }
}
