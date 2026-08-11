import { hashApplicationApiKey } from "@kontrolia/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { makeAdminClient } from "./test-helpers";

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

const { DELETE, PATCH } = await import("../applications/members/[membershipId]/route");

const BASE_URL = "https://auth.example.com/api/applications/members/m1";
const PLAINTEXT_KEY = "kapp_test-key";
const KEY_HASH = hashApplicationApiKey(PLAINTEXT_KEY);
const APPLICATION = { id: "app-1", api_key_hash: KEY_HASH, owner_organization_id: "org-1" };
const params = Promise.resolve({ membershipId: "m1" });

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: { Authorization: `Bearer ${PLAINTEXT_KEY}`, "X-Application-Slug": "faqturia", ...init?.headers },
  });
}

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
  logErrorMock.mockReset();
  logSecurityEventMock.mockReset();
  resetRateLimitsForTests();
});

describe("DELETE /api/applications/members/[membershipId]", () => {
  it("returns 404 when the membership doesn't exist", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ applications: [{ data: APPLICATION, error: null }], memberships: [{ data: null, error: null }] }),
    );
    const response = await DELETE(requestWithAuth(BASE_URL), { params });
    expect(response.status).toBe(404);
  });

  it("returns 404 (not 403) when the membership belongs to a different organization — no cross-org leak", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        applications: [{ data: APPLICATION, error: null }],
        memberships: [{ data: { id: "m1", organization_id: "org-2" }, error: null }],
      }),
    );
    const response = await DELETE(requestWithAuth(BASE_URL), { params });
    expect(response.status).toBe(404);
  });

  it("removes a member of the application's own organization", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        applications: [{ data: APPLICATION, error: null }],
        memberships: [{ data: { id: "m1", organization_id: "org-1" }, error: null }, { data: null, error: null }],
      }),
    );
    const response = await DELETE(requestWithAuth(BASE_URL), { params });
    expect(response.status).toBe(204);
  });

  it("surfaces the database's last-owner-removal protection as a 400", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        applications: [{ data: APPLICATION, error: null }],
        memberships: [
          { data: { id: "m1", organization_id: "org-1" }, error: null },
          { data: null, error: { message: "No puedes quitar al único Owner activo de la organización." } },
        ],
      }),
    );
    const response = await DELETE(requestWithAuth(BASE_URL), { params });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("No puedes quitar al único Owner activo de la organización.");
  });
});

describe("PATCH /api/applications/members/[membershipId] (roles)", () => {
  it("returns 400 when neither grant nor revoke is provided", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ applications: [{ data: APPLICATION, error: null }] }));
    const response = await PATCH(requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({}) }), { params });
    expect(response.status).toBe(400);
  });

  it("returns 404 when the membership belongs to a different organization", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        applications: [{ data: APPLICATION, error: null }],
        memberships: [{ data: { id: "m1", organization_id: "org-2" }, error: null }],
      }),
    );
    const response = await PATCH(
      requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ grant: ["role-member"] }) }),
      { params },
    );
    expect(response.status).toBe(404);
  });

  it("rejects granting the Owner role — the one trigger that exempts service_role", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        applications: [{ data: APPLICATION, error: null }],
        memberships: [{ data: { id: "m1", organization_id: "org-1" }, error: null }],
        roles: [{ data: { id: "role-owner", slug: "owner", is_system_role: true, organization_id: null }, error: null }],
      }),
    );
    const response = await PATCH(
      requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ grant: ["role-owner"] }) }),
      { params },
    );
    expect(response.status).toBe(403);
  });

  it("rejects a custom role from a different organization", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        applications: [{ data: APPLICATION, error: null }],
        memberships: [{ data: { id: "m1", organization_id: "org-1" }, error: null }],
        roles: [{ data: { id: "role-x", slug: "support", is_system_role: false, organization_id: "org-2" }, error: null }],
      }),
    );
    const response = await PATCH(
      requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ grant: ["role-x"] }) }),
      { params },
    );
    expect(response.status).toBe(403);
  });

  it("grants a valid role and returns the member's updated roles", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        applications: [{ data: APPLICATION, error: null }],
        memberships: [{ data: { id: "m1", organization_id: "org-1" }, error: null }],
        roles: [{ data: { id: "role-admin", slug: "admin", is_system_role: true, organization_id: null }, error: null }],
        membership_roles: [
          { error: null },
          { data: [{ role: { id: "role-admin", name: "Admin", slug: "admin" } }], error: null },
        ],
      }),
    );
    const response = await PATCH(
      requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ grant: ["role-admin"] }) }),
      { params },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ roles: [{ id: "role-admin", name: "Admin", slug: "admin" }] });
  });

  it("surfaces the database's last-owner-role-removal protection as a 400 on revoke", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({
        applications: [{ data: APPLICATION, error: null }],
        memberships: [{ data: { id: "m1", organization_id: "org-1" }, error: null }],
        roles: [{ data: { id: "role-owner", slug: "owner", is_system_role: true, organization_id: null }, error: null }],
        membership_roles: [{ error: { message: "No puedes quitar el rol de Owner al único Owner activo de la organización." } }],
      }),
    );
    const response = await PATCH(
      requestWithAuth(BASE_URL, { method: "PATCH", body: JSON.stringify({ revoke: ["role-owner"] }) }),
      { params },
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("No puedes quitar el rol de Owner al único Owner activo de la organización.");
  });
});
