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

const { POST, DELETE } = await import("../applications/[id]/key/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const BASE_URL = "https://auth.example.com/api/applications/app-1/key";

beforeEach(() => {
  createClientMock.mockReset();
  logErrorMock.mockReset();
});

describe("POST /api/applications/[id]/key (rotate)", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await POST(new Request(BASE_URL, { method: "POST" }), paramsFor("app-1"));
    expect(response.status).toBe(401);
  });

  it("generates a new kapp_ key server-side and returns the plaintext once", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ applications: [{ error: null }] }));
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST" }), paramsFor("app-1"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.apiKey).toMatch(/^kapp_/);
  });

  it("returns 400 and logs when the update fails", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ applications: [{ error: { message: "update failed" } }] }));
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST" }), paramsFor("app-1"));
    expect(response.status).toBe(400);
    expect(logErrorMock).toHaveBeenCalledWith("POST /api/applications/[id]/key", { message: "update failed" }, { id: "app-1" });
  });
});

describe("DELETE /api/applications/[id]/key (revoke)", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await DELETE(new Request(BASE_URL, { method: "DELETE" }), paramsFor("app-1"));
    expect(response.status).toBe(401);
  });

  it("clears the key", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ applications: [{ error: null }] }));
    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }), paramsFor("app-1"));
    expect(response.status).toBe(204);
  });
});
