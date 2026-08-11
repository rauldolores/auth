import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSchemaClient } from "./test-helpers";

const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const getUserMock = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  createRouteHandlerSupabaseClient: async () => ({
    auth: { getUser: getUserMock },
  }),
}));

const logErrorMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

const { GET, POST } = await import("../invitations/accept/route");

const BASE_URL = "https://auth.example.com/api/invitations/accept";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, { method: "POST", body: JSON.stringify(body) });
}

const VALID_INVITATION = {
  id: "inv-1",
  email: "invitee@example.com",
  role_id: "role-1",
  organization_id: "org-1",
  invited_by: "inviter-1",
  accepted_at: null,
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  organization: { name: "Acme Corp" },
  role: { name: "Member" },
};

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
  getUserMock.mockReset();
  logErrorMock.mockReset();
});

describe("GET /api/invitations/accept (preview)", () => {
  it("returns 400 when the token query param is missing", async () => {
    const response = await GET(new Request(BASE_URL));
    expect(response.status).toBe(400);
  });

  it("returns 404 when no invitation matches the token", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeSchemaClient({ invitations: [{ data: null, error: null }] }));
    const response = await GET(new Request(`${BASE_URL}?token=nope`));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Invitación no encontrada" });
  });

  it("returns 410 when the invitation already expired", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeSchemaClient({
        invitations: [{ data: { ...VALID_INVITATION, expires_at: new Date(Date.now() - 1000).toISOString() }, error: null }],
      }),
    );
    const response = await GET(new Request(`${BASE_URL}?token=expired-token`));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "Esta invitación expiró." });
  });

  it("returns 410 when the invitation was already accepted", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeSchemaClient({
        invitations: [{ data: { ...VALID_INVITATION, accepted_at: "2026-01-01T00:00:00Z" }, error: null }],
      }),
    );
    const response = await GET(new Request(`${BASE_URL}?token=used-token`));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "Esta invitación ya fue utilizada." });
  });

  it("previews a valid, pending invitation", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeSchemaClient({ invitations: [{ data: VALID_INVITATION, error: null }] }));
    const response = await GET(new Request(`${BASE_URL}?token=good-token`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      email: "invitee@example.com",
      organizationName: "Acme Corp",
      roleName: "Member",
    });
  });
});

describe("POST /api/invitations/accept (accept)", () => {
  it("returns 400 when the token is missing from the body", async () => {
    const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });

  it("returns 401 when the caller isn't signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const response = await POST(jsonRequest(BASE_URL, { token: "good-token" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Debes iniciar sesión primero" });
  });

  it("returns 404 when no invitation matches the token", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "invitee@example.com" } } });
    createSupabaseAdminClientMock.mockReturnValue(makeSchemaClient({ invitations: [{ data: null, error: null }] }));
    const response = await POST(jsonRequest(BASE_URL, { token: "nope" }));
    expect(response.status).toBe(404);
  });

  it("returns 410 for an expired invitation", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "invitee@example.com" } } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeSchemaClient({
        invitations: [{ data: { ...VALID_INVITATION, expires_at: new Date(Date.now() - 1000).toISOString() }, error: null }],
      }),
    );
    const response = await POST(jsonRequest(BASE_URL, { token: "expired" }));
    expect(response.status).toBe(410);
  });

  it("returns 403 when the signed-in user's email doesn't match the invitation", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "someone-else@example.com" } } });
    createSupabaseAdminClientMock.mockReturnValue(makeSchemaClient({ invitations: [{ data: VALID_INVITATION, error: null }] }));
    const response = await POST(jsonRequest(BASE_URL, { token: "good-token" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Esta invitación es para otro correo electrónico." });
  });

  it("matches the invitation email case-insensitively", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "INVITEE@EXAMPLE.COM" } } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeSchemaClient({
        invitations: [{ data: VALID_INVITATION, error: null }],
        memberships: [{ data: null, error: null }, { data: { id: "mem-new" }, error: null }],
        membership_roles: [{ error: null }],
      }),
    );
    // Note: memberships is queried twice — once for the existing-membership
    // lookup (maybeSingle, no row) and once for the insert's .select().single().
    const response = await POST(jsonRequest(BASE_URL, { token: "good-token" }));
    expect(response.status).toBe(200);
  });

  it("creates a new membership and grants the role on a fresh accept", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "invitee@example.com" } } });
    const schemaClient = makeSchemaClient({
      invitations: [
        { data: VALID_INVITATION, error: null }, // findInvitation
        { error: null }, // final accepted_at update
      ],
      memberships: [
        { data: null, error: null }, // no existing membership
        { data: { id: "mem-new" }, error: null }, // insert().select().single()
      ],
      membership_roles: [{ error: null }], // upsert role grant
    });
    createSupabaseAdminClientMock.mockReturnValue(schemaClient);

    const response = await POST(jsonRequest(BASE_URL, { token: "good-token" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ organizationId: "org-1" });
  });

  it("reuses an existing membership instead of inserting a duplicate", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "invitee@example.com" } } });
    const schemaClient = makeSchemaClient({
      invitations: [{ data: VALID_INVITATION, error: null }, { error: null }],
      memberships: [{ data: { id: "mem-existing" }, error: null }], // already a member — only one memberships call
      membership_roles: [{ error: null }],
    });
    createSupabaseAdminClientMock.mockReturnValue(schemaClient);

    const response = await POST(jsonRequest(BASE_URL, { token: "good-token" }));
    expect(response.status).toBe(200);
    // Only the existing-membership lookup should have hit `memberships` — no insert.
    const membershipCalls = schemaClient.from.mock.calls.filter((call) => call[0] === "memberships");
    expect(membershipCalls).toHaveLength(1);
  });

  it("returns 500 and does not touch invitations when the membership insert fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "invitee@example.com" } } });
    const schemaClient = makeSchemaClient({
      invitations: [{ data: VALID_INVITATION, error: null }],
      memberships: [
        { data: null, error: null },
        { data: null, error: { message: "insert failed" } },
      ],
    });
    createSupabaseAdminClientMock.mockReturnValue(schemaClient);

    const response = await POST(jsonRequest(BASE_URL, { token: "good-token" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "insert failed" });
    expect(logErrorMock).toHaveBeenCalledWith("POST /api/invitations/accept", { message: "insert failed" }, { organizationId: "org-1" });
    // The invitations table must only have been touched once — the initial
    // lookup — never the accepted_at update, since the membership never landed.
    const invitationsCalls = schemaClient.from.mock.calls.filter((call) => call[0] === "invitations");
    expect(invitationsCalls).toHaveLength(1);
  });

  /**
   * Regression test for the bug fixed in commit 717bf03: if the role-grant
   * upsert (membership_roles) fails after the membership row was already
   * created/found, the route must return 500 and must NOT mark the
   * invitation as accepted — otherwise the invitee ends up a member with no
   * role, and the invitation link is burned so they can't retry.
   */
  it("returns 500 and does NOT mark the invitation accepted when the role-grant upsert fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "invitee@example.com" } } });
    const schemaClient = makeSchemaClient({
      invitations: [{ data: VALID_INVITATION, error: null }],
      memberships: [
        { data: null, error: null }, // no existing membership
        { data: { id: "mem-new" }, error: null }, // membership created
      ],
      membership_roles: [{ error: { message: "role grant upsert failed" } }],
    });
    createSupabaseAdminClientMock.mockReturnValue(schemaClient);

    const response = await POST(jsonRequest(BASE_URL, { token: "good-token" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "role grant upsert failed" });
    expect(logErrorMock).toHaveBeenCalledWith(
      "POST /api/invitations/accept (role grant)",
      { message: "role grant upsert failed" },
      { organizationId: "org-1", roleId: "role-1" },
    );
    // The critical assertion: invitations must be touched only for the
    // initial lookup, never for the accepted_at update — the bug this
    // guards against silently marked the invitation accepted anyway.
    const invitationsCalls = schemaClient.from.mock.calls.filter((call) => call[0] === "invitations");
    expect(invitationsCalls).toHaveLength(1);
  });
});
