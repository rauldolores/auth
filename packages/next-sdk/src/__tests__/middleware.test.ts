import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthMiddlewareConfig } from "../middleware.js";

// The middleware never touches Supabase's network protocol directly — it
// calls createServerClient() from @supabase/ssr and drives the returned
// client's auth.getUser() / auth.mfa.getAuthenticatorAssuranceLevel(). Mock
// that module entirely so tests exercise the middleware's own routing logic
// (protected/guest rules, MFA gate, redirects) without needing a real
// Supabase project.
const getUserMock = vi.fn();
const getAALMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
      mfa: { getAuthenticatorAssuranceLevel: getAALMock },
    },
  })),
}));

const { createAuthMiddleware } = await import("../middleware.js");

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "https://app.example.com"));
}

const baseConfig: AuthMiddlewareConfig = {
  supabaseUrl: "https://project.supabase.co",
  supabaseAnonKey: "anon-key",
  rules: [
    { pathPrefix: "/dashboard", mode: "protected", redirectTo: "/login" },
    { pathPrefix: "/login", mode: "guest", redirectTo: "/dashboard" },
  ],
};

function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400 && response.headers.get("location") !== null;
}

describe("createAuthMiddleware", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getAALMock.mockReset();
    // Default: no pending MFA elevation, so tests that don't care about MFA
    // don't have to stub it every time.
    getAALMock.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  });

  it("redirects an unauthenticated request away from a protected route", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const middleware = createAuthMiddleware(baseConfig);

    const response = await middleware(makeRequest("/dashboard/settings"));

    expect(isRedirect(response)).toBe(true);
    expect(response.headers.get("location")).toBe("https://app.example.com/login");
  });

  it("passes an authenticated request through to a protected route", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const middleware = createAuthMiddleware(baseConfig);

    const response = await middleware(makeRequest("/dashboard/settings"));

    expect(isRedirect(response)).toBe(false);
  });

  it("redirects an authenticated user away from a guest-only route", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const middleware = createAuthMiddleware(baseConfig);

    const response = await middleware(makeRequest("/login"));

    expect(isRedirect(response)).toBe(true);
    expect(response.headers.get("location")).toBe("https://app.example.com/dashboard");
  });

  it("passes an unauthenticated request through to a guest route", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const middleware = createAuthMiddleware(baseConfig);

    const response = await middleware(makeRequest("/login"));

    expect(isRedirect(response)).toBe(false);
  });

  it("passes requests to unmatched routes through regardless of auth state", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const middleware = createAuthMiddleware(baseConfig);

    const response = await middleware(makeRequest("/public/about"));

    expect(isRedirect(response)).toBe(false);
  });

  it("redirects to the MFA challenge path when aal2 elevation is pending", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getAALMock.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    const middleware = createAuthMiddleware({ ...baseConfig, mfaChallengePath: "/mfa-challenge" });

    const response = await middleware(makeRequest("/dashboard/settings"));

    expect(isRedirect(response)).toBe(true);
    expect(response.headers.get("location")).toBe("https://app.example.com/mfa-challenge");
  });

  it("does not redirect-loop once already on the MFA challenge path", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getAALMock.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    const middleware = createAuthMiddleware({ ...baseConfig, mfaChallengePath: "/mfa-challenge" });

    const response = await middleware(makeRequest("/mfa-challenge"));

    expect(isRedirect(response)).toBe(false);
  });

  it("does not gate on MFA when a fully-elevated (aal2) session hits a protected route", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getAALMock.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    const middleware = createAuthMiddleware({ ...baseConfig, mfaChallengePath: "/mfa-challenge" });

    const response = await middleware(makeRequest("/dashboard/settings"));

    expect(isRedirect(response)).toBe(false);
  });
});
