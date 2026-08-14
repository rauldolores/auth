import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAdminClient } from "./test-helpers";

const verifyRequestMock = vi.fn();
vi.mock("@kontrolia/auth/server", () => ({
  verifyRequest: (...args: unknown[]) => verifyRequestMock(...args),
}));

const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const logErrorMock = vi.fn();
const logSecurityEventMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
  logSecurityEvent: (...args: unknown[]) => logSecurityEventMock(...args),
}));

const { GET, PATCH } = await import("../instance-settings/route");

const BASE_URL = "https://auth.example.com/api/instance-settings";
const ROW = {
  registration_enabled: true,
  theme: "system",
  button_color: null,
  logo_url: null,
  mcp_oauth_client_id: null,
};

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

function claimsFor(userId: string, isPlatformAdmin: boolean) {
  return { claims: { sub: userId, is_platform_admin: isPlatformAdmin } };
}

beforeEach(() => {
  verifyRequestMock.mockReset();
  createSupabaseAdminClientMock.mockReset();
  logErrorMock.mockReset();
  logSecurityEventMock.mockReset();
  createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ instance_settings: [{ data: ROW, error: null }] }));
});

describe("GET /api/instance-settings", () => {
  it("is public — no Authorization header needed — and returns the settings row", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      registrationEnabled: true,
      theme: "system",
      buttonColor: null,
      logoUrl: null,
      mcpOauthClientId: null,
    });
    expect(verifyRequestMock).not.toHaveBeenCalled();
  });

  it("falls back to defaults when no row exists yet", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ instance_settings: [{ data: null, error: null }] }));
    const response = await GET();
    expect(await response.json()).toEqual({
      registrationEnabled: true,
      theme: "system",
      buttonColor: null,
      logoUrl: null,
      mcpOauthClientId: null,
    });
  });
});

describe("PATCH /api/instance-settings — auth gate", () => {
  it("returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await PATCH(requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ theme: "dark" }) }));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("user-1", false));
    const response = await PATCH(requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ theme: "dark" }) }));
    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/instance-settings — validation", () => {
  beforeEach(() => verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true)));

  it("rejects an invalid theme", async () => {
    const response = await PATCH(requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ theme: "purple" }) }));
    expect(response.status).toBe(400);
  });

  it("rejects a malformed hex color", async () => {
    const response = await PATCH(
      requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ buttonColor: "not-a-color" }) }),
    );
    expect(response.status).toBe(400);
  });

  it("accepts buttonColor: null to clear the override", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ instance_settings: [{ error: null }, { data: ROW, error: null }] }),
    );
    const response = await PATCH(
      requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ buttonColor: null }) }),
    );
    expect(response.status).toBe(200);
  });

  it("rejects a non-boolean registrationEnabled", async () => {
    const response = await PATCH(
      requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ registrationEnabled: "yes" }) }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when the body has nothing to update", async () => {
    const response = await PATCH(requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/instance-settings — happy path", () => {
  it("updates the row, logs the mutation, and returns the fresh settings", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    const updatedRow = { ...ROW, theme: "dark", registration_enabled: false };
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ instance_settings: [{ error: null }, { data: updatedRow, error: null }] }),
    );

    const response = await PATCH(
      requestWithAuth(BASE_URL, {
        method: "PATCH",
        body: JSON.stringify({ theme: "dark", registrationEnabled: false }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      registrationEnabled: false,
      theme: "dark",
      buttonColor: null,
      logoUrl: null,
      mcpOauthClientId: null,
    });
    expect(logSecurityEventMock).toHaveBeenCalledWith(
      "instance-settings: update",
      expect.objectContaining({ userId: "admin-1" }),
    );
  });

  it("returns 500 and logs when the update itself fails", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ instance_settings: [{ error: { message: "boom" } }] }),
    );

    const response = await PATCH(requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ theme: "dark" }) }));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("PATCH /api/instance-settings", { message: "boom" }, { userId: "admin-1" });
  });
});
