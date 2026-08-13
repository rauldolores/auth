import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSchemaClient } from "./test-helpers";

// Bearer-token auth (like organization-members) — scopedClient() builds its
// own client via the raw supabase-js createClient() entry point.
const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const logErrorMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

const { GET, POST } = await import("../invitations/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

const BASE_URL = "https://auth.example.com/api/invitations";

beforeEach(() => {
  createClientMock.mockReset();
  logErrorMock.mockReset();
});

describe("GET /api/invitations", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(401);
  });

  it("returns 400 when organizationId is missing", async () => {
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(400);
  });

  it("lists invitations for the organization", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        invitations: [
          {
            data: [
              {
                id: "inv-1",
                email: "new@example.com",
                token: "tok-abc",
                created_at: "2026-01-01T00:00:00Z",
                expires_at: "2026-01-08T00:00:00Z",
                accepted_at: null,
                role: { name: "Member" },
              },
            ],
            error: null,
          },
        ],
      }),
    );
    const response = await GET(requestWithAuth(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invitations).toHaveLength(1);
    expect(body.hasMore).toBe(false);
  });

  it("returns 500 and logs when the query errors", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ invitations: [{ data: null, error: { message: "db exploded" } }] }));
    const response = await GET(requestWithAuth(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("GET /api/invitations", { message: "db exploded" }, { organizationId: "org-1" });
  });
});

describe("POST /api/invitations", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when organizationId or email is missing", async () => {
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ organizationId: "org-1" }) }));
    expect(response.status).toBe(400);
  });

  it("creates an invitation and returns its token", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        invitations: [
          { data: { id: "inv-1", email: "new@example.com", token: "tok-abc", expires_at: "2026-02-01T00:00:00Z" }, error: null },
        ],
      }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, {
        method: "POST",
        body: JSON.stringify({ organizationId: "org-1", email: "new@example.com", roleId: "role-1" }),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      invitation: { id: "inv-1", email: "new@example.com", token: "tok-abc", expires_at: "2026-02-01T00:00:00Z" },
    });
  });

  it("surfaces the RLS/insert error (e.g. a non-admin caller) as 400", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({ invitations: [{ data: null, error: { message: "new row violates row-level security policy" } }] }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ organizationId: "org-1", email: "new@example.com" }) }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "new row violates row-level security policy" });
  });
});
