import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAdminClient, makeSchemaClient } from "./test-helpers";

// scopedClient() in the route builds its own caller-scoped client via the
// raw supabase-js createClient() (not the cookie-based @/lib/supabase-server
// helper other routes use, since this route authenticates via a bearer
// token forwarded from admin-panel). Mock that entry point directly.
const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const logErrorMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

const { GET, PATCH, DELETE } = await import("../organization-members/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

const BASE_URL = "https://auth.example.com/api/organization-members";

beforeEach(() => {
  createClientMock.mockReset();
  createSupabaseAdminClientMock.mockReset();
  logErrorMock.mockReset();
  // Default admin client: no platform users to resolve, tests override as needed.
  createSupabaseAdminClientMock.mockReturnValue(makeAdminClient());
});

describe("GET /api/organization-members", () => {
  it("returns 401 when the caller sends no bearer token", async () => {
    const response = await GET(new Request(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "No autenticado" });
  });

  it("returns 400 when organizationId is missing", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({}));
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(400);
  });

  it("returns members with emails resolved and hasMore=false for a partial page", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [
          {
            data: [
              {
                id: "mem-1",
                user_id: "user-1",
                status: "active",
                created_at: "2026-01-01T00:00:00Z",
                membership_roles: [{ role: { id: "role-1", name: "Owner", slug: "owner", application_id: null, application: null } }],
              },
            ],
            error: null,
          },
        ],
      }),
    );
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({}, { data: { users: [{ id: "user-1", email: "owner@example.com" }] }, error: null }),
    );

    const response = await GET(requestWithAuth(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      members: [
        {
          membershipId: "mem-1",
          userId: "user-1",
          email: "owner@example.com",
          status: "active",
          createdAt: "2026-01-01T00:00:00Z",
          roles: [{ id: "role-1", name: "Owner", slug: "owner", application_id: null, application: null }],
        },
      ],
      hasMore: false,
    });
  });

  it("falls back to '(desconocido)' when a member's email can't be resolved", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [
          {
            data: [
              { id: "mem-2", user_id: "user-missing", status: "active", created_at: "2026-01-01T00:00:00Z", membership_roles: [] },
            ],
            error: null,
          },
        ],
      }),
    );
    // listUsers returns no matching user for user-missing.
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({}, { data: { users: [] }, error: null }));

    const response = await GET(requestWithAuth(`${BASE_URL}?organizationId=org-1`));
    const body = await response.json();
    expect(body.members[0].email).toBe("(desconocido)");
  });

  it("returns 500 and logs when the memberships query errors", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({ memberships: [{ data: null, error: { message: "db exploded" } }] }),
    );

    const response = await GET(requestWithAuth(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db exploded" });
    expect(logErrorMock).toHaveBeenCalledWith("GET /api/organization-members", { message: "db exploded" }, { organizationId: "org-1" });
  });
});

describe("PATCH /api/organization-members (status changes, wouldRemoveLastOwner)", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await PATCH(new Request(`${BASE_URL}?membershipId=mem-1`, { method: "PATCH", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when membershipId is missing", async () => {
    const response = await PATCH(requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ status: "active" }) }));
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid status value", async () => {
    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?membershipId=mem-1`, { method: "PATCH", body: JSON.stringify({ status: "banned" }) }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'status debe ser "active" o "suspended"' });
  });

  it("blocks suspending the organization's only active Owner", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [
          { data: { organization_id: "org-1", membership_roles: [{ role: { slug: "owner" } }] }, error: null },
        ],
        roles: [{ data: { id: "owner-role-id" }, error: null }],
        membership_roles: [{ count: 1 }],
      }),
    );

    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?membershipId=mem-1`, { method: "PATCH", body: JSON.stringify({ status: "suspended" }) }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No puedes suspender al único Owner de la organización." });
  });

  it("allows suspending an Owner when a second active Owner exists", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [
          { data: { organization_id: "org-1", membership_roles: [{ role: { slug: "owner" } }] }, error: null },
          { error: null }, // the subsequent UPDATE call
        ],
        roles: [{ data: { id: "owner-role-id" }, error: null }],
        membership_roles: [{ count: 2 }],
      }),
    );

    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?membershipId=mem-1`, { method: "PATCH", body: JSON.stringify({ status: "suspended" }) }),
    );
    expect(response.status).toBe(204);
  });

  it("allows suspending a non-Owner member freely, without querying owner counts", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [
          { data: { organization_id: "org-1", membership_roles: [{ role: { slug: "member" } }] }, error: null },
          { error: null }, // the subsequent UPDATE call
        ],
      }),
    );

    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?membershipId=mem-2`, { method: "PATCH", body: JSON.stringify({ status: "suspended" }) }),
    );
    expect(response.status).toBe(204);
  });

  it("reactivating (status=active) skips the last-owner check entirely", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [{ error: null }], // only the UPDATE call, no owner-check SELECT
      }),
    );

    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?membershipId=mem-1`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }),
    );
    expect(response.status).toBe(204);
  });

  it("returns 500 and logs when the update itself fails", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [{ error: { message: "update failed" } }],
      }),
    );

    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?membershipId=mem-1`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }),
    );
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("PATCH /api/organization-members", { message: "update failed" }, { membershipId: "mem-1" });
  });
});

describe("DELETE /api/organization-members (wouldRemoveLastOwner)", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await DELETE(new Request(`${BASE_URL}?membershipId=mem-1`, { method: "DELETE" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when membershipId is missing", async () => {
    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }));
    expect(response.status).toBe(400);
  });

  it("blocks removing the organization's only active Owner", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [
          { data: { organization_id: "org-1", membership_roles: [{ role: { slug: "owner" } }] }, error: null },
        ],
        roles: [{ data: { id: "owner-role-id" }, error: null }],
        membership_roles: [{ count: 1 }],
      }),
    );

    const response = await DELETE(requestWithAuth(`${BASE_URL}?membershipId=mem-1`, { method: "DELETE" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No puedes quitar al único Owner de la organización." });
  });

  it("allows removing an Owner when a second active Owner exists", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [
          { data: { organization_id: "org-1", membership_roles: [{ role: { slug: "owner" } }] }, error: null },
          { error: null }, // the subsequent DELETE call
        ],
        roles: [{ data: { id: "owner-role-id" }, error: null }],
        membership_roles: [{ count: 2 }],
      }),
    );

    const response = await DELETE(requestWithAuth(`${BASE_URL}?membershipId=mem-1`, { method: "DELETE" }));
    expect(response.status).toBe(204);
  });

  it("allows removing a non-Owner member freely", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [
          { data: { organization_id: "org-1", membership_roles: [{ role: { slug: "member" } }] }, error: null },
          { error: null }, // the subsequent DELETE call
        ],
      }),
    );

    const response = await DELETE(requestWithAuth(`${BASE_URL}?membershipId=mem-2`, { method: "DELETE" }));
    expect(response.status).toBe(204);
  });

  it("returns 500 and logs when the delete itself fails", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [
          { data: { organization_id: "org-1", membership_roles: [] }, error: null },
          { error: { message: "delete failed" } },
        ],
      }),
    );

    const response = await DELETE(requestWithAuth(`${BASE_URL}?membershipId=mem-1`, { method: "DELETE" }));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("DELETE /api/organization-members", { message: "delete failed" }, { membershipId: "mem-1" });
  });
});
