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

const { POST, DELETE } = await import("../organization-members/roles/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

const BASE_URL = "https://auth.example.com/api/organization-members/roles";

beforeEach(() => {
  createClientMock.mockReset();
  logErrorMock.mockReset();
});

describe("POST /api/organization-members/roles (grant)", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await POST(new Request(BASE_URL, { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when membershipId or roleId is missing", async () => {
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ membershipId: "mem-1" }) }));
    expect(response.status).toBe(400);
  });

  it("grants the role", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ membership_roles: [{ error: null }] }));
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ membershipId: "mem-1", roleId: "role-1" }) }),
    );
    expect(response.status).toBe(201);
  });

  it("surfaces the one-role-per-application trigger's error as 400", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({ membership_roles: [{ error: { message: "Este usuario ya tiene un rol asignado para esta aplicación." } }] }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ membershipId: "mem-1", roleId: "role-2" }) }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/ya tiene un rol asignado/);
  });
});

describe("DELETE /api/organization-members/roles (revoke)", () => {
  it("returns 400 when membershipId or roleId is missing", async () => {
    const response = await DELETE(requestWithAuth(`${BASE_URL}?membershipId=mem-1`, { method: "DELETE" }));
    expect(response.status).toBe(400);
  });

  it("revokes the role", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ membership_roles: [{ error: null }] }));
    const response = await DELETE(requestWithAuth(`${BASE_URL}?membershipId=mem-1&roleId=role-1`, { method: "DELETE" }));
    expect(response.status).toBe(204);
  });

  it("returns 500 and logs when the delete fails", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ membership_roles: [{ error: { message: "delete failed" } }] }));
    const response = await DELETE(requestWithAuth(`${BASE_URL}?membershipId=mem-1&roleId=role-1`, { method: "DELETE" }));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("DELETE /api/organization-members/roles", { message: "delete failed" }, { membershipId: "mem-1", roleId: "role-1" });
  });
});
