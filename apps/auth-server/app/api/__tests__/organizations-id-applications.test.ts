import { beforeEach, expect, it, vi } from "vitest";
import { makeSchemaClient } from "./test-helpers";

// Light coverage: one meaningful branch (org admin sees every enabled app,
// everyone else only sees apps they hold an app-scoped role for) plus auth.
const getUserMock = vi.fn();
const schemaClientHolder: { current: ReturnType<typeof makeSchemaClient> | null } = { current: null };
vi.mock("@/lib/supabase-server", () => ({
  createRouteHandlerSupabaseClient: async () => ({
    auth: { getUser: getUserMock },
    ...schemaClientHolder.current,
  }),
}));

const { GET } = await import("../organizations/[id]/applications/route");

const params = Promise.resolve({ id: "org-1" });
const BASE_URL = "https://auth.example.com/api/organizations/org-1/applications";

const APPS = [
  { applications: { id: "app-1", name: "Faqturia", slug: "faqturia", homepage_url: null } },
  { applications: { id: "app-2", name: "Otra App", slug: "otra", homepage_url: null } },
];

beforeEach(() => {
  getUserMock.mockReset();
  schemaClientHolder.current = null;
});

it("returns 401 when not signed in", async () => {
  getUserMock.mockResolvedValue({ data: { user: null } });
  const response = await GET(new Request(BASE_URL), { params });
  expect(response.status).toBe(401);
});

it("returns an empty list when the caller has no membership in this org", async () => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  schemaClientHolder.current = makeSchemaClient({ memberships: [{ data: null, error: null }] });
  const response = await GET(new Request(BASE_URL), { params });
  expect(await response.json()).toEqual({ applications: [] });
});

it("an Owner/Admin sees every application enabled for the org, regardless of app-scoped roles", async () => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  schemaClientHolder.current = makeSchemaClient({
    memberships: [{ data: { membership_roles: [{ roles: { slug: "owner", application_id: null } }] }, error: null }],
    application_organizations: [{ data: APPS, error: null }],
  });
  const response = await GET(new Request(BASE_URL), { params });
  const body = await response.json();
  expect(body.applications.map((a: { slug: string }) => a.slug)).toEqual(["faqturia", "otra"]);
});

it("a regular member only sees apps they hold an app-scoped role for", async () => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  schemaClientHolder.current = makeSchemaClient({
    memberships: [{ data: { membership_roles: [{ roles: { slug: "billing_clerk", application_id: "app-1" } }] }, error: null }],
    application_organizations: [{ data: APPS, error: null }],
  });
  const response = await GET(new Request(BASE_URL), { params });
  const body = await response.json();
  expect(body.applications.map((a: { slug: string }) => a.slug)).toEqual(["faqturia"]);
});
