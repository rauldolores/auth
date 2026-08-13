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

const { DELETE } = await import("../roles/[id]/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const BASE_URL = "https://auth.example.com/api/roles/role-1";

beforeEach(() => {
  createClientMock.mockReset();
  logErrorMock.mockReset();
});

describe("DELETE /api/roles/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await DELETE(new Request(BASE_URL, { method: "DELETE" }), paramsFor("role-1"));
    expect(response.status).toBe(401);
  });

  it("deletes the role", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ roles: [{ error: null }] }));
    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }), paramsFor("role-1"));
    expect(response.status).toBe(204);
  });

  it("returns 500 and logs when the delete fails (e.g. RLS blocks a system role)", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ roles: [{ error: { message: "delete failed" } }] }));
    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }), paramsFor("role-1"));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("DELETE /api/roles/[id]", { message: "delete failed" }, { id: "role-1" });
  });
});
