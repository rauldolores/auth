import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const verifyRequestMock = vi.fn();
vi.mock("@kontrolia/auth/server", () => ({
  verifyRequest: (...args: unknown[]) => verifyRequestMock(...args),
}));

const logSecurityEventMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logSecurityEvent: (...args: unknown[]) => logSecurityEventMock(...args),
}));

const getConnectionStatusMock = vi.fn();
const disconnectConnectionMock = vi.fn();
const isOauthConfiguredMock = vi.fn();
vi.mock("@/lib/supabase-oauth-connection", () => ({
  getConnectionStatus: (...args: unknown[]) => getConnectionStatusMock(...args),
  disconnectConnection: (...args: unknown[]) => disconnectConnectionMock(...args),
  isOauthConfigured: (...args: unknown[]) => isOauthConfiguredMock(...args),
}));

const { GET, DELETE } = await import("../supabase-connection/route");

const BASE_URL = "https://auth.example.com/api/supabase-connection";

function requestWithAuth(init?: RequestInit): Request {
  return new Request(BASE_URL, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

beforeEach(() => {
  verifyRequestMock.mockReset();
  logSecurityEventMock.mockReset();
  getConnectionStatusMock.mockReset();
  disconnectConnectionMock.mockReset();
  isOauthConfiguredMock.mockReset();
  resetRateLimitsForTests();
  vi.stubEnv("SUPABASE_OAUTH_CLIENT_ID", "kontrolia-client-id");
});

describe("platform-admin gate", () => {
  it("GET returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await GET(requestWithAuth());
    expect(response.status).toBe(401);
  });

  it("GET returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false } });
    const response = await GET(requestWithAuth());
    expect(response.status).toBe(403);
  });
});

describe("GET /api/supabase-connection", () => {
  it("reports not configured when SUPABASE_OAUTH_CLIENT_ID/SECRET aren't set", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    isOauthConfiguredMock.mockReturnValue(false);

    const response = await GET(requestWithAuth());
    const body = await response.json();

    expect(body).toEqual({ oauthConfigured: false, connected: false, connectedAt: null, clientId: null });
    expect(getConnectionStatusMock).not.toHaveBeenCalled();
  });

  it("reports not connected when configured but no connection exists yet", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    isOauthConfiguredMock.mockReturnValue(true);
    getConnectionStatusMock.mockResolvedValue(null);

    const response = await GET(requestWithAuth());
    const body = await response.json();

    expect(body).toEqual({ oauthConfigured: true, connected: false, connectedAt: null, clientId: "kontrolia-client-id" });
  });

  it("reports connected with the connection timestamp", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    isOauthConfiguredMock.mockReturnValue(true);
    getConnectionStatusMock.mockResolvedValue({
      accessToken: "should-never-appear",
      expiresAt: "2026-01-01T01:00:00.000Z",
      connectedAt: "2026-01-01T00:00:00.000Z",
      connectedBy: "user-1",
    });

    const response = await GET(requestWithAuth());
    const body = await response.json();

    expect(body.connected).toBe(true);
    expect(body.connectedAt).toBe("2026-01-01T00:00:00.000Z");
    // The status route must never leak the raw access token.
    expect(JSON.stringify(body)).not.toContain("should-never-appear");
  });
});

describe("DELETE /api/supabase-connection", () => {
  it("disconnects and logs a security event", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    disconnectConnectionMock.mockResolvedValue({ ok: true });

    const response = await DELETE(requestWithAuth({ method: "DELETE" }));

    expect(response.status).toBe(204);
    expect(logSecurityEventMock).toHaveBeenCalledWith("supabase-connection: disconnected", {});
  });

  it("returns 500 when the delete fails", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    disconnectConnectionMock.mockResolvedValue({ ok: false, error: "db error" });

    const response = await DELETE(requestWithAuth({ method: "DELETE" }));
    expect(response.status).toBe(500);
  });
});
