import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAdminClient } from "./test-helpers";

// This route authenticates via verifyRequest() (a bearer JWT verified against
// the project's JWKS), unlike organization-members' raw scoped-client
// approach. Mock the SDK boundary directly rather than standing up a real
// JWKS server here — that machinery is already covered by
// packages/auth-sdk/src/__tests__/server.test.ts.
const verifyRequestMock = vi.fn();
vi.mock("@kontrolia/auth/server", () => ({
  verifyRequest: (...args: unknown[]) => verifyRequestMock(...args),
}));

const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const logErrorMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

const fetchMock = vi.fn();

const { GET, POST, DELETE } = await import("../platform-admins/route");

const BASE_URL = "https://auth.example.com/api/platform-admins";

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
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  createSupabaseAdminClientMock.mockReturnValue(makeAdminClient());
});

describe("authorizePlatformAdmin gate (shared by GET/POST/DELETE)", () => {
  it("GET returns 401 when verifyRequest rejects (unauthenticated / bad token)", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "No autenticado" });
  });

  it("GET returns 403 when the verified caller is not a platform admin", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("user-1", false));
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Se requiere ser platform admin" });
  });

  it("POST returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ email: "a@b.com" }) }));
    expect(response.status).toBe(401);
  });

  it("POST returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("user-1", false));
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ email: "a@b.com" }) }));
    expect(response.status).toBe(403);
  });

  it("DELETE returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await DELETE(requestWithAuth(`${BASE_URL}?userId=user-2`, { method: "DELETE" }));
    expect(response.status).toBe(401);
  });

  it("DELETE returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("user-1", false));
    const response = await DELETE(requestWithAuth(`${BASE_URL}?userId=user-2`, { method: "DELETE" }));
    expect(response.status).toBe(403);
  });
});

describe("GET /api/platform-admins", () => {
  it("returns the admin list with emails resolved", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("user-1", true));
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient(
        { platform_admins: [{ data: [{ user_id: "user-1", granted_at: "2026-01-01T00:00:00Z" }], error: null }] },
        { data: { users: [{ id: "user-1", email: "admin@example.com" }] }, error: null },
      ),
    );

    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      admins: [{ userId: "user-1", email: "admin@example.com", grantedAt: "2026-01-01T00:00:00Z" }],
      hasMore: false,
    });
  });

  it("returns 500 and logs when the query errors", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("user-1", true));
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ platform_admins: [{ data: null, error: { message: "boom" } }] }),
    );

    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("GET /api/platform-admins", { message: "boom" });
  });
});

describe("POST /api/platform-admins", () => {
  it("returns 400 when email is missing", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });

  it("returns 404 when no user exists with that email", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ users: [] }), { status: 200 }));

    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ email: "nobody@example.com" }) }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "No hay ningún usuario registrado con ese correo." });
  });

  it("grants the role by email and returns 201", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ users: [{ id: "user-2", email: "new-admin@example.com" }] }), { status: 200 }),
    );
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ platform_admins: [{ error: null }] }));

    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ email: "New-Admin@Example.com" }) }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ userId: "user-2", email: "new-admin@example.com" });
  });

  it("returns 500 and logs when the upsert fails", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ users: [{ id: "user-2", email: "new-admin@example.com" }] }), { status: 200 }),
    );
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ platform_admins: [{ error: { message: "upsert failed" } }] }),
    );

    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ email: "new-admin@example.com" }) }));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("POST /api/platform-admins", { message: "upsert failed" }, { userId: "user-2" });
  });
});

describe("DELETE /api/platform-admins (last-platform-admin protection)", () => {
  it("returns 400 when userId is missing", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }));
    expect(response.status).toBe(400);
  });

  it("blocks removing the last platform admin", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ platform_admins: [{ count: 1 }] }));

    const response = await DELETE(requestWithAuth(`${BASE_URL}?userId=admin-1`, { method: "DELETE" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "No puedes quitar al último platform admin — la instalación se quedaría sin ninguno.",
    });
  });

  it("allows removing a platform admin when at least two remain", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ platform_admins: [{ count: 2 }, { error: null }] }),
    );

    const response = await DELETE(requestWithAuth(`${BASE_URL}?userId=admin-2`, { method: "DELETE" }));
    expect(response.status).toBe(204);
  });

  it("returns 500 and logs when the delete itself fails", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ platform_admins: [{ count: 2 }, { error: { message: "delete failed" } }] }),
    );

    const response = await DELETE(requestWithAuth(`${BASE_URL}?userId=admin-2`, { method: "DELETE" }));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("DELETE /api/platform-admins", { message: "delete failed" }, { userId: "admin-2" });
  });
});
