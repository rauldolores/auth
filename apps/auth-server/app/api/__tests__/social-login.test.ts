import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

// Covers: the platform-admin gate, the "managementApiAvailable" fallback
// (self-hosted / no SUPABASE_MANAGEMENT_API_TOKEN — read-only live status,
// no write path), and the PATCH validation that keeps a first-time "enable"
// from ever reaching Supabase without a Client ID + Secret while letting a
// bare toggle or a disable through without them.
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

// Defaults to "no OAuth connection" so the existing static-token-only tests
// below exercise exactly the path they say they do — supabase-management.ts
// tries this first and only falls back to SUPABASE_MANAGEMENT_API_TOKEN
// when it resolves to null.
const getOauthAccessTokenMock = vi.fn();
vi.mock("@/lib/supabase-oauth-connection", () => ({
  getValidAccessToken: (...args: unknown[]) => getOauthAccessTokenMock(...args),
}));

const fetchMock = vi.fn();

const { GET, PATCH } = await import("../social-login/route");

const BASE_URL = "https://auth.example.com/api/social-login";
const CLOUD_URL = "https://abcdefgh.supabase.co";
const SELF_HOSTED_URL = "http://localhost:54321";

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

function gotrueSettingsResponse(google: boolean, azure: boolean) {
  return new Response(JSON.stringify({ external: { google, azure } }), { status: 200 });
}

function managementConfigResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      external_google_enabled: false,
      external_google_client_id: null,
      external_azure_enabled: false,
      external_azure_client_id: null,
      external_azure_url: null,
      ...overrides,
    }),
    { status: 200 },
  );
}

beforeEach(() => {
  verifyRequestMock.mockReset();
  logErrorMock.mockReset();
  logSecurityEventMock.mockReset();
  fetchMock.mockReset();
  getOauthAccessTokenMock.mockReset();
  getOauthAccessTokenMock.mockResolvedValue(null);
  global.fetch = fetchMock as unknown as typeof fetch;
  resetRateLimitsForTests();
  vi.stubEnv("SUPABASE_URL", CLOUD_URL);
  vi.stubEnv("SUPABASE_MANAGEMENT_API_TOKEN", "mgmt-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("platform-admin gate", () => {
  it("GET returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(401);
  });

  it("GET returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false } });
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(403);
  });

  it("rate limits after too many requests from the same IP within the window", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false } });
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

describe("GET /api/social-login", () => {
  it("reports managementApiAvailable: false and live-only status on a self-hosted deployment (no matching project ref)", async () => {
    vi.stubEnv("SUPABASE_URL", SELF_HOSTED_URL);
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockResolvedValue(gotrueSettingsResponse(true, false));

    const response = await GET(requestWithAuth(BASE_URL));
    const body = await response.json();

    expect(body.managementApiAvailable).toBe(false);
    expect(body.google).toEqual({ liveEnabled: true, configured: false, clientId: null });
    expect(body.azure).toEqual({ liveEnabled: false, configured: false, clientId: null, tenantUrl: null });
    // Only the GoTrue settings call should have happened — no Management API call without a usable project ref.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports managementApiAvailable: false when neither the OAuth connection nor the token is set, even on a Cloud URL", async () => {
    vi.stubEnv("SUPABASE_MANAGEMENT_API_TOKEN", "");
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockResolvedValue(gotrueSettingsResponse(false, false));

    const response = await GET(requestWithAuth(BASE_URL));
    const body = await response.json();
    expect(body.managementApiAvailable).toBe(false);
  });

  it("prefers the OAuth connection's token over the static SUPABASE_MANAGEMENT_API_TOKEN when both are available", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    getOauthAccessTokenMock.mockResolvedValue("oauth-access-token");
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/v1/settings")) return Promise.resolve(gotrueSettingsResponse(true, false));
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer oauth-access-token");
      return Promise.resolve(managementConfigResponse({ external_google_enabled: true, external_google_client_id: "g-client-1" }));
    });

    const response = await GET(requestWithAuth(BASE_URL));
    const body = await response.json();
    expect(body.managementApiAvailable).toBe(true);
    expect(body.google.configured).toBe(true);
  });

  it("still works via the static token when the OAuth connection is absent", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    getOauthAccessTokenMock.mockResolvedValue(null);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/v1/settings")) return Promise.resolve(gotrueSettingsResponse(true, false));
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer mgmt-token");
      return Promise.resolve(managementConfigResponse({ external_google_enabled: true, external_google_client_id: "g-client-1" }));
    });

    const response = await GET(requestWithAuth(BASE_URL));
    const body = await response.json();
    expect(body.managementApiAvailable).toBe(true);
  });

  it("merges live GoTrue status with Management API config when both are available", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/auth/v1/settings")
          ? gotrueSettingsResponse(true, false)
          : managementConfigResponse({ external_google_enabled: true, external_google_client_id: "g-client-1" }),
      ),
    );

    const response = await GET(requestWithAuth(BASE_URL));
    const body = await response.json();

    expect(body.managementApiAvailable).toBe(true);
    expect(body.google).toEqual({ liveEnabled: true, configured: true, clientId: "g-client-1" });
    expect(body.azure).toEqual({ liveEnabled: false, configured: false, clientId: null, tenantUrl: null });
  });

  it("sends the apikey header on the GoTrue settings call — Supabase Cloud's gateway rejects the request without it", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-123");
    fetchMock.mockResolvedValue(gotrueSettingsResponse(false, false));

    await GET(requestWithAuth(BASE_URL));

    const settingsCall = fetchMock.mock.calls.find(([url]) => (url as string).includes("/auth/v1/settings"));
    expect(settingsCall).toBeTruthy();
    const [, init] = settingsCall!;
    expect((init?.headers as Record<string, string>).apikey).toBe("anon-key-123");
  });

  it("returns live-disabled (not a thrown error) and logs when GoTrue rejects the settings request", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/auth/v1/settings")
          ? new Response(JSON.stringify({ message: "No API key found in request" }), { status: 401 })
          : managementConfigResponse(),
      ),
    );

    const response = await GET(requestWithAuth(BASE_URL));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.google.liveEnabled).toBe(false);
    expect(body.azure.liveEnabled).toBe(false);
    expect(logErrorMock).toHaveBeenCalledWith("gotrue-settings:getGotrueExternalSettings", expect.objectContaining({ status: 401 }));
  });
});

describe("PATCH /api/social-login", () => {
  it("returns 400 for an unknown provider", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const response = await PATCH(requestWithAuth(`${BASE_URL}?provider=facebook`, { method: "PATCH", body: JSON.stringify({ enabled: true }) }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when the Management API isn't configured for this deployment", async () => {
    vi.stubEnv("SUPABASE_URL", SELF_HOSTED_URL);
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?provider=google`, { method: "PATCH", body: JSON.stringify({ enabled: true, clientId: "x", secret: "y" }) }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/SUPABASE_MANAGEMENT_API_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when enabled isn't a boolean", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const response = await PATCH(requestWithAuth(`${BASE_URL}?provider=google`, { method: "PATCH", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when enabling for the first time without a Client ID", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockResolvedValue(managementConfigResponse());
    const response = await PATCH(requestWithAuth(`${BASE_URL}?provider=google`, { method: "PATCH", body: JSON.stringify({ enabled: true }) }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Client ID/);
  });

  it("returns 400 when enabling for the first time with a Client ID but no Secret", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockResolvedValue(managementConfigResponse());
    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?provider=google`, { method: "PATCH", body: JSON.stringify({ enabled: true, clientId: "g-client-1" }) }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Client Secret/);
  });

  it("activates a provider for the first time, sending a whitelisted patch body to Supabase", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/v1/settings")) return Promise.resolve(gotrueSettingsResponse(true, false));
      if (init?.method === "PATCH") return Promise.resolve(new Response(null, { status: 200 }));
      return Promise.resolve(managementConfigResponse({ external_google_enabled: true, external_google_client_id: "g-client-1" }));
    });

    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?provider=google`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: true, clientId: "g-client-1", secret: "g-secret-1" }),
      }),
    );

    expect(response.status).toBe(200);
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall).toBeTruthy();
    const [patchUrl, patchInit] = patchCall!;
    expect(patchUrl).toBe("https://api.supabase.com/v1/projects/abcdefgh/config/auth");
    expect(JSON.parse(patchInit.body as string)).toEqual({
      external_google_enabled: true,
      external_google_client_id: "g-client-1",
      external_google_secret: "g-secret-1",
    });
    expect(logSecurityEventMock).toHaveBeenCalledWith("social-login: provider updated", { provider: "google", enabled: true });
  });

  it("disables a provider without requiring Client ID or Secret", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/v1/settings")) return Promise.resolve(gotrueSettingsResponse(false, false));
      if (init?.method === "PATCH") return Promise.resolve(new Response(null, { status: 200 }));
      return Promise.resolve(managementConfigResponse({ external_google_enabled: false, external_google_client_id: "g-client-1" }));
    });

    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?provider=google`, { method: "PATCH", body: JSON.stringify({ enabled: false }) }),
    );
    expect(response.status).toBe(200);
    const [, patchInit] = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(JSON.parse(patchInit.body as string)).toEqual({ external_google_enabled: false });
  });

  it("toggles an already-configured provider back on without re-sending the secret", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/v1/settings")) return Promise.resolve(gotrueSettingsResponse(true, false));
      if (init?.method === "PATCH") return Promise.resolve(new Response(null, { status: 200 }));
      return Promise.resolve(managementConfigResponse({ external_google_enabled: true, external_google_client_id: "g-client-1" }));
    });

    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?provider=google`, { method: "PATCH", body: JSON.stringify({ enabled: true }) }),
    );
    expect(response.status).toBe(200);
    const [, patchInit] = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(JSON.parse(patchInit.body as string)).toEqual({ external_google_enabled: true });
  });

  it("returns 502 when Supabase's Management API rejects the update", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return Promise.resolve(new Response(JSON.stringify({ message: "invalid client_id" }), { status: 400 }));
      return Promise.resolve(managementConfigResponse());
    });

    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?provider=google`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: true, clientId: "g-client-1", secret: "g-secret-1" }),
      }),
    );
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("invalid client_id");
  });

  it("builds the azure patch with the tenant URL field", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/v1/settings")) return Promise.resolve(gotrueSettingsResponse(false, true));
      if (init?.method === "PATCH") return Promise.resolve(new Response(null, { status: 200 }));
      return Promise.resolve(managementConfigResponse({ external_azure_enabled: true, external_azure_client_id: "az-client-1" }));
    });

    const response = await PATCH(
      requestWithAuth(`${BASE_URL}?provider=azure`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: true,
          clientId: "az-client-1",
          secret: "az-secret-1",
          tenantUrl: "https://login.microsoftonline.com/tenant-id/v2.0",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const [, patchInit] = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(JSON.parse(patchInit.body as string)).toEqual({
      external_azure_enabled: true,
      external_azure_client_id: "az-client-1",
      external_azure_secret: "az-secret-1",
      external_azure_url: "https://login.microsoftonline.com/tenant-id/v2.0",
    });
  });
});
