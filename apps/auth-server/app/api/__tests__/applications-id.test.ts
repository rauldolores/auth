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

const { PATCH } = await import("../applications/[id]/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const BASE_URL = "https://auth.example.com/api/applications/app-1";

beforeEach(() => {
  createClientMock.mockReset();
  logErrorMock.mockReset();
});

describe("PATCH /api/applications/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await PATCH(new Request(BASE_URL, { method: "PATCH", body: "{}" }), paramsFor("app-1"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when neither field is provided", async () => {
    const response = await PATCH(requestWithAuth(BASE_URL, { method: "PATCH", body: "{}" }), paramsFor("app-1"));
    expect(response.status).toBe(400);
  });

  it("updates homepage_url", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({ applications: [{ data: { id: "app-1", homepage_url: "https://example.com", oauth_client_id: null }, error: null }] }),
    );
    const response = await PATCH(
      requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ homepageUrl: "https://example.com" }) }),
      paramsFor("app-1"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.application.homepage_url).toBe("https://example.com");
  });

  it("surfaces the RLS/update error as 400 (e.g. a non-owning org)", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({ applications: [{ data: null, error: { message: "new row violates row-level security policy" } }] }),
    );
    const response = await PATCH(
      requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ oauthClientId: "client-1" }) }),
      paramsFor("app-1"),
    );
    expect(response.status).toBe(400);
  });
});
