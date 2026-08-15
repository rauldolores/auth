import { beforeEach, describe, expect, it, vi } from "vitest";

// Covers the two bugs this route had: it read a `redirect` query param that
// nothing ever set (the real name used everywhere else in this app is
// `redirect_to`), so a signed-in Google/Microsoft user always landed on "/"
// regardless of where they were trying to go — and separately, before this
// fix, it built the final redirect with a bare `new URL(value, origin)`,
// which returns `value` unmodified whenever it's already an absolute URL,
// so `?redirect_to=https://evil.example` would have been honored with zero
// allowlist check (an open redirect).
const exchangeCodeForSessionMock = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  createRouteHandlerSupabaseClient: () => ({
    auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
  }),
}));

const { GET } = await import("../route");

beforeEach(() => {
  exchangeCodeForSessionMock.mockReset();
  vi.stubEnv("NEXT_PUBLIC_AUTH_SERVER_URL", "https://auth.example.com");
  vi.stubEnv("NEXT_PUBLIC_ADMIN_PANEL_URL", "https://panel.example.com");
});

describe("GET /auth/callback", () => {
  it("exchanges the code for a session and redirects to '/' when no redirect_to is given", async () => {
    const response = await GET(new Request("https://auth.example.com/auth/callback?code=abc123"));
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://auth.example.com/");
  });

  it("redirects to a trusted same-origin redirect_to", async () => {
    const redirectTo = encodeURIComponent("https://auth.example.com/security");
    const response = await GET(new Request(`https://auth.example.com/auth/callback?code=abc123&redirect_to=${redirectTo}`));
    expect(response.headers.get("location")).toBe("https://auth.example.com/security");
  });

  it("redirects across to a trusted admin-panel redirect_to", async () => {
    const redirectTo = encodeURIComponent("https://panel.example.com/dashboard");
    const response = await GET(new Request(`https://auth.example.com/auth/callback?code=abc123&redirect_to=${redirectTo}`));
    expect(response.headers.get("location")).toBe("https://panel.example.com/dashboard");
  });

  it("falls back to '/' for an untrusted redirect_to instead of following it (open-redirect protection)", async () => {
    const redirectTo = encodeURIComponent("https://evil.example/phish");
    const response = await GET(new Request(`https://auth.example.com/auth/callback?code=abc123&redirect_to=${redirectTo}`));
    expect(response.headers.get("location")).toBe("https://auth.example.com/");
  });

  it("ignores the old `redirect` param name — it must be redirect_to", async () => {
    const redirectTo = encodeURIComponent("https://auth.example.com/security");
    const response = await GET(new Request(`https://auth.example.com/auth/callback?code=abc123&redirect=${redirectTo}`));
    expect(response.headers.get("location")).toBe("https://auth.example.com/");
  });

  it("still redirects even without a code (defensive — GoTrue is expected to always include one)", async () => {
    const response = await GET(new Request("https://auth.example.com/auth/callback"));
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://auth.example.com/");
  });
});
