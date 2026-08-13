import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSchemaClient } from "./test-helpers";

// Light coverage: straightforward RLS-backed list/create with little
// branching beyond auth and input validation.
const getUserMock = vi.fn();
const schemaClientHolder: { current: ReturnType<typeof makeSchemaClient> | null } = { current: null };
vi.mock("@/lib/supabase-server", () => ({
  createRouteHandlerSupabaseClient: async () => ({
    auth: { getUser: getUserMock },
    ...schemaClientHolder.current,
  }),
}));

// authenticateCookieOrBearer falls back to the mocked cookie client above
// when no Authorization header is present; when one is, it builds a client
// via this same createClient() entry point instead.
const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const logErrorMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

const { GET, POST } = await import("../organizations/route");

const BASE_URL = "https://auth.example.com/api/organizations";

beforeEach(() => {
  getUserMock.mockReset();
  createClientMock.mockReset();
  logErrorMock.mockReset();
  schemaClientHolder.current = null;
});

describe("GET /api/organizations", () => {
  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const response = await GET(new Request(BASE_URL));
    expect(response.status).toBe(401);
  });

  it("lists the caller's active organizations", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    schemaClientHolder.current = makeSchemaClient({
      memberships: [{ data: [{ organization: { id: "org-1", name: "Acme", slug: "acme" } }], error: null }],
    });
    const response = await GET(new Request(BASE_URL));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ organizations: [{ id: "org-1", name: "Acme", slug: "acme" }] });
  });

  it("returns 500 and logs on a query error", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    schemaClientHolder.current = makeSchemaClient({ memberships: [{ data: null, error: { message: "boom" } }] });
    const response = await GET(new Request(BASE_URL));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("GET /api/organizations", { message: "boom" });
  });

  it("uses a bearer-token client instead of the cookie session when Authorization is present", async () => {
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      ...makeSchemaClient({ memberships: [{ data: [{ organization: { id: "org-2", name: "Bearer Co", slug: "bearer-co" } }], error: null }] }),
    });
    const response = await GET(new Request(BASE_URL, { headers: { Authorization: "Bearer test-token" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ organizations: [{ id: "org-2", name: "Bearer Co", slug: "bearer-co" }] });
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/organizations", () => {
  it("returns 400 when name or slug is missing", async () => {
    const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({ name: "Acme" }) }));
    expect(response.status).toBe(400);
  });

  it("creates the organization and returns it", async () => {
    schemaClientHolder.current = makeSchemaClient({
      organizations: [
        { error: null }, // insert
        { data: { id: "org-1", name: "Acme", slug: "acme" }, error: null }, // follow-up select
      ],
    });
    const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({ name: "Acme", slug: "acme" }) }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ organization: { id: "org-1", name: "Acme", slug: "acme" } });
  });

  it("returns 400 when the insert fails (e.g. duplicate slug)", async () => {
    schemaClientHolder.current = makeSchemaClient({
      organizations: [{ error: { message: "duplicate key value violates unique constraint" } }],
    });
    const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({ name: "Acme", slug: "acme" }) }));
    expect(response.status).toBe(400);
  });
});
