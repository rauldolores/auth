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

const { GET } = await import("../permissions/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

const BASE_URL = "https://auth.example.com/api/permissions";

beforeEach(() => {
  createClientMock.mockReset();
  logErrorMock.mockReset();
});

describe("GET /api/permissions", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request(BASE_URL));
    expect(response.status).toBe(401);
  });

  it("lists permissions, RLS-scoped to the caller's enabled apps", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        permissions: [
          {
            data: [{ id: "perm-1", key: "facturas.ver", resource: "facturas", action: "ver", description: null, application: { id: "app-1", name: "Facturación" } }],
            error: null,
          },
        ],
      }),
    );
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.permissions).toHaveLength(1);
    expect(body.hasMore).toBe(false);
  });

  it("returns 500 and logs when the query errors", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ permissions: [{ data: null, error: { message: "db exploded" } }] }));
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("GET /api/permissions", { message: "db exploded" }, { applicationId: null });
  });
});
