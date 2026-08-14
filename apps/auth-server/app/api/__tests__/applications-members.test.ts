import { hashApplicationApiKey } from "@kontrolia/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { makeAdminClient } from "./test-helpers";

// Covers the new external "manage users" API: kapp_-key-authenticated
// (same key model as /api/applications/sync), scoped to whichever
// organization the *matched key* was generated for — not necessarily the
// application's owner_organization_id — since the admin client bypasses
// RLS, every query is filtered by that organizationId in the route itself,
// so the tenant-isolation tests here are the ones that actually matter.
const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const logErrorMock = vi.fn();
const logSecurityEventMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
  logSecurityEvent: (...args: unknown[]) => logSecurityEventMock(...args),
}));

const { GET, POST } = await import("../applications/members/route");

const BASE_URL = "https://auth.example.com/api/applications/members";
const PLAINTEXT_KEY = "kapp_test-key";
const KEY_HASH = hashApplicationApiKey(PLAINTEXT_KEY);
const APPLICATION = { id: "app-1", owner_organization_id: "org-1" };
const ACTIVE_KEY = { id: "key-1", organization_id: "org-1", key_hash: KEY_HASH };

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: { Authorization: `Bearer ${PLAINTEXT_KEY}`, "X-Application-Slug": "faqturia", ...init?.headers },
  });
}

/** Builds an admin client whose application/key lookups succeed, with any further per-table responses layered on. */
function clientFor(
  tableResponses: Record<string, unknown[]> = {},
  listUsersResult?: { data: { users: { id: string; email: string }[] } | null; error: unknown },
) {
  return makeAdminClient(
    {
      applications: [{ data: APPLICATION, error: null }],
      application_api_keys: [{ data: [ACTIVE_KEY], error: null }],
      ...tableResponses,
    },
    listUsersResult,
  );
}

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
  logErrorMock.mockReset();
  logSecurityEventMock.mockReset();
  resetRateLimitsForTests();
});

describe("auth gate (shared by GET and POST)", () => {
  it("returns 401 without an Authorization header", async () => {
    const response = await GET(new Request(BASE_URL, { headers: { "X-Application-Slug": "faqturia" } }));
    expect(response.status).toBe(401);
  });

  it("returns 400 without X-Application-Slug", async () => {
    const response = await GET(new Request(BASE_URL, { headers: { Authorization: `Bearer ${PLAINTEXT_KEY}` } }));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the slug doesn't match a registered application", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ applications: [{ data: null, error: null }] }));
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(404);
  });

  it("returns 401 when the key doesn't match any active key for the application", async () => {
    createSupabaseAdminClientMock.mockReturnValue(clientFor());
    const response = await GET(
      new Request(BASE_URL, { headers: { Authorization: "Bearer kapp_wrong-key", "X-Application-Slug": "faqturia" } }),
    );
    expect(response.status).toBe(401);
  });

  it("rate limits after too many requests from the same IP within the window", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ applications: [{ data: null, error: null }] }));
    const makeRequest = () => requestWithAuth(BASE_URL, { headers: { "X-Forwarded-For": "198.51.100.9" } });

    for (let i = 0; i < 30; i++) {
      const response = await GET(makeRequest());
      expect(response.status).not.toBe(429);
    }

    const limited = await GET(makeRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("GET /api/applications/members", () => {
  it("lists members of the calling key's own organization with resolved emails", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      clientFor(
        {
          memberships: [
            {
              data: [
                {
                  id: "m1",
                  user_id: "u1",
                  status: "active",
                  created_at: "2026-01-01T00:00:00.000Z",
                  membership_roles: [{ role: { id: "r1", name: "Member", slug: "member", application_id: null } }],
                },
              ],
              error: null,
            },
          ],
        },
        { data: { users: [{ id: "u1", email: "user@example.com" }] }, error: null },
      ),
    );
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      members: [
        {
          membershipId: "m1",
          userId: "u1",
          email: "user@example.com",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          roles: [{ id: "r1", name: "Member", slug: "member", application_id: null }],
        },
      ],
      hasMore: false,
    });
  });

  it("scopes the membership query to a key generated for a non-owner organization", async () => {
    const nonOwnerKey = { id: "key-2", organization_id: "org-2", key_hash: KEY_HASH };
    const client = makeAdminClient({
      applications: [{ data: APPLICATION, error: null }],
      application_api_keys: [{ data: [nonOwnerKey], error: null }],
      memberships: [{ data: [], error: null }],
    });
    createSupabaseAdminClientMock.mockReturnValue(client);
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(200);
    expect(client.from).toHaveBeenCalledWith("memberships");
  });
});

describe("POST /api/applications/members (invite)", () => {
  it("returns 400 when email is missing", async () => {
    createSupabaseAdminClientMock.mockReturnValue(clientFor());
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });

  it("rejects inviting with the Owner role", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      clientFor({
        roles: [{ data: { id: "role-owner", slug: "owner", is_system_role: true, organization_id: null }, error: null }],
      }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ email: "new@example.com", roleId: "role-owner" }) }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects a custom role that belongs to a different organization", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      clientFor({
        roles: [{ data: { id: "role-x", slug: "support", is_system_role: false, organization_id: "org-2" }, error: null }],
      }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ email: "new@example.com", roleId: "role-x" }) }),
    );
    expect(response.status).toBe(403);
  });

  it("creates an invitation scoped to the calling key's own organization", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      clientFor({
        invitations: [{ data: { id: "inv-1", email: "new@example.com", token: "tok", expires_at: "2026-01-08" }, error: null }],
      }),
    );
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ email: "new@example.com" }) }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      invitation: { id: "inv-1", email: "new@example.com", token: "tok", expires_at: "2026-01-08" },
    });
  });
});
