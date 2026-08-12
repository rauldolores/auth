import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { makeAdminClient, makeSchemaClient } from "./test-helpers";

// Cross-organization view for platform admins: organization creation is
// self-service (anyone can create one and become its Owner), but there was
// no way to see — let alone remove — every organization a given user
// belongs to across the whole installation. /users only ever shows the
// active organization's members.
const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const verifyRequestMock = vi.fn();
vi.mock("@kontrolia/auth/server", () => ({
  verifyRequest: (...args: unknown[]) => verifyRequestMock(...args),
}));

const logErrorMock = vi.fn();
const logSecurityEventMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
  logSecurityEvent: (...args: unknown[]) => logSecurityEventMock(...args),
}));

const fetchMock = vi.fn();

const { GET, DELETE } = await import("../platform-admins/user-memberships/route");

const BASE_URL = "https://auth.example.com/api/platform-admins/user-memberships";

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
  verifyRequestMock.mockReset();
  logErrorMock.mockReset();
  logSecurityEventMock.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  resetRateLimitsForTests();
});

describe("platform-admin gate (shared by GET and DELETE)", () => {
  it("returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await GET(requestWithAuth(`${BASE_URL}?email=x@example.com`));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false } });
    const response = await GET(requestWithAuth(`${BASE_URL}?email=x@example.com`));
    expect(response.status).toBe(403);
  });

  it("rate limits after too many requests from the same IP within the window", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false } });
    const makeRequest = () =>
      requestWithAuth(`${BASE_URL}?email=x@example.com`, { headers: { "X-Forwarded-For": "198.51.100.9" } });

    for (let i = 0; i < 30; i++) {
      const response = await GET(makeRequest());
      expect(response.status).not.toBe(429);
    }

    const limited = await GET(makeRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("GET /api/platform-admins/user-memberships", () => {
  it("returns 400 when email is missing", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(400);
  });

  it("returns 404 when no user matches the email", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ users: [] }), { status: 200 }));
    const response = await GET(requestWithAuth(`${BASE_URL}?email=nadie@example.com`));
    expect(response.status).toBe(404);
  });

  it("lists every organization the user belongs to, across the installation", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ users: [{ id: "user-1", email: "multi@example.com" }] }), { status: 200 }),
    );
    createSupabaseAdminClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [
          {
            data: [
              {
                id: "m1",
                status: "active",
                created_at: "2026-01-01T00:00:00.000Z",
                organization: { id: "org-1", name: "Acme" },
                membership_roles: [{ role: { name: "Owner", slug: "owner" } }],
              },
              {
                id: "m2",
                status: "active",
                created_at: "2026-01-02T00:00:00.000Z",
                organization: { id: "org-2", name: "Beta" },
                membership_roles: [{ role: { name: "Member", slug: "member" } }],
              },
            ],
            error: null,
          },
        ],
      }),
    );
    const response = await GET(requestWithAuth(`${BASE_URL}?email=multi@example.com`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: { id: "user-1", email: "multi@example.com" },
      memberships: [
        {
          membershipId: "m1",
          organizationId: "org-1",
          organizationName: "Acme",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          roles: [{ name: "Owner", slug: "owner" }],
        },
        {
          membershipId: "m2",
          organizationId: "org-2",
          organizationName: "Beta",
          status: "active",
          createdAt: "2026-01-02T00:00:00.000Z",
          roles: [{ name: "Member", slug: "member" }],
        },
      ],
    });
  });
});

describe("GET /api/platform-admins/user-memberships?userId= (alternative to ?email=)", () => {
  it("resolves the user directly by id, skipping the email search round-trip", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const admin = makeAdminClient({
      memberships: [
        {
          data: [
            {
              id: "m1",
              status: "active",
              created_at: "2026-01-01T00:00:00.000Z",
              organization: { id: "org-1", name: "Acme" },
              membership_roles: [{ role: { name: "Owner", slug: "owner" } }],
            },
          ],
          error: null,
        },
      ],
    });
    admin.auth.admin = {
      ...admin.auth.admin,
      getUserById: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "byid@example.com" } }, error: null }),
    } as unknown as typeof admin.auth.admin;
    createSupabaseAdminClientMock.mockReturnValue(admin);

    const response = await GET(requestWithAuth(`${BASE_URL}?userId=user-1`));
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.user).toEqual({ id: "user-1", email: "byid@example.com" });
    expect(body.memberships).toHaveLength(1);
  });

  it("returns 404 when the id doesn't resolve to a user", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const admin = makeAdminClient();
    admin.auth.admin = {
      ...admin.auth.admin,
      getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    } as unknown as typeof admin.auth.admin;
    createSupabaseAdminClientMock.mockReturnValue(admin);

    const response = await GET(requestWithAuth(`${BASE_URL}?userId=missing`));
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/platform-admins/user-memberships", () => {
  it("returns 400 when membershipId is missing", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }));
    expect(response.status).toBe(400);
  });

  it("removes the membership on success", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(makeSchemaClient({ memberships: [{ error: null }] }));
    const response = await DELETE(requestWithAuth(`${BASE_URL}?membershipId=m1`, { method: "DELETE" }));
    expect(response.status).toBe(204);
  });

  it("surfaces the database's last-owner-removal protection as a 400", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeSchemaClient({
        memberships: [{ error: { message: "No puedes quitar al único Owner activo de la organización." } }],
      }),
    );
    const response = await DELETE(requestWithAuth(`${BASE_URL}?membershipId=m1`, { method: "DELETE" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("No puedes quitar al único Owner activo de la organización.");
  });
});
