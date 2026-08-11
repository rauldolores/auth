import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

// Light coverage: this route is a thin, platform-admin-gated proxy in front
// of GoTrue's admin OAuth-client API. The one piece of real logic worth
// testing is the platform-admin gate (shared shape with platform-admins) and
// input validation; the GoTrue proxying itself is exercised via a mocked
// global fetch.
const verifyRequestMock = vi.fn();
vi.mock("@kontrolia/auth/server", () => ({
  verifyRequest: (...args: unknown[]) => verifyRequestMock(...args),
}));

const fetchMock = vi.fn();

const { GET, POST, PUT } = await import("../oauth-clients/route");

const BASE_URL = "https://auth.example.com/api/oauth-clients";

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

beforeEach(() => {
  verifyRequestMock.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  resetRateLimitsForTests();
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

describe("GET /api/oauth-clients", () => {
  it("proxies the client list from GoTrue", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ clients: [{ client_id: "abc" }] }), { status: 200 }));
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ clients: [{ client_id: "abc" }] });
  });
});

describe("POST /api/oauth-clients", () => {
  it("returns 400 when client_name or redirect_uris are missing", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const response = await POST(requestWithAuth(BASE_URL, { method: "POST", body: JSON.stringify({ client_name: "App" }) }));
    expect(response.status).toBe(400);
  });

  it("registers a new OAuth client via GoTrue", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ client_id: "new-client" }), { status: 201 }));
    const response = await POST(
      requestWithAuth(BASE_URL, {
        method: "POST",
        body: JSON.stringify({ client_name: "App", redirect_uris: ["https://app.example.com/callback"] }),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ client_id: "new-client" });
  });

  it("normalizes GoTrue's inconsistent error shape into a readable `.error`", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 404, error_code: "oauth_server_disabled", msg: "OAuth server is disabled" }), {
        status: 404,
      }),
    );
    const response = await POST(
      requestWithAuth(BASE_URL, {
        method: "POST",
        body: JSON.stringify({ client_name: "App", redirect_uris: ["https://app.example.com/callback"] }),
      }),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("OAuth server is disabled");
  });

  it("returns 502 when GoTrue can't be reached at all", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const response = await POST(
      requestWithAuth(BASE_URL, {
        method: "POST",
        body: JSON.stringify({ client_name: "App", redirect_uris: ["https://app.example.com/callback"] }),
      }),
    );
    expect(response.status).toBe(502);
  });
});

describe("PUT /api/oauth-clients", () => {
  it("returns 400 when clientId query param is missing", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const response = await PUT(
      requestWithAuth(BASE_URL, { method: "PUT", body: JSON.stringify({ client_name: "App", redirect_uris: ["https://a.com"] }) }),
    );
    expect(response.status).toBe(400);
  });

  it("updates an existing client via GoTrue", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ client_id: "abc", client_name: "Renamed" }), { status: 200 }));
    const response = await PUT(
      requestWithAuth(`${BASE_URL}?clientId=abc`, {
        method: "PUT",
        body: JSON.stringify({ client_name: "Renamed", redirect_uris: ["https://a.com"] }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ client_id: "abc", client_name: "Renamed" });
  });
});
