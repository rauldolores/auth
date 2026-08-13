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

const { DELETE, PATCH } = await import("../invitations/[id]/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const BASE_URL = "https://auth.example.com/api/invitations/inv-1";

beforeEach(() => {
  createClientMock.mockReset();
  logErrorMock.mockReset();
});

describe("DELETE /api/invitations/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await DELETE(new Request(BASE_URL, { method: "DELETE" }), paramsFor("inv-1"));
    expect(response.status).toBe(401);
  });

  it("revokes the invitation", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ invitations: [{ error: null }] }));
    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }), paramsFor("inv-1"));
    expect(response.status).toBe(204);
  });

  it("returns 500 and logs when the delete fails", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ invitations: [{ error: { message: "delete failed" } }] }));
    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }), paramsFor("inv-1"));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("DELETE /api/invitations/[id]", { message: "delete failed" }, { id: "inv-1" });
  });
});

describe("PATCH /api/invitations/[id] (resend)", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await PATCH(new Request(BASE_URL, { method: "PATCH" }), paramsFor("inv-1"));
    expect(response.status).toBe(401);
  });

  it("regenerates the token and expiry", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({ invitations: [{ data: { token: "new-token", expires_at: "2026-02-08T00:00:00Z" }, error: null }] }),
    );
    const response = await PATCH(requestWithAuth(BASE_URL, { method: "PATCH" }), paramsFor("inv-1"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invitation.token).toBe("new-token");
  });

  it("returns 500 and logs when the update fails", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ invitations: [{ data: null, error: { message: "update failed" } }] }));
    const response = await PATCH(requestWithAuth(BASE_URL, { method: "PATCH" }), paramsFor("inv-1"));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("PATCH /api/invitations/[id]", { message: "update failed" }, { id: "inv-1" });
  });
});
