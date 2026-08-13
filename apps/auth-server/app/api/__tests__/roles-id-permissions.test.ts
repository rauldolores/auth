import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSchemaClient } from "./test-helpers";

const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const logErrorMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

const { GET, POST, DELETE } = await import("../roles/[id]/permissions/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const BASE_URL = "https://auth.example.com/api/roles/role-1/permissions";

beforeEach(() => {
  createClientMock.mockReset();
  logErrorMock.mockReset();
});

describe("GET /api/roles/[id]/permissions", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request(BASE_URL), paramsFor("role-1"));
    expect(response.status).toBe(401);
  });

  it("lists granted permission ids", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({ role_permissions: [{ data: [{ permission_id: "perm-1" }, { permission_id: "perm-2" }], error: null }] }),
    );
    const response = await GET(requestWithAuth(BASE_URL), paramsFor("role-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ permissionIds: ["perm-1", "perm-2"] });
  });
});

describe("POST /api/roles/[id]/permissions (grant)", () => {
  it("returns 400 when permissionId is missing", async () => {
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: "{}" }), paramsFor("role-1"));
    expect(response.status).toBe(400);
  });

  it("grants the permission", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ role_permissions: [{ error: null }] }));
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ permissionId: "perm-1" }) }),
      paramsFor("role-1"),
    );
    expect(response.status).toBe(201);
  });

  it("surfaces the RLS/insert error as 400 (e.g. a grants_all_permissions role)", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({ role_permissions: [{ error: { message: "new row violates row-level security policy" } }] }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ permissionId: "perm-1" }) }),
      paramsFor("role-1"),
    );
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/roles/[id]/permissions (revoke)", () => {
  it("returns 400 when permissionId is missing", async () => {
    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }), paramsFor("role-1"));
    expect(response.status).toBe(400);
  });

  it("revokes the permission", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ role_permissions: [{ error: null }] }));
    const response = await DELETE(
      requestWithAuth(`${BASE_URL}?permissionId=perm-1`, { method: "DELETE" }),
      paramsFor("role-1"),
    );
    expect(response.status).toBe(204);
  });
});
