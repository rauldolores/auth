import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { makeAdminClient } from "./test-helpers";

// Covers the idempotent bootstrap: creates the reserved MCP OAuth client
// exactly once (persisting its client_id on instance_settings), and every
// call after that is a pure read — no second GoTrue client ever gets
// created, no matter how many times admin-panel's page effect fires it.
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

const { POST } = await import("../oauth-clients/mcp-bootstrap/route");

const BASE_URL = "https://auth.example.com/api/oauth-clients/mcp-bootstrap";

function requestWithAuth(): Request {
  return new Request(BASE_URL, { method: "POST", headers: { Authorization: "Bearer test-token" } });
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

describe("POST /api/oauth-clients/mcp-bootstrap", () => {
  it("returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await POST(requestWithAuth());
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false } });
    const response = await POST(requestWithAuth());
    expect(response.status).toBe(403);
  });

  it("is a no-op read when instance_settings already has a client_id", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ instance_settings: [{ data: { mcp_oauth_client_id: "existing-client" }, error: null }] }),
    );
    const response = await POST(requestWithAuth());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ clientId: "existing-client" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates the client via GoTrue and persists its client_id when none exists yet", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        instance_settings: [
          { data: { mcp_oauth_client_id: null }, error: null },
          { data: null, error: null },
        ],
      }),
    );
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ client_id: "new-mcp-client" }), { status: 201 }));
    const response = await POST(requestWithAuth());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ clientId: "new-mcp-client" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/admin/oauth/clients"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("MCP"),
      }),
    );
    expect(logSecurityEventMock).toHaveBeenCalledWith("oauth-clients: mcp client bootstrapped", { clientId: "new-mcp-client" });
  });

  it("returns 502 without persisting when GoTrue creates the client but omits client_id", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ instance_settings: [{ data: { mcp_oauth_client_id: null }, error: null }] }),
    );
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
    const response = await POST(requestWithAuth());
    expect(response.status).toBe(502);
  });

  it("returns 500 and logs when persisting the client_id fails", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        instance_settings: [
          { data: { mcp_oauth_client_id: null }, error: null },
          { data: null, error: { message: "update failed" } },
        ],
      }),
    );
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ client_id: "new-mcp-client" }), { status: 201 }));
    const response = await POST(requestWithAuth());
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith(
      "POST /api/oauth-clients/mcp-bootstrap (persist)",
      { message: "update failed" },
      { clientId: "new-mcp-client" },
    );
  });
});
