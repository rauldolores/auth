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

const { GET, POST } = await import("../applications/[id]/keys/route");
const { DELETE } = await import("../applications/[id]/keys/[keyId]/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

/** A scoped-client stand-in: table access via makeSchemaClient, plus .auth.getUser() for created_by/revoked_by. */
function clientWith(tableResponses: Record<string, unknown[]>, userId = "admin-1") {
  return {
    ...makeSchemaClient(tableResponses),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
  };
}

const BASE_URL = "https://auth.example.com/api/applications/app-1/keys";

beforeEach(() => {
  createClientMock.mockReset();
  logErrorMock.mockReset();
});

describe("GET /api/applications/[id]/keys", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request(BASE_URL), { params: Promise.resolve({ id: "app-1" }) });
    expect(response.status).toBe(401);
  });

  it("lists keys visible to the caller (RLS already scoped them)", async () => {
    createClientMock.mockReturnValue(
      clientWith({
        application_api_keys: [
          {
            data: [
              {
                id: "key-1",
                organization_id: "org-1",
                name: "Zapier",
                key_prefix: "kapp_ab12cd",
                last_used_at: null,
                expires_at: null,
                revoked_at: null,
                revoked_by: null,
                created_by: "admin-1",
                created_at: "2026-01-01T00:00:00.000Z",
              },
            ],
            error: null,
          },
        ],
      }),
    );
    const response = await GET(requestWithAuth(BASE_URL), { params: Promise.resolve({ id: "app-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      keys: [
        {
          id: "key-1",
          organizationId: "org-1",
          name: "Zapier",
          keyPrefix: "kapp_ab12cd",
          lastUsedAt: null,
          expiresAt: null,
          revokedAt: null,
          revokedBy: null,
          createdBy: "admin-1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("returns 400 and logs on a query error", async () => {
    createClientMock.mockReturnValue(clientWith({ application_api_keys: [{ data: null, error: { message: "boom" } }] }));
    const response = await GET(requestWithAuth(BASE_URL), { params: Promise.resolve({ id: "app-1" }) });
    expect(response.status).toBe(400);
    expect(logErrorMock).toHaveBeenCalledWith("GET /api/applications/[id]/keys", { message: "boom" }, { id: "app-1" });
  });
});

describe("POST /api/applications/[id]/keys", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await POST(new Request(BASE_URL, { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "app-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns 400 when organizationId or name is missing", async () => {
    createClientMock.mockReturnValue(clientWith({}));
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ organizationId: "org-1" }) }),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid expiresAt", async () => {
    createClientMock.mockReturnValue(clientWith({}));
    const response = await POST(
      requestWithAuth(BASE_URL, {
        method: "POST",
        body: JSON.stringify({ organizationId: "org-1", name: "Zapier", expiresAt: "not-a-date" }),
      }),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("creates a key and returns the plaintext once", async () => {
    createClientMock.mockReturnValue(
      clientWith({
        application_api_keys: [
          {
            data: { id: "key-1", name: "Zapier", organization_id: "org-1", key_prefix: "kapp_ab12cd", expires_at: null, created_at: "2026-01-01T00:00:00.000Z" },
            error: null,
          },
        ],
      }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ organizationId: "org-1", name: "Zapier" }) }),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { apiKey: string; keyPrefix: string; organizationId: string };
    expect(body.apiKey).toMatch(/^kapp_/);
    expect(body.organizationId).toBe("org-1");
  });

  it("translates an RLS rejection into a 403 with a clear message", async () => {
    createClientMock.mockReturnValue(
      clientWith({
        application_api_keys: [{ data: null, error: { message: "new row violates row-level security policy for table \"application_api_keys\"" } }],
      }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ organizationId: "org-2", name: "Zapier" }) }),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/applications/[id]/keys/[keyId]", () => {
  const KEY_URL = "https://auth.example.com/api/applications/app-1/keys/key-1";

  it("returns 401 when unauthenticated", async () => {
    const response = await DELETE(new Request(KEY_URL, { method: "DELETE" }), { params: Promise.resolve({ id: "app-1", keyId: "key-1" }) });
    expect(response.status).toBe(401);
  });

  it("revokes the key", async () => {
    createClientMock.mockReturnValue(clientWith({ application_api_keys: [{ data: { id: "key-1" }, error: null }] }));
    const response = await DELETE(requestWithAuth(KEY_URL, { method: "DELETE" }), {
      params: Promise.resolve({ id: "app-1", keyId: "key-1" }),
    });
    expect(response.status).toBe(204);
  });

  it("returns 404 when the key doesn't exist, is already revoked, or isn't visible to the caller (RLS)", async () => {
    createClientMock.mockReturnValue(clientWith({ application_api_keys: [{ data: null, error: null }] }));
    const response = await DELETE(requestWithAuth(KEY_URL, { method: "DELETE" }), {
      params: Promise.resolve({ id: "app-1", keyId: "key-1" }),
    });
    expect(response.status).toBe(404);
  });
});
