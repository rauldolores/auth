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

const { GET, POST } = await import("../roles/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

const BASE_URL = "https://auth.example.com/api/roles";

beforeEach(() => {
  createClientMock.mockReset();
  logErrorMock.mockReset();
});

describe("GET /api/roles", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(401);
  });

  it("returns 400 when organizationId is missing", async () => {
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(400);
  });

  it("lists roles for the organization", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        roles: [
          {
            data: [{ id: "role-1", name: "Owner", slug: "owner", is_system_role: true, grants_all_permissions: true, organization_id: null, application_id: null, application: null }],
            error: null,
          },
        ],
      }),
    );
    const response = await GET(requestWithAuth(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.roles).toHaveLength(1);
  });

  it("returns 500 and logs when the query errors", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ roles: [{ data: null, error: { message: "db exploded" } }] }));
    const response = await GET(requestWithAuth(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("GET /api/roles", { message: "db exploded" }, { organizationId: "org-1" });
  });
});

describe("POST /api/roles", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ organizationId: "org-1" }) }),
    );
    expect(response.status).toBe(400);
  });

  it("creates the role with a computed slug", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        roles: [
          {
            data: { id: "role-2", name: "Contador", slug: "contador", is_system_role: false, grants_all_permissions: false, organization_id: "org-1", application_id: "app-1" },
            error: null,
          },
        ],
      }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, {
        method: "POST",
        body: JSON.stringify({ organizationId: "org-1", applicationId: "app-1", name: "Contador" }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.role.slug).toBe("contador");
  });

  it("surfaces the RLS/insert error as 400", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({ roles: [{ data: null, error: { message: "new row violates row-level security policy" } }] }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, {
        method: "POST",
        body: JSON.stringify({ organizationId: "org-1", applicationId: "app-1", name: "Contador" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
