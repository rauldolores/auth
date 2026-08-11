import { hashApplicationApiKey } from "@kontrolia/db";
import { beforeEach, expect, it, vi } from "vitest";
import { makeSchemaClient } from "./test-helpers";

// Light coverage: this is a machine-to-machine endpoint (an application's
// deploy pipeline, not a browser), authenticated by a per-application API
// key rather than a user session. hashApplicationApiKey() is a plain sha256
// helper (packages/db/src/api-key.ts) — used for real here rather than
// mocked, since it's pure and deterministic.
const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const logErrorMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

const { POST } = await import("../applications/sync/route");

const BASE_URL = "https://auth.example.com/api/applications/sync";
const PLAINTEXT_KEY = "kapp_test-key";
const KEY_HASH = hashApplicationApiKey(PLAINTEXT_KEY);

function requestWithKey(key: string, body: unknown): Request {
  return new Request(BASE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
  logErrorMock.mockReset();
});

it("returns 401 when no Authorization header is present", async () => {
  const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({ slug: "faqturia", permissions: [] }) }));
  expect(response.status).toBe(401);
});

it("returns 400 when slug or permissions are missing", async () => {
  const response = await POST(requestWithKey(PLAINTEXT_KEY, { slug: "faqturia" }));
  expect(response.status).toBe(400);
});

it("returns 404 when no application matches the slug", async () => {
  createSupabaseAdminClientMock.mockReturnValue(makeSchemaClient({ applications: [{ data: null, error: null }] }));
  const response = await POST(requestWithKey(PLAINTEXT_KEY, { slug: "unknown-app", permissions: [] }));
  expect(response.status).toBe(404);
});

it("returns 401 when the API key doesn't match the stored hash", async () => {
  createSupabaseAdminClientMock.mockReturnValue(
    makeSchemaClient({ applications: [{ data: { id: "app-1", api_key_hash: KEY_HASH }, error: null }] }),
  );
  const response = await POST(requestWithKey("kapp_wrong-key", { slug: "faqturia", permissions: [] }));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "Clave inválida" });
});

it("returns 403 when the application has never been given a sync key", async () => {
  createSupabaseAdminClientMock.mockReturnValue(
    makeSchemaClient({ applications: [{ data: { id: "app-1", api_key_hash: null }, error: null }] }),
  );
  const response = await POST(requestWithKey(PLAINTEXT_KEY, { slug: "faqturia", permissions: [] }));
  expect(response.status).toBe(403);
});

it("syncs the permission catalog and returns the generated permission keys", async () => {
  createSupabaseAdminClientMock.mockReturnValue(
    makeSchemaClient({
      applications: [{ data: { id: "app-1", api_key_hash: KEY_HASH }, error: null }],
      permissions: [{ error: null }, { error: null }],
    }),
  );
  const response = await POST(
    requestWithKey(PLAINTEXT_KEY, {
      slug: "faqturia",
      permissions: [
        { resource: "facturas", action: "crear" },
        { resource: "facturas", action: "leer" },
      ],
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    applicationId: "app-1",
    permissionKeys: ["faqturia.facturas.crear", "faqturia.facturas.leer"],
  });
});

it("returns 500 and logs when a permission upsert fails partway through", async () => {
  createSupabaseAdminClientMock.mockReturnValue(
    makeSchemaClient({
      applications: [{ data: { id: "app-1", api_key_hash: KEY_HASH }, error: null }],
      permissions: [{ error: { message: "upsert failed" } }],
    }),
  );
  const response = await POST(
    requestWithKey(PLAINTEXT_KEY, { slug: "faqturia", permissions: [{ resource: "facturas", action: "crear" }] }),
  );
  expect(response.status).toBe(500);
  expect(logErrorMock).toHaveBeenCalledWith(
    "POST /api/applications/sync",
    { message: "upsert failed" },
    { slug: "faqturia", permissionKey: "faqturia.facturas.crear" },
  );
});
