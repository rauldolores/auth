import { getUserFromClaims, verifyRequest } from "@kontrolia/auth/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { KontroliaTokenClaims } from "@kontrolia/shared";
import { checkRateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/logger";
import { GET as listApplicationsRoute } from "@/app/api/applications/route";
import { PATCH as updateApplicationRoute } from "@/app/api/applications/[id]/route";
import { POST as claimApplicationRoute } from "@/app/api/applications/claim/route";
import { GET as listApplicationKeysRoute, POST as createApplicationKeyRoute } from "@/app/api/applications/[id]/keys/route";
import { DELETE as revokeApplicationKeyRoute } from "@/app/api/applications/[id]/keys/[keyId]/route";
import { GET as queryAuditLogRoute } from "@/app/api/audit-logs/route";
import { GET as listInvitationsRoute, POST as inviteUserRoute } from "@/app/api/invitations/route";
import { DELETE as revokeInvitationRoute, PATCH as resendInvitationRoute } from "@/app/api/invitations/[id]/route";
import {
  DELETE as removeMemberRoute,
  GET as listOrganizationMembersRoute,
  PATCH as updateMemberStatusRoute,
} from "@/app/api/organization-members/route";
import { DELETE as revokeMembershipRoleRoute, POST as grantMembershipRoleRoute } from "@/app/api/organization-members/roles/route";
import {
  DELETE as disableApplicationRoute,
  GET as listOrganizationApplicationsRoute,
  POST as enableApplicationRoute,
} from "@/app/api/organizations/[id]/applications/route";
import { DELETE as deleteOrganizationRoute, PATCH as renameOrganizationRoute } from "@/app/api/organizations/[id]/route";
import { GET as listOrganizationsRoute, POST as createOrganizationRoute } from "@/app/api/organizations/route";
import { POST as createOauthClientRoute } from "@/app/api/oauth-clients/route";
import { GET as listPermissionsRoute } from "@/app/api/permissions/route";
import {
  DELETE as revokePlatformAdminRoute,
  GET as listPlatformAdminsRoute,
  POST as grantPlatformAdminRoute,
} from "@/app/api/platform-admins/route";
import {
  DELETE as revokeRolePermissionRoute,
  GET as getRolePermissionsRoute,
  POST as grantRolePermissionRoute,
} from "@/app/api/roles/[id]/permissions/route";
import { DELETE as deleteRoleRoute } from "@/app/api/roles/[id]/route";
import { GET as listRolesRoute, POST as createRoleRoute } from "@/app/api/roles/route";
import { z } from "zod";

/**
 * MCP tool surface — read-only tools (Phase 3) plus mutating tools (Phase 4)
 * below. Every tool calls the exact same Route Handler admin-panel/external
 * callers already use (a synthetic same-process Request carrying the
 * caller's real bearer token) — no parallel query/mutation logic, no third
 * fork of business logic. Whatever RLS policy/platform-admin check already
 * gates a route gates its tool identically.
 *
 * Destructive or hard-to-reverse tools require a `confirm*` argument that
 * must match the resource's *current* identifier (name/slug/email), checked
 * here by re-fetching that identifier through the same read route before
 * the mutation runs — the MCP-call equivalent of admin-panel's
 * ConfirmDialog, since a tool call has no dialog to show. Tools the UI
 * doesn't gate behind a confirm dialog either (rename, invite, grant a
 * role/permission) skip this — matching, not exceeding, the UI's own risk
 * model, except grant/revoke_platform_admin which requires confirmation
 * deliberately above what the UI does today (the manifest's own
 * "highest-risk" flag on that action).
 *
 * Every mutating tool (Phase 5) also goes through registerMutatingTool():
 * per-user rate limiting and a security-event log line per attempt, success
 * or failure. Same in-memory-limiter caveat as everywhere else in this app
 * (apps/auth-server/lib/rate-limit.ts) — best-effort on serverless, fully
 * effective on a long-running process.
 */

type RouteResult = { content: [{ type: "text"; text: string }]; isError?: true };

interface CallOptions {
  method?: string;
  body?: unknown;
  pathId?: string;
}

function internalRequest(path: string, token: string, opts: CallOptions): Request {
  const init: RequestInit = { headers: { Authorization: `Bearer ${token}` } };
  if (opts.method) init.method = opts.method;
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { ...init.headers, "Content-Type": "application/json" };
  }
  return new Request(`http://mcp-internal${path}`, init);
}

async function toResult(response: Response): Promise<RouteResult> {
  if (response.status === 204) return { content: [{ type: "text", text: "OK" }] };
  const body = await response.json().catch(() => null);
  if (body === null) {
    // Empty body (e.g. a 201 with no return payload) is only ambiguous on
    // failure — an ok response with nothing to say just means "it worked".
    return response.ok ? { content: [{ type: "text", text: "OK" }] } : { content: [{ type: "text", text: response.statusText || "Error" }], isError: true };
  }
  const text = JSON.stringify(body);
  return response.ok ? { content: [{ type: "text", text }] } : { content: [{ type: "text", text }], isError: true };
}

function errorResult(text: string): RouteResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** Simple GET+dynamic-param routes (path segment is the resource id). */
type ParamHandler = (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
/** Simple routes with no dynamic path segment. */
type PlainHandler = (request: Request) => Promise<Response>;

async function call(handler: PlainHandler, path: string, token: string, opts: CallOptions = {}): Promise<RouteResult> {
  return toResult(await handler(internalRequest(path, token, opts)));
}

async function callParam(handler: ParamHandler, path: string, id: string, token: string, opts: CallOptions = {}): Promise<RouteResult> {
  return toResult(await handler(internalRequest(path, token, opts), { params: Promise.resolve({ id }) }));
}

/** Like fetchField, for a ParamHandler route (dynamic [id] path segment). */
async function fetchFieldParam(
  handler: ParamHandler,
  path: string,
  id: string,
  token: string,
  extract: (body: unknown) => string | null,
): Promise<string | null> {
  const response = await handler(internalRequest(path, token, {}), { params: Promise.resolve({ id }) });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  return body ? extract(body) : null;
}

/** Extracts a single field from a route's JSON body, for confirmation checks — returns null on any failure (network/parse/missing). */
async function fetchField(handler: PlainHandler, path: string, token: string, extract: (body: unknown) => string | null): Promise<string | null> {
  const response = await handler(internalRequest(path, token, {}));
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  return body ? extract(body) : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/**
 * Rate limit keyed by the verified JWT's sub (user id), not IP — hosted MCP
 * connectors (Claude.ai, ChatGPT) may proxy many distinct real users through
 * a small set of egress IPs, which would make IP-keying either useless (too
 * permissive) or actively harmful (one user's traffic exhausting another's
 * budget). Same limit shape as applications/claim and oauth-clients.
 */
const MUTATION_RATE_LIMIT = { max: 30, windowMs: 5 * 60 * 1000 };

/**
 * Wraps every mutating tool registration with the same two things each one
 * would otherwise have to do by hand: a per-user rate-limit check, and a
 * security-event log line recording what was attempted and whether it
 * succeeded — the MCP-call equivalent of the request logging every
 * REST route already gets for free from being an HTTP endpoint, since a
 * JSON-RPC tool call inside a single POST /api/mcp has no per-action log
 * line otherwise.
 */
// McpServer.registerTool's generics don't collapse cleanly through a
// wrapper like this — deliberately loose typing here since this is a thin,
// internal-only shim, not a public API. Each call site's own inputSchema
// still gets validated by the SDK at runtime regardless.
/* eslint-disable @typescript-eslint/no-explicit-any */
function registerMutatingTool(
  server: McpServer,
  claims: KontroliaTokenClaims,
  name: string,
  config: any,
  callback: (args: any) => Promise<RouteResult>,
): void {
  server.registerTool(name, config, async (args: any) => {
    const rateLimit = checkRateLimit(`mcp-mutation:${claims.sub}`, MUTATION_RATE_LIMIT);
    if (!rateLimit.allowed) {
      logSecurityEvent("mcp: mutation rate limited", { userId: claims.sub, tool: name });
      return errorResult(`Demasiadas solicitudes de escritura. Intenta de nuevo en ${rateLimit.retryAfterSeconds} segundos.`);
    }

    const result = await callback(args);
    logSecurityEvent("mcp: mutation", { tool: name, userId: claims.sub, email: claims.email, success: !result.isError });
    return result;
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function buildServer(token: string, claims: KontroliaTokenClaims): McpServer {
  const server = new McpServer({ name: "kontrolia-auth", version: "1.0.0" });

  // --- Read-only tools (Phase 3) ---

  server.registerTool(
    "get_current_user",
    { title: "Get current user", description: "The authenticated user's own profile, roles, and permissions in their active organization." },
    async () => ({ content: [{ type: "text", text: JSON.stringify(getUserFromClaims(claims)) }] }),
  );

  server.registerTool(
    "list_organizations",
    { title: "List organizations", description: "Organizations the authenticated user belongs to." },
    async () => call(listOrganizationsRoute, "/api/organizations", token),
  );

  server.registerTool(
    "list_organization_members",
    { title: "List organization members", description: "Members of an organization, with their roles.", inputSchema: { organizationId: z.string().describe("Organization id") } },
    async ({ organizationId }) => call(listOrganizationMembersRoute, `/api/organization-members?organizationId=${organizationId}`, token),
  );

  server.registerTool(
    "list_applications",
    { title: "List applications", description: "The full application catalog registered in this install." },
    async () => call(listApplicationsRoute, "/api/applications", token),
  );

  server.registerTool(
    "list_organization_applications",
    { title: "List an organization's applications", description: "Applications a given organization can actually launch (enabled + the caller has access to).", inputSchema: { organizationId: z.string().describe("Organization id") } },
    async ({ organizationId }) => callParam(listOrganizationApplicationsRoute, `/api/organizations/${organizationId}/applications`, organizationId, token),
  );

  server.registerTool(
    "list_permissions",
    { title: "List permissions", description: "Permissions declared by applications' own sync catalogs — read-only, permissions are never created by hand.", inputSchema: { applicationId: z.string().optional().describe("Filter to one application") } },
    async ({ applicationId }) => call(listPermissionsRoute, applicationId ? `/api/permissions?applicationId=${applicationId}` : "/api/permissions", token),
  );

  server.registerTool(
    "list_roles",
    { title: "List roles", description: "System roles plus custom app-scoped roles for an organization.", inputSchema: { organizationId: z.string().describe("Organization id") } },
    async ({ organizationId }) => call(listRolesRoute, `/api/roles?organizationId=${organizationId}`, token),
  );

  server.registerTool(
    "get_role_permissions",
    { title: "Get a role's granted permissions", description: "The permission ids currently granted to one role.", inputSchema: { roleId: z.string().describe("Role id") } },
    async ({ roleId }) => callParam(getRolePermissionsRoute, `/api/roles/${roleId}/permissions`, roleId, token),
  );

  server.registerTool(
    "list_invitations",
    { title: "List invitations", description: "Pending and past invitations for an organization.", inputSchema: { organizationId: z.string().describe("Organization id") } },
    async ({ organizationId }) => call(listInvitationsRoute, `/api/invitations?organizationId=${organizationId}`, token),
  );

  server.registerTool(
    "list_platform_admins",
    { title: "List platform admins", description: "Users with cross-tenant platform-admin status. Requires the caller to be a platform admin." },
    async () => call(listPlatformAdminsRoute, "/api/platform-admins", token),
  );

  server.registerTool(
    "query_audit_log",
    {
      title: "Query the audit log",
      description: "Paginated, filterable audit trail for an organization (action, actor, date range).",
      inputSchema: {
        organizationId: z.string().describe("Organization id"),
        action: z.string().optional().describe("Exact action, e.g. organization.created"),
        actorUserId: z.string().optional().describe("Filter to one actor"),
        from: z.string().optional().describe("ISO timestamp lower bound"),
        to: z.string().optional().describe("ISO timestamp upper bound"),
        offset: z.number().int().min(0).optional(),
      },
    },
    async ({ organizationId, action, actorUserId, from, to, offset }) => {
      const params = new URLSearchParams({ organizationId });
      if (action) params.set("action", action);
      if (actorUserId) params.set("actorUserId", actorUserId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (offset) params.set("offset", String(offset));
      return call(queryAuditLogRoute, `/api/audit-logs?${params.toString()}`, token);
    },
  );

  // --- Mutating tools, no confirmation (Phase 4) ---
  // admin-panel doesn't gate the equivalent UI action behind a ConfirmDialog either.

  registerMutatingTool(
    server,
    claims,
    "create_organization",
    { title: "Create organization", description: "Creates a new organization; the caller becomes its Owner.", inputSchema: { name: z.string(), slug: z.string() } },
    async ({ name, slug }) => call(createOrganizationRoute, "/api/organizations", token, { method: "POST", body: { name, slug } }),
  );

  registerMutatingTool(
    server,
    claims,
    "rename_organization",
    { title: "Rename organization", description: "Renames an organization. Requires Owner or Admin.", inputSchema: { organizationId: z.string(), name: z.string() } },
    async ({ organizationId, name }) => callParam(renameOrganizationRoute, `/api/organizations/${organizationId}`, organizationId, token, { method: "PATCH", body: { name } }),
  );

  registerMutatingTool(
    server,
    claims,
    "invite_user",
    { title: "Invite a user", description: "Creates an invitation and returns its token/link.", inputSchema: { organizationId: z.string(), email: z.string(), roleId: z.string().optional() } },
    async ({ organizationId, email, roleId }) => call(inviteUserRoute, "/api/invitations", token, { method: "POST", body: { organizationId, email, roleId } }),
  );

  registerMutatingTool(
    server,
    claims,
    "resend_invitation",
    { title: "Resend an invitation", description: "Regenerates an invitation's token and expiry.", inputSchema: { invitationId: z.string() } },
    async ({ invitationId }) => callParam(resendInvitationRoute, `/api/invitations/${invitationId}`, invitationId, token, { method: "PATCH" }),
  );

  registerMutatingTool(
    server,
    claims,
    "change_member_status",
    { title: "Activate or suspend a member", description: "Reactivating a suspended member needs no confirmation; suspending uses the suspend_user tool instead, which does.", inputSchema: { membershipId: z.string(), status: z.literal("active") } },
    async ({ membershipId }) => call(updateMemberStatusRoute, `/api/organization-members?membershipId=${membershipId}`, token, { method: "PATCH", body: { status: "active" } }),
  );

  registerMutatingTool(
    server,
    claims,
    "grant_membership_role",
    { title: "Grant an app-scoped role to a member", description: "Fails if the member already has a role for that application — revoke it first.", inputSchema: { membershipId: z.string(), roleId: z.string() } },
    async ({ membershipId, roleId }) => call(grantMembershipRoleRoute, "/api/organization-members/roles", token, { method: "POST", body: { membershipId, roleId } }),
  );

  registerMutatingTool(
    server,
    claims,
    "revoke_membership_role",
    { title: "Revoke an app-scoped role from a member", description: "Easily reversible (re-grant), and the caller already pinpoints the exact grant by id — no confirmation required, matching the UI's own role dropdown.", inputSchema: { membershipId: z.string(), roleId: z.string() } },
    async ({ membershipId, roleId }) => call(revokeMembershipRoleRoute, `/api/organization-members/roles?membershipId=${membershipId}&roleId=${roleId}`, token, { method: "DELETE" }),
  );

  registerMutatingTool(
    server,
    claims,
    "create_custom_role",
    { title: "Create a custom role", description: "Creates an app-scoped custom role; the slug is computed server-side.", inputSchema: { organizationId: z.string(), applicationId: z.string(), name: z.string() } },
    async ({ organizationId, applicationId, name }) => call(createRoleRoute, "/api/roles", token, { method: "POST", body: { organizationId, applicationId, name } }),
  );

  registerMutatingTool(
    server,
    claims,
    "grant_role_permission",
    { title: "Grant a permission to a role", description: "Fails for system/grants_all_permissions roles — those sync automatically.", inputSchema: { roleId: z.string(), permissionId: z.string() } },
    async ({ roleId, permissionId }) => callParam(grantRolePermissionRoute, `/api/roles/${roleId}/permissions`, roleId, token, { method: "POST", body: { permissionId } }),
  );

  registerMutatingTool(
    server,
    claims,
    "enable_application",
    { title: "Enable an application for an organization", description: "Makes the application launchable/assignable within the org.", inputSchema: { organizationId: z.string(), applicationId: z.string() } },
    async ({ organizationId, applicationId }) => callParam(enableApplicationRoute, `/api/organizations/${organizationId}/applications`, organizationId, token, { method: "POST", body: { applicationId } }),
  );

  registerMutatingTool(
    server,
    claims,
    "configure_oauth_client",
    {
      title: "Register a new OAuth client for an application",
      description: "Platform-admin only. Creates a public PKCE OAuth 2.1 client via GoTrue and links it to the application. Check list_applications first — if oauth_client_id is already set, or an unlinked client exists, use link_existing_oauth_client instead to avoid registering a duplicate.",
      inputSchema: { applicationId: z.string(), clientName: z.string(), redirectUris: z.array(z.string()).min(1) },
    },
    async ({ applicationId, clientName, redirectUris }) => {
      const createResult = await call(createOauthClientRoute, "/api/oauth-clients", token, { method: "POST", body: { client_name: clientName, redirect_uris: redirectUris } });
      if (createResult.isError) return createResult;
      const created = asRecord(JSON.parse(createResult.content[0].text));
      const clientId = created?.client_id as string | undefined;
      if (!clientId) return errorResult("El cliente OAuth se creó pero la respuesta no incluyó un client_id — no se pudo vincular a la aplicación.");
      return callParam(updateApplicationRoute, `/api/applications/${applicationId}`, applicationId, token, { method: "PATCH", body: { oauthClientId: clientId } });
    },
  );

  registerMutatingTool(
    server,
    claims,
    "link_existing_oauth_client",
    { title: "Link an existing OAuth client to an application", description: "Points an application at an already-registered GoTrue OAuth client instead of creating a duplicate.", inputSchema: { applicationId: z.string(), oauthClientId: z.string() } },
    async ({ applicationId, oauthClientId }) => callParam(updateApplicationRoute, `/api/applications/${applicationId}`, applicationId, token, { method: "PATCH", body: { oauthClientId } }),
  );

  // --- Mutating tools, confirmation required (Phase 4) ---
  // confirm* must match the resource's *current* identifier, re-fetched here through the same read route before the mutation runs.

  registerMutatingTool(
    server,
    claims,
    "delete_organization",
    {
      title: "Delete an organization",
      description: "Irreversible — cascades every membership/role/invitation/audit-log row. Requires Owner. Pass the organization's exact current slug to confirm.",
      inputSchema: { organizationId: z.string(), confirmSlug: z.string().describe("The organization's current slug, to confirm you have the right one") },
    },
    async ({ organizationId, confirmSlug }) => {
      const currentSlug = await fetchField(listOrganizationsRoute, "/api/organizations", token, (b) => {
        const orgs = asRecord(b)?.organizations;
        const match = Array.isArray(orgs) ? orgs.find((o) => asRecord(o)?.id === organizationId) : null;
        return match ? (asRecord(match)?.slug as string) : null;
      });
      if (!currentSlug) return errorResult(`No se encontró la organización ${organizationId} en las organizaciones del usuario.`);
      if (currentSlug !== confirmSlug) return errorResult(`Confirmación inválida: el slug actual es "${currentSlug}", recibiste "${confirmSlug}". No se eliminó nada.`);
      return callParam(deleteOrganizationRoute, `/api/organizations/${organizationId}`, organizationId, token, { method: "DELETE" });
    },
  );

  registerMutatingTool(
    server,
    claims,
    "remove_user",
    {
      title: "Remove a user from an organization",
      description: "Blocked by the database if this would remove the only active Owner. Pass the member's exact current email to confirm.",
      inputSchema: { organizationId: z.string(), membershipId: z.string(), confirmEmail: z.string() },
    },
    async ({ organizationId, membershipId, confirmEmail }) => {
      const currentEmail = await fetchField(listOrganizationMembersRoute, `/api/organization-members?organizationId=${organizationId}`, token, (b) => {
        const members = asRecord(b)?.members;
        const match = Array.isArray(members) ? members.find((m) => asRecord(m)?.membershipId === membershipId) : null;
        return match ? (asRecord(match)?.email as string) : null;
      });
      if (!currentEmail) return errorResult(`No se encontró la membresía ${membershipId} en esa organización.`);
      if (currentEmail !== confirmEmail) return errorResult(`Confirmación inválida: el correo actual es "${currentEmail}", recibiste "${confirmEmail}". No se quitó a nadie.`);
      return call(removeMemberRoute, `/api/organization-members?membershipId=${membershipId}`, token, { method: "DELETE" });
    },
  );

  registerMutatingTool(
    server,
    claims,
    "suspend_user",
    {
      title: "Suspend a user's access to an organization",
      description: "Blocked by the database if this would suspend the only active Owner. Pass the member's exact current email to confirm.",
      inputSchema: { organizationId: z.string(), membershipId: z.string(), confirmEmail: z.string() },
    },
    async ({ organizationId, membershipId, confirmEmail }) => {
      const currentEmail = await fetchField(listOrganizationMembersRoute, `/api/organization-members?organizationId=${organizationId}`, token, (b) => {
        const members = asRecord(b)?.members;
        const match = Array.isArray(members) ? members.find((m) => asRecord(m)?.membershipId === membershipId) : null;
        return match ? (asRecord(match)?.email as string) : null;
      });
      if (!currentEmail) return errorResult(`No se encontró la membresía ${membershipId} en esa organización.`);
      if (currentEmail !== confirmEmail) return errorResult(`Confirmación inválida: el correo actual es "${currentEmail}", recibiste "${confirmEmail}". No se suspendió a nadie.`);
      return call(updateMemberStatusRoute, `/api/organization-members?membershipId=${membershipId}`, token, { method: "PATCH", body: { status: "suspended" } });
    },
  );

  registerMutatingTool(
    server,
    claims,
    "revoke_invitation",
    {
      title: "Revoke a pending invitation",
      description: "Pass the invitation's exact current email to confirm.",
      inputSchema: { organizationId: z.string(), invitationId: z.string(), confirmEmail: z.string() },
    },
    async ({ organizationId, invitationId, confirmEmail }) => {
      const currentEmail = await fetchField(listInvitationsRoute, `/api/invitations?organizationId=${organizationId}`, token, (b) => {
        const invitations = asRecord(b)?.invitations;
        const match = Array.isArray(invitations) ? invitations.find((i) => asRecord(i)?.id === invitationId) : null;
        return match ? (asRecord(match)?.email as string) : null;
      });
      if (!currentEmail) return errorResult(`No se encontró la invitación ${invitationId} en esa organización.`);
      if (currentEmail !== confirmEmail) return errorResult(`Confirmación inválida: el correo actual es "${currentEmail}", recibiste "${confirmEmail}". No se revocó nada.`);
      return callParam(revokeInvitationRoute, `/api/invitations/${invitationId}`, invitationId, token, { method: "DELETE" });
    },
  );

  registerMutatingTool(
    server,
    claims,
    "delete_custom_role",
    {
      title: "Delete a custom role",
      description: "RLS blocks this for system roles regardless. Pass the role's exact current slug to confirm.",
      inputSchema: { organizationId: z.string(), roleId: z.string(), confirmSlug: z.string() },
    },
    async ({ organizationId, roleId, confirmSlug }) => {
      const currentSlug = await fetchField(listRolesRoute, `/api/roles?organizationId=${organizationId}`, token, (b) => {
        const roles = asRecord(b)?.roles;
        const match = Array.isArray(roles) ? roles.find((r) => asRecord(r)?.id === roleId) : null;
        return match ? (asRecord(match)?.slug as string) : null;
      });
      if (!currentSlug) return errorResult(`No se encontró el rol ${roleId} en esa organización.`);
      if (currentSlug !== confirmSlug) return errorResult(`Confirmación inválida: el slug actual es "${currentSlug}", recibiste "${confirmSlug}". No se eliminó nada.`);
      return callParam(deleteRoleRoute, `/api/roles/${roleId}`, roleId, token, { method: "DELETE" });
    },
  );

  registerMutatingTool(
    server,
    claims,
    "revoke_role_permission",
    {
      title: "Revoke a permission from a role",
      description: "Pass the permission's exact current key (e.g. facturacion.facturas.eliminar) to confirm.",
      inputSchema: { roleId: z.string(), permissionId: z.string(), confirmKey: z.string() },
    },
    async ({ roleId, permissionId, confirmKey }) => {
      const currentKey = await fetchField(listPermissionsRoute, "/api/permissions", token, (b) => {
        const permissions = asRecord(b)?.permissions;
        const match = Array.isArray(permissions) ? permissions.find((p) => asRecord(p)?.id === permissionId) : null;
        return match ? (asRecord(match)?.key as string) : null;
      });
      if (!currentKey) return errorResult(`No se encontró el permiso ${permissionId}.`);
      if (currentKey !== confirmKey) return errorResult(`Confirmación inválida: la clave actual es "${currentKey}", recibiste "${confirmKey}". No se revocó nada.`);
      return callParam(revokeRolePermissionRoute, `/api/roles/${roleId}/permissions?permissionId=${permissionId}`, roleId, token, { method: "DELETE" });
    },
  );

  registerMutatingTool(
    server,
    claims,
    "disable_application",
    {
      title: "Disable an application for an organization",
      description: "Pass the application's exact current slug to confirm.",
      inputSchema: { organizationId: z.string(), applicationId: z.string(), confirmSlug: z.string() },
    },
    async ({ organizationId, applicationId, confirmSlug }) => {
      const currentSlug = await fetchField(listApplicationsRoute, "/api/applications", token, (b) => {
        const applications = asRecord(b)?.applications;
        const match = Array.isArray(applications) ? applications.find((a) => asRecord(a)?.id === applicationId) : null;
        return match ? (asRecord(match)?.slug as string) : null;
      });
      if (!currentSlug) return errorResult(`No se encontró la aplicación ${applicationId}.`);
      if (currentSlug !== confirmSlug) return errorResult(`Confirmación inválida: el slug actual es "${currentSlug}", recibiste "${confirmSlug}". No se deshabilitó nada.`);
      return callParam(disableApplicationRoute, `/api/organizations/${organizationId}/applications?applicationId=${applicationId}`, organizationId, token, { method: "DELETE" });
    },
  );

  registerMutatingTool(
    server,
    claims,
    "claim_application_ownership",
    {
      title: "Claim ownership of an unowned application",
      description: "Platform-admin only. Cannot be undone or transferred afterward. Pass the application's exact current slug to confirm.",
      inputSchema: { organizationId: z.string(), applicationId: z.string(), confirmSlug: z.string() },
    },
    async ({ organizationId, applicationId, confirmSlug }) => {
      const currentSlug = await fetchField(listApplicationsRoute, "/api/applications", token, (b) => {
        const applications = asRecord(b)?.applications;
        const match = Array.isArray(applications) ? applications.find((a) => asRecord(a)?.id === applicationId) : null;
        return match ? (asRecord(match)?.slug as string) : null;
      });
      if (!currentSlug) return errorResult(`No se encontró la aplicación ${applicationId}.`);
      if (currentSlug !== confirmSlug) return errorResult(`Confirmación inválida: el slug actual es "${currentSlug}", recibiste "${confirmSlug}". No se reclamó nada.`);
      return call(claimApplicationRoute, "/api/applications/claim", token, { method: "POST", body: { applicationId, organizationId } });
    },
  );

  server.registerTool(
    "list_application_keys",
    {
      title: "List an application's API keys",
      description: "Every key (active or revoked) for an application — name, which organization it's scoped to, last used, expiry, revocation. Never returns the secret itself, only shown once at creation.",
      inputSchema: { applicationId: z.string() },
    },
    async ({ applicationId }) => callParam(listApplicationKeysRoute, `/api/applications/${applicationId}/keys`, applicationId, token),
  );

  registerMutatingTool(
    server,
    claims,
    "create_application_key",
    {
      title: "Create an application API key",
      description: "Mints a new named key scoped to one organization (must already have this application enabled) — a caller with this key can sync the app's permission catalog and manage that organization's members via the application API. Returns the plaintext key once; it's never retrievable again.",
      inputSchema: {
        applicationId: z.string(),
        organizationId: z.string().describe("Which organization this key acts on behalf of — must have the application enabled"),
        name: z.string().describe("A descriptive label, e.g. \"Zapier integration\" or \"staging backend\""),
        expiresAt: z.string().optional().describe("ISO timestamp — omit for a key that never expires"),
      },
    },
    async ({ applicationId, organizationId, name, expiresAt }) =>
      callParam(createApplicationKeyRoute, `/api/applications/${applicationId}/keys`, applicationId, token, {
        method: "POST",
        body: { organizationId, name, expiresAt },
      }),
  );

  registerMutatingTool(
    server,
    claims,
    "revoke_application_key",
    {
      title: "Revoke an application API key",
      description: "Immediately stops that one key from authenticating — every other key for the application keeps working. Pass the key's exact current name to confirm.",
      inputSchema: { applicationId: z.string(), keyId: z.string(), confirmName: z.string() },
    },
    async ({ applicationId, keyId, confirmName }) => {
      const currentName = await fetchFieldParam(listApplicationKeysRoute, `/api/applications/${applicationId}/keys`, applicationId, token, (b) => {
        const keys = asRecord(b)?.keys;
        const match = Array.isArray(keys) ? keys.find((k) => asRecord(k)?.id === keyId) : null;
        return match ? (asRecord(match)?.name as string) : null;
      });
      if (!currentName) return errorResult(`No se encontró la clave ${keyId} en la aplicación ${applicationId}.`);
      if (currentName !== confirmName) return errorResult(`Confirmación inválida: el nombre actual es "${currentName}", recibiste "${confirmName}". No se revocó ninguna clave.`);
      return toResult(
        await revokeApplicationKeyRoute(internalRequest(`/api/applications/${applicationId}/keys/${keyId}`, token, { method: "DELETE" }), {
          params: Promise.resolve({ id: applicationId, keyId }),
        }),
      );
    },
  );

  registerMutatingTool(
    server,
    claims,
    "grant_platform_admin",
    {
      title: "Grant platform-admin status",
      description: "Cross-tenant authority over every organization in this install — the highest-risk action this server exposes. Confirmation is required here even though admin-panel's own UI doesn't gate it, as a deliberate v1 policy choice. Pass the exact email again to confirm.",
      inputSchema: { email: z.string(), confirmEmail: z.string() },
    },
    async ({ email, confirmEmail }) => {
      if (email !== confirmEmail) return errorResult(`Confirmación inválida: "${email}" y "${confirmEmail}" no coinciden. No se otorgó nada.`);
      return call(grantPlatformAdminRoute, "/api/platform-admins", token, { method: "POST", body: { email } });
    },
  );

  registerMutatingTool(
    server,
    claims,
    "revoke_platform_admin",
    {
      title: "Revoke platform-admin status",
      description: "Blocked by the database if this would remove the last platform admin. Pass the user's exact current email to confirm.",
      inputSchema: { userId: z.string(), confirmEmail: z.string() },
    },
    async ({ userId, confirmEmail }) => {
      const currentEmail = await fetchField(listPlatformAdminsRoute, "/api/platform-admins", token, (b) => {
        const admins = asRecord(b)?.admins;
        const match = Array.isArray(admins) ? admins.find((a) => asRecord(a)?.userId === userId) : null;
        return match ? (asRecord(match)?.email as string) : null;
      });
      if (!currentEmail) return errorResult(`No se encontró a ${userId} en la lista de platform admins.`);
      if (currentEmail !== confirmEmail) return errorResult(`Confirmación inválida: el correo actual es "${currentEmail}", recibiste "${confirmEmail}". No se revocó nada.`);
      return call(revokePlatformAdminRoute, `/api/platform-admins?userId=${userId}`, token, { method: "DELETE" });
    },
  );

  return server;
}

async function handle(request: Request): Promise<Response> {
  let token: string;
  let claims: KontroliaTokenClaims;
  try {
    const verified = await verifyRequest(request, { supabaseUrl: process.env.SUPABASE_URL! });
    claims = verified.claims;
    token = request.headers.get("authorization")!.slice("Bearer ".length);
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response("Unauthorized", { status: 401 });
  }

  const server = buildServer(token, claims);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request, { authInfo: { token, clientId: claims.sub, scopes: [] } });
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
