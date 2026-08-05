export interface RegisterOAuthClientOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
  clientName: string;
  redirectUris: string[];
}

/**
 * Registers a first-party OAuth client (admin-panel) against this Supabase
 * project's own OAuth 2.1 server, via the service-role admin API — the only
 * way SSO between auth-server and admin-panel survives them living on
 * genuinely different domains (not just subdomains), since a shared cookie
 * simply can't cross that boundary.
 *
 * Returns null (rather than throwing) when the project doesn't have OAuth
 * server mode enabled — an existing Supabase project the installer doesn't
 * control the config of, same "last mile manual step" as the Custom Access
 * Token Hook. The caller is expected to fall back gracefully and tell the
 * user how to enable it themselves.
 */
export async function registerOAuthClient(options: RegisterOAuthClientOptions): Promise<string | null> {
  const response = await fetch(`${options.supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/oauth/clients`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.serviceRoleKey}`,
      apikey: options.serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_name: options.clientName,
      redirect_uris: options.redirectUris,
      client_type: "public",
      token_endpoint_auth_method: "none",
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { client_id: string };
  return data.client_id;
}
