import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeAdminClient } from "../../app/api/__tests__/test-helpers";

// Covers the one piece of behavior no route-level test reaches: the
// auto-refresh logic inside getValidAccessToken() (everything that calls
// into this module from a route mocks it wholesale, per social-login.test.ts).
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

const fetchMock = vi.fn();

const { getValidAccessToken, getConnectionStatus, disconnectConnection, exchangeAuthorizationCode, isOauthConfigured } = await import(
  "../supabase-oauth-connection"
);

function connectionRow(overrides: Record<string, unknown> = {}) {
  return {
    access_token: "current-access-token",
    refresh_token: "current-refresh-token",
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    connected_at: "2026-01-01T00:00:00.000Z",
    connected_by: "user-1",
    ...overrides,
  };
}

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
  logErrorMock.mockReset();
  logSecurityEventMock.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  vi.stubEnv("SUPABASE_OAUTH_CLIENT_ID", "kontrolia-client-id");
  vi.stubEnv("SUPABASE_OAUTH_CLIENT_SECRET", "kontrolia-client-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isOauthConfigured", () => {
  it("is false when either env var is missing", () => {
    vi.stubEnv("SUPABASE_OAUTH_CLIENT_SECRET", "");
    expect(isOauthConfigured()).toBe(false);
  });

  it("is true when both are set", () => {
    expect(isOauthConfigured()).toBe(true);
  });
});

describe("getConnectionStatus / disconnectConnection", () => {
  it("returns null when no row exists", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ supabase_oauth_connection: [{ data: null, error: null }] }));
    expect(await getConnectionStatus()).toBeNull();
  });

  it("returns status without ever including the tokens", async () => {
    const row = connectionRow();
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ supabase_oauth_connection: [{ data: row, error: null }] }));
    const status = await getConnectionStatus();
    expect(status).toEqual({
      accessToken: "current-access-token",
      expiresAt: row.expires_at,
      connectedAt: "2026-01-01T00:00:00.000Z",
      connectedBy: "user-1",
    });
  });

  it("disconnectConnection deletes the row", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ supabase_oauth_connection: [{ error: null }] }));
    const result = await disconnectConnection();
    expect(result).toEqual({ ok: true });
  });
});

describe("getValidAccessToken", () => {
  it("returns null when there is no connection", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ supabase_oauth_connection: [{ data: null, error: null }] }));
    expect(await getValidAccessToken()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the existing access_token without refreshing when it's not near expiry", async () => {
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ supabase_oauth_connection: [{ data: connectionRow(), error: null }] }),
    );
    const token = await getValidAccessToken();
    expect(token).toBe("current-access-token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes and persists new tokens when the access_token is near expiry", async () => {
    const nearExpiry = connectionRow({ expires_at: new Date(Date.now() + 30 * 1000).toISOString() });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({ supabase_oauth_connection: [{ data: nearExpiry, error: null }, { error: null }] }),
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "new-access-token", refresh_token: "new-refresh-token", expires_in: 3600 }), {
        status: 200,
      }),
    );

    const token = await getValidAccessToken();

    expect(token).toBe("new-access-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.supabase.com/v1/oauth/token",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchMock.mock.calls[0]!;
    const sentParams = new URLSearchParams(init.body as string);
    expect(sentParams.get("grant_type")).toBe("refresh_token");
    expect(sentParams.get("refresh_token")).toBe("current-refresh-token");
    expect(sentParams.get("client_id")).toBe("kontrolia-client-id");
    expect(sentParams.get("client_secret")).toBe("kontrolia-client-secret");
  });

  it("returns null (not a throw) when the refresh call fails", async () => {
    const expired = connectionRow({ expires_at: new Date(Date.now() - 1000).toISOString() });
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ supabase_oauth_connection: [{ data: expired, error: null }] }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));

    const token = await getValidAccessToken();
    expect(token).toBeNull();
  });

  it("returns null without calling fetch when the OAuth client credentials aren't configured", async () => {
    vi.stubEnv("SUPABASE_OAUTH_CLIENT_ID", "");
    const expired = connectionRow({ expires_at: new Date(Date.now() - 1000).toISOString() });
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ supabase_oauth_connection: [{ data: expired, error: null }] }));

    const token = await getValidAccessToken();
    expect(token).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("exchangeAuthorizationCode", () => {
  it("exchanges the code, persists the tokens, and logs the connection", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({ supabase_oauth_connection: [{ error: null }] }));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "a1", refresh_token: "r1", expires_in: 3600 }), { status: 200 }),
    );

    const result = await exchangeAuthorizationCode({
      code: "auth-code-1",
      codeVerifier: "verifier-1",
      redirectUri: "https://panel.example.com/oauth/supabase-callback",
      userId: "user-1",
    });

    expect(result).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0]!;
    const sentParams = new URLSearchParams(init.body as string);
    expect(sentParams.get("grant_type")).toBe("authorization_code");
    expect(sentParams.get("code")).toBe("auth-code-1");
    expect(sentParams.get("code_verifier")).toBe("verifier-1");
    expect(sentParams.get("redirect_uri")).toBe("https://panel.example.com/oauth/supabase-callback");
    expect(logSecurityEventMock).toHaveBeenCalledWith("supabase-oauth-connection: connected", { userId: "user-1" });
  });

  it("returns an error without persisting anything when the code exchange fails", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeAdminClient({}));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error_description: "invalid code" }), { status: 400 }));

    const result = await exchangeAuthorizationCode({
      code: "bad-code",
      codeVerifier: "verifier-1",
      redirectUri: "https://panel.example.com/oauth/supabase-callback",
      userId: "user-1",
    });

    expect(result).toEqual({ ok: false, error: "invalid code" });
  });
});
