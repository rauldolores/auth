import { getUserFromClaims, verifyRequest } from "@kontrolia/auth/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { KontroliaTokenClaims } from "@kontrolia/shared";
import { GET as listApplicationsRoute } from "@/app/api/applications/route";
import { GET as queryAuditLogRoute } from "@/app/api/audit-logs/route";
import { GET as listInvitationsRoute } from "@/app/api/invitations/route";
import { GET as listOrganizationMembersRoute } from "@/app/api/organization-members/route";
import { GET as listOrganizationApplicationsRoute } from "@/app/api/organizations/[id]/applications/route";
import { GET as listOrganizationsRoute } from "@/app/api/organizations/route";
import { GET as listPermissionsRoute } from "@/app/api/permissions/route";
import { GET as listPlatformAdminsRoute } from "@/app/api/platform-admins/route";
import { GET as getRolePermissionsRoute } from "@/app/api/roles/[id]/permissions/route";
import { GET as listRolesRoute } from "@/app/api/roles/route";
import { z } from "zod";

/**
 * Read-only MCP tool surface. Every tool below calls the exact same Route
 * Handler admin-panel/external callers already use (constructing a
 * synthetic same-process Request carrying the caller's real bearer token) —
 * no parallel query logic, no third fork of business logic. Whatever RLS
 * policy/platform-admin check already gates a route gates its tool
 * identically, since it's literally the same function running.
 *
 * Auth: the MCP client authenticates via KontrolIA Auth's own OAuth 2.1
 * flow (see /.well-known/oauth-protected-resource) — every tool call runs
 * with that real user's actual RLS-scoped permissions, never a separate
 * all-powerful credential.
 *
 * Stateless mode (sessionIdGenerator: undefined): Vercel gives each
 * invocation a fresh instance, so a stateful transport session would
 * silently break in production the same way this app's in-memory rate
 * limiter already does — see apps/auth-server/lib/rate-limit.ts.
 */

type RouteResult = { content: [{ type: "text"; text: string }]; isError?: true };

function internalRequest(path: string, token: string): Request {
  return new Request(`http://mcp-internal${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

async function toResult(response: Response): Promise<RouteResult> {
  const body = await response.json().catch(() => null);
  const text = JSON.stringify(body ?? { error: response.statusText });
  return response.ok ? { content: [{ type: "text", text }] } : { content: [{ type: "text", text }], isError: true };
}

async function callRoute(handler: (request: Request) => Promise<Response>, path: string, token: string): Promise<RouteResult> {
  return toResult(await handler(internalRequest(path, token)));
}

async function callParamRoute(
  handler: (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>,
  path: string,
  id: string,
  token: string,
): Promise<RouteResult> {
  return toResult(await handler(internalRequest(path, token), { params: Promise.resolve({ id }) }));
}

function buildServer(token: string, claims: KontroliaTokenClaims): McpServer {
  const server = new McpServer({ name: "kontrolia-auth", version: "1.0.0" });

  server.registerTool(
    "get_current_user",
    { title: "Get current user", description: "The authenticated user's own profile, roles, and permissions in their active organization." },
    async () => ({ content: [{ type: "text", text: JSON.stringify(getUserFromClaims(claims)) }] }),
  );

  server.registerTool(
    "list_organizations",
    { title: "List organizations", description: "Organizations the authenticated user belongs to." },
    async () => callRoute(listOrganizationsRoute, "/api/organizations", token),
  );

  server.registerTool(
    "list_organization_members",
    {
      title: "List organization members",
      description: "Members of an organization, with their roles.",
      inputSchema: { organizationId: z.string().describe("Organization id") },
    },
    async ({ organizationId }) => callRoute(listOrganizationMembersRoute, `/api/organization-members?organizationId=${organizationId}`, token),
  );

  server.registerTool(
    "list_applications",
    { title: "List applications", description: "The full application catalog registered in this install." },
    async () => callRoute(listApplicationsRoute, "/api/applications", token),
  );

  server.registerTool(
    "list_organization_applications",
    {
      title: "List an organization's applications",
      description: "Applications a given organization can actually launch (enabled + the caller has access to).",
      inputSchema: { organizationId: z.string().describe("Organization id") },
    },
    async ({ organizationId }) => callParamRoute(listOrganizationApplicationsRoute, `/api/organizations/${organizationId}/applications`, organizationId, token),
  );

  server.registerTool(
    "list_permissions",
    {
      title: "List permissions",
      description: "Permissions declared by applications' own sync catalogs — read-only, permissions are never created by hand.",
      inputSchema: { applicationId: z.string().optional().describe("Filter to one application") },
    },
    async ({ applicationId }) => callRoute(listPermissionsRoute, applicationId ? `/api/permissions?applicationId=${applicationId}` : "/api/permissions", token),
  );

  server.registerTool(
    "list_roles",
    {
      title: "List roles",
      description: "System roles plus custom app-scoped roles for an organization.",
      inputSchema: { organizationId: z.string().describe("Organization id") },
    },
    async ({ organizationId }) => callRoute(listRolesRoute, `/api/roles?organizationId=${organizationId}`, token),
  );

  server.registerTool(
    "get_role_permissions",
    {
      title: "Get a role's granted permissions",
      description: "The permission ids currently granted to one role.",
      inputSchema: { roleId: z.string().describe("Role id") },
    },
    async ({ roleId }) => callParamRoute(getRolePermissionsRoute, `/api/roles/${roleId}/permissions`, roleId, token),
  );

  server.registerTool(
    "list_invitations",
    {
      title: "List invitations",
      description: "Pending and past invitations for an organization.",
      inputSchema: { organizationId: z.string().describe("Organization id") },
    },
    async ({ organizationId }) => callRoute(listInvitationsRoute, `/api/invitations?organizationId=${organizationId}`, token),
  );

  server.registerTool(
    "list_platform_admins",
    { title: "List platform admins", description: "Users with cross-tenant platform-admin status. Requires the caller to be a platform admin." },
    async () => callRoute(listPlatformAdminsRoute, "/api/platform-admins", token),
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
      return callRoute(queryAuditLogRoute, `/api/audit-logs?${params.toString()}`, token);
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
