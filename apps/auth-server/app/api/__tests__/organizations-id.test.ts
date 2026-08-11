import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSchemaClient } from "./test-helpers";

// Light coverage: PATCH/DELETE both delegate the actual authorization
// decision to RLS ("org admins can update", "org owners can delete") and
// just need to translate RLS's silent-filtering behavior (PGRST116 / a
// zero-row delete count) into a readable 403 — that translation is the one
// piece of real logic worth testing here.
const schemaClientHolder: { current: ReturnType<typeof makeSchemaClient> | null } = { current: null };
vi.mock("@/lib/supabase-server", () => ({
  createRouteHandlerSupabaseClient: async () => schemaClientHolder.current,
}));

const { PATCH, DELETE } = await import("../organizations/[id]/route");

const params = Promise.resolve({ id: "org-1" });
const BASE_URL = "https://auth.example.com/api/organizations/org-1";

beforeEach(() => {
  schemaClientHolder.current = null;
});

describe("PATCH /api/organizations/[id]", () => {
  it("returns 400 when name is blank", async () => {
    const response = await PATCH(new Request(BASE_URL, { method: "PATCH", body: JSON.stringify({ name: "  " }) }), { params });
    expect(response.status).toBe(400);
  });

  it("renames the organization on success", async () => {
    schemaClientHolder.current = makeSchemaClient({
      organizations: [{ data: { id: "org-1", name: "New Name", slug: "acme" }, error: null }],
    });
    const response = await PATCH(new Request(BASE_URL, { method: "PATCH", body: JSON.stringify({ name: "New Name" }) }), { params });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ organization: { id: "org-1", name: "New Name", slug: "acme" } });
  });

  it("translates RLS's PGRST116 'no rows' into a readable 403 for a non-admin caller", async () => {
    schemaClientHolder.current = makeSchemaClient({
      organizations: [{ data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } }],
    });
    const response = await PATCH(new Request(BASE_URL, { method: "PATCH", body: JSON.stringify({ name: "New Name" }) }), { params });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(/Owner y Admin/);
  });
});

describe("DELETE /api/organizations/[id]", () => {
  it("deletes the organization when the caller is Owner", async () => {
    schemaClientHolder.current = makeSchemaClient({ organizations: [{ error: null, count: 1 }] });
    const response = await DELETE(new Request(BASE_URL, { method: "DELETE" }), { params });
    expect(response.status).toBe(204);
  });

  it("returns 403 when RLS filters out the row (not Owner, or org doesn't exist)", async () => {
    schemaClientHolder.current = makeSchemaClient({ organizations: [{ error: null, count: 0 }] });
    const response = await DELETE(new Request(BASE_URL, { method: "DELETE" }), { params });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(/solo el Owner/);
  });
});
