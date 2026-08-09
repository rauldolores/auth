import { Client } from "pg";
import { generateApplicationApiKey, hashApplicationApiKey } from "./api-key.js";

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
  /**
   * The plaintext sync API key (see POST /api/applications/sync on
   * auth-server) — only present the first time this slug is registered.
   * Only the hash is stored; there is no way to recover it later, so the
   * caller must surface it to the operator immediately. `null` means the
   * application already existed and its key (if any) was left untouched.
   */
  apiKey: string | null;
}

/**
 * Inserts an application and its permission catalog directly against
 * Postgres. kontrolia_auth.applications/permissions have no insert policy for
 * regular users (see migrations/0010_rls_policies.sql — writes are meant to
 * go through a platform-admin path), so this is that path: a direct,
 * service-role-equivalent write, the same way migrate() bypasses RLS to
 * apply schema changes. Safe to re-run — the slug and permission key are
 * both upserted, and re-running never rotates an existing api_key_hash.
 */
export async function registerApplication(options: RegisterApplicationOptions): Promise<RegisteredApplication> {
  const client = new Client({ connectionString: options.connectionString });
  await client.connect();

  try {
    const candidateApiKey = generateApplicationApiKey();

    const {
      rows: [application],
    } = await client.query<{ id: string; inserted: boolean }>(
      `insert into kontrolia_auth.applications (name, slug, environment, api_key_hash)
       values ($1, $2, $3, $4)
       on conflict (slug) do update set name = excluded.name, environment = excluded.environment
       returning id, (xmax = 0) as inserted`,
      [options.name, options.slug, options.environment, hashApplicationApiKey(candidateApiKey)],
    );
    if (!application) throw new Error(`Failed to upsert application "${options.slug}"`);

    const permissionKeys: string[] = [];
    for (const permission of options.permissions) {
      const key = `${options.slug}.${permission.resource}.${permission.action}`;
      await client.query(
        `insert into kontrolia_auth.permissions (application_id, resource, action, key, description)
         values ($1, $2, $3, $4, $5)
         on conflict (key) do update set description = excluded.description`,
        [application.id, permission.resource, permission.action, key, permission.description ?? null],
      );
      permissionKeys.push(key);
    }

    return { applicationId: application.id, permissionKeys, apiKey: application.inserted ? candidateApiKey : null };
  } finally {
    await client.end();
  }
}
