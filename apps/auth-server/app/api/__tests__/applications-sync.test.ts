import { hashApplicationApiKey } from "@kontrolia/db";
import { beforeEach, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { makeSchemaClient } from "./test-helpers";

// Light coverage: this is a machine-to-machine endpoint (an application's
// deploy pipeline, not a browser), authenticated by one of an application's
// active kapp_ keys (application_api_keys) rather than a user session.
// hashApplicationApiKey() is a plain sha256 helper (packages/db/src/api-key.ts)
// — used for real here rather than mocked, since it's pure and deterministic.
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

function ownerKeyClient(overrides: { permissions?: unknown[] } = {}) {
  return makeSchemaClient({
    applications: [{ data: { id: "app-1", owner_organization_id: "org-1" }, error: null }],
    application_api_keys: [{ data: [{ id: "key-1", organization_id: "org-1", key_hash: KEY_HASH }], error: null }],
    ...(overrides.permissions ? { permissions: overrides.permissions } : {}),
  });
}

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
  logErrorMock.mockReset();
  logSecurityEventMock.mockReset();
  resetRateLimitsForTests();
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

it("returns 401 when the API key doesn't match any active key, and logs the attempt", async () => {
  createSupabaseAdminClientMock.mockReturnValue(ownerKeyClient());
  const response = await POST(requestWithKey("kapp_wrong-key", { slug: "faqturia", permissions: [] }));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "Clave inválida" });
  expect(logSecurityEventMock).toHaveBeenCalledWith("applications/sync: invalid key", { slug: "faqturia", ip: null });
});

it("returns 403 when the application has no active key at all, and logs the attempt", async () => {
  createSupabaseAdminClientMock.mockReturnValue(
    makeSchemaClient({
      applications: [{ data: { id: "app-1", owner_organization_id: "org-1" }, error: null }],
      application_api_keys: [{ data: [], error: null }],
    }),
  );
  const response = await POST(requestWithKey(PLAINTEXT_KEY, { slug: "faqturia", permissions: [] }));
  expect(response.status).toBe(403);
  expect(logSecurityEventMock).toHaveBeenCalledWith("applications/sync: no active key configured", {
    slug: "faqturia",
    ip: null,
  });
});

it("syncs the permission catalog and returns the generated permission keys", async () => {
  createSupabaseAdminClientMock.mockReturnValue(
    ownerKeyClient({ permissions: [{ error: null }, { error: null }] }),
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

it("a key scoped to a non-owner organization can still sync the (global) permission catalog", async () => {
  createSupabaseAdminClientMock.mockReturnValue(
    makeSchemaClient({
      applications: [{ data: { id: "app-1", owner_organization_id: "org-1" }, error: null }],
      application_api_keys: [{ data: [{ id: "key-2", organization_id: "org-2", key_hash: KEY_HASH }], error: null }],
      permissions: [{ error: null }],
    }),
  );
  const response = await POST(
    requestWithKey(PLAINTEXT_KEY, { slug: "faqturia", permissions: [{ resource: "facturas", action: "crear" }] }),
  );
  expect(response.status).toBe(200);
});

it("rejects a name/environment update from a key scoped to a non-owner organization", async () => {
  createSupabaseAdminClientMock.mockReturnValue(
    makeSchemaClient({
      applications: [{ data: { id: "app-1", owner_organization_id: "org-1" }, error: null }],
      application_api_keys: [{ data: [{ id: "key-2", organization_id: "org-2", key_hash: KEY_HASH }], error: null }],
    }),
  );
  const response = await POST(
    requestWithKey(PLAINTEXT_KEY, { slug: "faqturia", name: "Renamed", permissions: [] }),
  );
  expect(response.status).toBe(403);
});

it("includes the client IP (from X-Forwarded-For) in the security log", async () => {
  createSupabaseAdminClientMock.mockReturnValue(ownerKeyClient());
  const request = new Request(BASE_URL, {
    method: "POST",
    headers: { Authorization: "Bearer kapp_wrong-key", "X-Forwarded-For": "203.0.113.7, 10.0.0.1" },
    body: JSON.stringify({ slug: "faqturia", permissions: [] }),
  });
  await POST(request);
  expect(logSecurityEventMock).toHaveBeenCalledWith("applications/sync: invalid key", {
    slug: "faqturia",
    ip: "203.0.113.7",
  });
});

it("rate limits after too many requests from the same IP within the window", async () => {
  createSupabaseAdminClientMock.mockReturnValue(
    makeSchemaClient({ applications: [{ data: null, error: null }] }),
  );
  const makeRequest = () =>
    new Request(BASE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${PLAINTEXT_KEY}`, "X-Forwarded-For": "198.51.100.9" },
      body: JSON.stringify({ slug: "faqturia", permissions: [] }),
    });

  for (let i = 0; i < 30; i++) {
    const response = await POST(makeRequest());
    expect(response.status).not.toBe(429);
  }

  const limited = await POST(makeRequest());
  expect(limited.status).toBe(429);
  expect(limited.headers.get("Retry-After")).toBeTruthy();
  expect(logSecurityEventMock).toHaveBeenCalledWith("applications/sync: rate limited", { ip: "198.51.100.9" });
});

it("returns 500 and logs when a permission upsert fails partway through", async () => {
  createSupabaseAdminClientMock.mockReturnValue(
    ownerKeyClient({ permissions: [{ error: { message: "upsert failed" } }] }),
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
