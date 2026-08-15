import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const verifyRequestMock = vi.fn();
vi.mock("@kontrolia/auth/server", () => ({
  verifyRequest: (...args: unknown[]) => verifyRequestMock(...args),
}));

const logSecurityEventMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logSecurityEvent: (...args: unknown[]) => logSecurityEventMock(...args),
}));

const exchangeAuthorizationCodeMock = vi.fn();
vi.mock("@/lib/supabase-oauth-connection", () => ({
  exchangeAuthorizationCode: (...args: unknown[]) => exchangeAuthorizationCodeMock(...args),
}));

const { POST } = await import("../supabase-connection/callback/route");

const BASE_URL = "https://auth.example.com/api/supabase-connection/callback";

function requestWithAuth(body: unknown, init?: RequestInit): Request {
  return new Request(BASE_URL, {
    method: "POST",
    ...init,
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json", ...init?.headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  verifyRequestMock.mockReset();
  logSecurityEventMock.mockReset();
  exchangeAuthorizationCodeMock.mockReset();
  resetRateLimitsForTests();
});

describe("platform-admin gate", () => {
  it("returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await POST(requestWithAuth({ code: "c", codeVerifier: "v", redirectUri: "https://panel.example.com/oauth/supabase-callback" }));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false, sub: "user-1" } });
    const response = await POST(requestWithAuth({ code: "c", codeVerifier: "v", redirectUri: "https://panel.example.com/oauth/supabase-callback" }));
    expect(response.status).toBe(403);
    expect(exchangeAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it("rate limits after too many requests from the same IP within the window", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false, sub: "user-1" } });
    const makeRequest = () =>
      requestWithAuth(
        { code: "c", codeVerifier: "v", redirectUri: "https://panel.example.com/oauth/supabase-callback" },
        { headers: { "X-Forwarded-For": "198.51.100.9" } },
      );

    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest());
      expect(response.status).not.toBe(429);
    }

    const limited = await POST(makeRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("POST /api/supabase-connection/callback", () => {
  it("returns 400 when code/codeVerifier/redirectUri are missing", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true, sub: "user-1" } });
    const response = await POST(requestWithAuth({ code: "c" }));
    expect(response.status).toBe(400);
    expect(exchangeAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it("exchanges the code using the caller's user id", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true, sub: "user-42" } });
    exchangeAuthorizationCodeMock.mockResolvedValue({ ok: true });

    const response = await POST(
      requestWithAuth({ code: "auth-code-1", codeVerifier: "verifier-1", redirectUri: "https://panel.example.com/oauth/supabase-callback" }),
    );

    expect(response.status).toBe(200);
    expect(exchangeAuthorizationCodeMock).toHaveBeenCalledWith({
      code: "auth-code-1",
      codeVerifier: "verifier-1",
      redirectUri: "https://panel.example.com/oauth/supabase-callback",
      userId: "user-42",
    });
  });

  it("returns 502 when the exchange fails", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true, sub: "user-1" } });
    exchangeAuthorizationCodeMock.mockResolvedValue({ ok: false, error: "invalid_grant" });

    const response = await POST(
      requestWithAuth({ code: "bad-code", codeVerifier: "v", redirectUri: "https://panel.example.com/oauth/supabase-callback" }),
    );

    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("invalid_grant");
  });
});
