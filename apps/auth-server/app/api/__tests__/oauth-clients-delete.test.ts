import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { makeAdminClient } from "./test-helpers";

// Covers the DELETE route's two guardrails, which don't exist in GoTrue
// itself: the reserved MCP client (instance_settings.mcp_oauth_client_id)
// can never be deleted, and a client currently linked to an application
// (applications.oauth_client_id) must be unlinked first — both checked
// before the request is ever forwarded to GoTrue.
const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const verifyRequestMock = vi.fn();
vi.mock("@kontrolia/auth/server", () => ({
  verifyRequest: (...args: unknown[]) => verifyRequestMock(...args),
}));

const logErrorMock = vi.fn();
const logSecurityEventMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
  logSecurityEvent: (...args: unknown[]) => logSecurityEventMock(...args),
}));

const fetchMock = vi.fn();

const { DELETE } = await import("../oauth-clients/route");

const BASE_URL = "https://auth.example.com/api/oauth-clients";

function requestWithAuth(clientId: string): Request {
  return new Request(`${BASE_URL}?clientId=${clientId}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer test-token" },
  });
}

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
  verifyRequestMock.mockReset();
  logErrorMock.mockReset();
  logSecurityEventMock.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  resetRateLimitsForTests();
});

describe("DELETE /api/oauth-clients", () => {
  it("returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await DELETE(requestWithAuth("client-1"));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false } });
    const response = await DELETE(requestWithAuth("client-1"));
    expect(response.status).toBe(403);
  });

  it("returns 400 when clientId query param is missing", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const response = await DELETE(new Request(BASE_URL, { method: "DELETE", headers: { Authorization: "Bearer test-token" } }));
    expect(response.status).toBe(400);
  });

  it("returns 403 and never calls GoTrue when the target is the reserved MCP client", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        instance_settings: [{ data: { mcp_oauth_client_id: "mcp-client-1" }, error: null }],
        applications: [{ data: null, error: null }],
      }),
    );
    const response = await DELETE(requestWithAuth("mcp-client-1"));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(/agentes de IA/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 409 and never calls GoTrue when the target is linked to an application", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        instance_settings: [{ data: { mcp_oauth_client_id: "mcp-client-1" }, error: null }],
        applications: [{ data: { name: "Facturación" }, error: null }],
      }),
    );
    const response = await DELETE(requestWithAuth("client-linked"));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/Facturación/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes an unlinked, non-reserved client via GoTrue", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        instance_settings: [{ data: { mcp_oauth_client_id: "mcp-client-1" }, error: null }],
        applications: [{ data: null, error: null }],
      }),
    );
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const response = await DELETE(requestWithAuth("client-unlinked"));
    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/admin/oauth/clients/client-unlinked"),
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(logSecurityEventMock).toHaveBeenCalledWith("oauth-clients: deleted", { clientId: "client-unlinked" });
  });

  it("logs and forwards GoTrue's own error when the delete itself fails", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        instance_settings: [{ data: { mcp_oauth_client_id: "mcp-client-1" }, error: null }],
        applications: [{ data: null, error: null }],
      }),
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 404, error_code: "oauth_client_not_found", msg: "OAuth client not found" }), {
        status: 404,
      }),
    );
    const response = await DELETE(requestWithAuth("client-gone"));
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("OAuth client not found");
    expect(logErrorMock).toHaveBeenCalled();
  });
});
