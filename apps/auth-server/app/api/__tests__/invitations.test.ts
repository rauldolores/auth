import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSchemaClient } from "./test-helpers";

// Light coverage: this route's real access control lives entirely in the
// "org admins manage invitations" RLS policy (per its own doc comment), so
// there's little branching logic here beyond input validation and
// forwarding the DB result — unlike the priority routes, it doesn't need
// exhaustive scenario coverage.
const supabaseClientMock = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  createRouteHandlerSupabaseClient: async () => supabaseClientMock(),
}));

const BASE_URL = "https://auth.example.com/api/invitations";

const { POST } = await import("../invitations/route");

beforeEach(() => {
  supabaseClientMock.mockReset();
});

describe("POST /api/invitations", () => {
  it("returns 400 when organizationId or email is missing", async () => {
    supabaseClientMock.mockReturnValue(makeSchemaClient({}));
    const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({ organizationId: "org-1" }) }));
    expect(response.status).toBe(400);
  });

  it("creates an invitation and returns its token", async () => {
    supabaseClientMock.mockReturnValue(
      makeSchemaClient({
        invitations: [
          {
            data: { id: "inv-1", email: "new@example.com", token: "tok-abc", expires_at: "2026-02-01T00:00:00Z" },
            error: null,
          },
        ],
      }),
    );
    const response = await POST(
      new Request(BASE_URL, {
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
    supabaseClientMock.mockReturnValue(
      makeSchemaClient({ invitations: [{ data: null, error: { message: "new row violates row-level security policy" } }] }),
    );
    const response = await POST(
      new Request(BASE_URL, { method: "POST", body: JSON.stringify({ organizationId: "org-1", email: "new@example.com" }) }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "new row violates row-level security policy" });
  });
});
