import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * client.ts's OAuth 2.1 + PKCE server-to-server methods
 * (buildOAuthServerAuthorizeUrl / exchangeOAuthServerCode /
 * getOAuthAuthorizationDetails / decideOAuthAuthorization) talk to GoTrue's
 * REST endpoints via global fetch directly — not through supabase-js — so,
 * exactly like server.test.ts does for the JWKS fetch, we exercise that real
 * HTTP behavior against a real local http server rather than mocking fetch.
 * The fake server below implements real PKCE verification (S256(verifier)
 * must match the challenge recorded at "authorize" time) so a verifier/
 * challenge mismatch bug would actually be caught, the same way a real
 * GoTrue instance would catch it.
 *
 * @supabase/ssr's createBrowserClient is mocked (the same technique
 * next-sdk's middleware.test.ts uses for @supabase/ssr) because its cookie
 * storage plumbing is supabase-js's own concern — it requires a real
 * browser `document` to persist anything and is unrelated to the PKCE
 * exchange logic this suite targets. We assert against the mocked
 * `auth.setSession` call instead, which is exactly the boundary where
 * client.ts hands the tokens it received off to supabase-js.
 */
const setSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));
const getSessionMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      setSession: setSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      getSession: getSessionMock,
    },
  })),
}));

const { createKontroliaClient } = await import("../client.js");

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function challengeFor(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

interface AuthorizedGrant {
  challenge: string;
  clientId: string;
  redirectUri: string;
}

/**
 * Minimal stand-in for GoTrue's OAuth endpoints. Tracks "issued" codes with
 * the PKCE challenge and client/redirect they were issued for, and performs
 * the real S256 comparison a production authorization server would — so a
 * test sending the wrong verifier gets rejected for the same reason a real
 * server would reject it, not because we hand-coded the expectation.
 */
function startFakeAuthServer() {
  const grants = new Map<string, AuthorizedGrant>();
  const receivedTokenRequests: URLSearchParams[] = [];
  let userStoreResponse: { status: number; body: unknown } = {
    status: 200,
    body: { id: "user-1", email: "user@example.com", user_metadata: {} },
  };

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");

      if (req.method === "GET" && req.url?.startsWith("/auth/v1/user")) {
        res.writeHead(userStoreResponse.status, { "content-type": "application/json" });
        res.end(JSON.stringify(userStoreResponse.body));
        return;
      }

      if (req.method === "POST" && req.url === "/auth/v1/oauth/token") {
        const params = new URLSearchParams(rawBody);
        receivedTokenRequests.push(params);

        if (params.get("grant_type") !== "authorization_code") {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "unsupported_grant_type" }));
          return;
        }

        const code = params.get("code") ?? "";
        if (code === "server-explodes") {
          // Simulate a real authorization server's own 5xx — a case an
          // exchange must surface, not paper over with a generic failure.
          res.writeHead(500, { "content-type": "text/plain" });
          res.end("internal server error");
          return;
        }

        const grant = grants.get(code);
        if (!grant) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant", error_description: "unknown or expired code" }));
          return;
        }

        const verifier = params.get("code_verifier") ?? "";
        if (challengeFor(verifier) !== grant.challenge) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant", error_description: "code verifier mismatch" }));
          return;
        }
        if (params.get("client_id") !== grant.clientId || params.get("redirect_uri") !== grant.redirectUri) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant", error_description: "client/redirect mismatch" }));
          return;
        }

        // A code is single-use, exactly like a real authorization server.
        grants.delete(code);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ access_token: `access-for-${code}`, refresh_token: `refresh-for-${code}` }));
        return;
      }

      const authDetailsMatch = req.url?.match(/^\/auth\/v1\/oauth\/authorizations\/([^/]+)$/);
      if (req.method === "GET" && authDetailsMatch) {
        const authorizationId = authDetailsMatch[1];
        if (authorizationId === "auto-approved") {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ redirect_url: "https://client.example.com/callback?code=xyz" }));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            authorization_id: authorizationId,
            redirect_uri: "https://client.example.com/callback",
            client: { id: "client-1", name: "Example App" },
            user: { id: "user-1", email: "user@example.com" },
            scope: "openid",
          }),
        );
        return;
      }

      const consentMatch = req.url?.match(/^\/auth\/v1\/oauth\/authorizations\/([^/]+)\/consent$/);
      if (req.method === "POST" && consentMatch) {
        const body = rawBody ? JSON.parse(rawBody) : {};
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ redirect_url: `https://client.example.com/callback?decision=${body.action}` }));
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
    });
  });

  return {
    server,
    grants,
    receivedTokenRequests,
    setUserStoreResponse(response: { status: number; body: unknown }) {
      userStoreResponse = response;
    },
    issueCode(code: string, grant: AuthorizedGrant) {
      grants.set(code, grant);
    },
  };
}

describe("KontroliaClient OAuth 2.1 + PKCE flow", () => {
  let fake: ReturnType<typeof startFakeAuthServer>;
  let supabaseUrl: string;

  beforeAll(async () => {
    fake = startFakeAuthServer();
    await new Promise<void>((resolve) => fake.server.listen(0, "127.0.0.1", resolve));
    const address = fake.server.address() as AddressInfo;
    supabaseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => fake.server.close((err) => (err ? reject(err) : resolve())));
  });

  beforeEach(() => {
    setSessionMock.mockReset();
    setSessionMock.mockResolvedValue({ data: { session: null, user: null }, error: null });
    onAuthStateChangeMock.mockClear();
    getSessionMock.mockReset();
    fake.receivedTokenRequests.length = 0;
    fake.grants.clear();
  });

  function makeClient() {
    return createKontroliaClient({ supabaseUrl, supabaseAnonKey: "anon-key" });
  }

  describe("buildOAuthServerAuthorizeUrl", () => {
    it("produces an authorize URL whose code_challenge is the real S256 hash of the returned codeVerifier", async () => {
      const client = makeClient();
      const result = await client.buildOAuthServerAuthorizeUrl({
        clientId: "client-1",
        redirectUri: "https://client.example.com/callback",
      });

      const url = new URL(result.url);
      expect(url.origin + url.pathname).toBe(`${supabaseUrl}/auth/v1/oauth/authorize`);
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("client_id")).toBe("client-1");
      expect(url.searchParams.get("redirect_uri")).toBe("https://client.example.com/callback");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("code_challenge")).toBe(challengeFor(result.codeVerifier));
      expect(url.searchParams.get("scope")).toBe("openid");
      expect(url.searchParams.has("state")).toBe(false);
    });

    it("round-trips a caller-supplied scope and state unchanged", async () => {
      const client = makeClient();
      const result = await client.buildOAuthServerAuthorizeUrl({
        clientId: "client-1",
        redirectUri: "https://client.example.com/callback",
        scope: "openid profile",
        state: "return-to:/dashboard",
      });

      const url = new URL(result.url);
      expect(url.searchParams.get("scope")).toBe("openid profile");
      expect(url.searchParams.get("state")).toBe("return-to:/dashboard");
    });

    it("generates a fresh, non-reused verifier/challenge pair on every call", async () => {
      const client = makeClient();
      const first = await client.buildOAuthServerAuthorizeUrl({ clientId: "c", redirectUri: "https://a.example.com/cb" });
      const second = await client.buildOAuthServerAuthorizeUrl({ clientId: "c", redirectUri: "https://a.example.com/cb" });
      expect(first.codeVerifier).not.toBe(second.codeVerifier);
    });
  });

  describe("exchangeOAuthServerCode", () => {
    it("exchanges the authorization code and the exact verifier from the authorize step for a session", async () => {
      const client = makeClient();
      const { codeVerifier, url } = await client.buildOAuthServerAuthorizeUrl({
        clientId: "client-1",
        redirectUri: "https://client.example.com/callback",
      });
      const challenge = new URL(url).searchParams.get("code_challenge")!;
      fake.issueCode("real-code", { challenge, clientId: "client-1", redirectUri: "https://client.example.com/callback" });

      await client.exchangeOAuthServerCode({
        clientId: "client-1",
        redirectUri: "https://client.example.com/callback",
        code: "real-code",
        codeVerifier,
      });

      // The verifier that reached the token endpoint must be byte-for-byte
      // the one generatePkcePair produced at authorize time, not a
      // freshly-derived or re-hashed value.
      expect(fake.receivedTokenRequests).toHaveLength(1);
      expect(fake.receivedTokenRequests[0].get("code_verifier")).toBe(codeVerifier);
      expect(fake.receivedTokenRequests[0].get("grant_type")).toBe("authorization_code");

      // The tokens the server actually returned are what get handed to
      // supabase-js's setSession — this is the "session" the exchange
      // establishes.
      expect(setSessionMock).toHaveBeenCalledTimes(1);
      expect(setSessionMock).toHaveBeenCalledWith({
        access_token: "access-for-real-code",
        refresh_token: "refresh-for-real-code",
      });
    });

    it("rejects when the verifier does not match the challenge recorded at authorize time (PKCE mismatch)", async () => {
      const client = makeClient();
      fake.issueCode("mismatched-code", {
        challenge: challengeFor("the-real-verifier"),
        clientId: "client-1",
        redirectUri: "https://client.example.com/callback",
      });

      await expect(
        client.exchangeOAuthServerCode({
          clientId: "client-1",
          redirectUri: "https://client.example.com/callback",
          code: "mismatched-code",
          codeVerifier: "a-completely-different-verifier",
        }),
      ).rejects.toThrow(/OAuth token exchange failed \(400\)/);

      // A failed exchange must never reach setSession — the caller should
      // see the rejection rather than silently ending up "logged in".
      expect(setSessionMock).not.toHaveBeenCalled();
    });

    it("rejects on an unknown or expired code without touching setSession", async () => {
      const client = makeClient();

      await expect(
        client.exchangeOAuthServerCode({
          clientId: "client-1",
          redirectUri: "https://client.example.com/callback",
          code: "never-issued",
          codeVerifier: "whatever",
        }),
      ).rejects.toThrow(/OAuth token exchange failed \(400\)/);
      expect(setSessionMock).not.toHaveBeenCalled();
    });

    it("propagates a supabase-js session error instead of swallowing it", async () => {
      const client = makeClient();
      fake.issueCode("code-2", { challenge: challengeFor("verifier-2"), clientId: "client-1", redirectUri: "https://client.example.com/callback" });
      const sessionError = new Error("session store rejected the tokens");
      setSessionMock.mockResolvedValueOnce({ data: { session: null, user: null }, error: sessionError });

      await expect(
        client.exchangeOAuthServerCode({
          clientId: "client-1",
          redirectUri: "https://client.example.com/callback",
          code: "code-2",
          codeVerifier: "verifier-2",
        }),
      ).rejects.toBe(sessionError);
    });

    it("rejects with the status and body text when the token endpoint returns a 5xx", async () => {
      const client = makeClient();
      await expect(
        client.exchangeOAuthServerCode({
          clientId: "client-1",
          redirectUri: "https://client.example.com/callback",
          code: "server-explodes",
          codeVerifier: "whatever",
        }),
      ).rejects.toThrow(/OAuth token exchange failed \(500\): internal server error/);
      expect(setSessionMock).not.toHaveBeenCalled();
    });
  });

  describe("getOAuthAuthorizationDetails", () => {
    it("throws when there is no authenticated session to attach", async () => {
      getSessionMock.mockResolvedValue({ data: { session: null } });
      const client = makeClient();
      await expect(client.getOAuthAuthorizationDetails("auth-1")).rejects.toThrow("Not authenticated");
    });

    it("returns a pending result with parsed details when GoTrue has not auto-decided", async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: makeFakeAccessToken() } } });
      const client = makeClient();

      const result = await client.getOAuthAuthorizationDetails("auth-42");

      expect(result).toEqual({
        status: "pending",
        details: {
          authorizationId: "auth-42",
          redirectUri: "https://client.example.com/callback",
          client: { id: "client-1", name: "Example App" },
          user: { id: "user-1", email: "user@example.com" },
          scope: "openid",
        },
      });
    });

    it("returns a decided result and skips the consent step when GoTrue auto-approves", async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: makeFakeAccessToken() } } });
      const client = makeClient();

      const result = await client.getOAuthAuthorizationDetails("auto-approved");

      expect(result).toEqual({ status: "decided", redirectUrl: "https://client.example.com/callback?code=xyz" });
    });
  });

  describe("decideOAuthAuthorization", () => {
    it("posts the approve/deny decision and returns the redirect URL", async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: makeFakeAccessToken() } } });
      const client = makeClient();

      const redirectUrl = await client.decideOAuthAuthorization("auth-42", "approve");

      expect(redirectUrl).toBe("https://client.example.com/callback?decision=approve");
    });

    it("throws when there is no authenticated session", async () => {
      getSessionMock.mockResolvedValue({ data: { session: null } });
      const client = makeClient();
      await expect(client.decideOAuthAuthorization("auth-42", "deny")).rejects.toThrow("Not authenticated");
    });
  });
});

/**
 * Unlike the OAuth/PKCE flow above, listOrganizationMembers/
 * searchOrganizationMembers/getOrganizationMemberCount hit auth-server's
 * plain REST API — a simple global.fetch mock is enough, no need for the
 * real-HTTP-server rig those crypto-sensitive methods use.
 */
describe("KontroliaClient organization member lookups", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    getSessionMock.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function makeClientWithAuthServer(authServerUrl = "https://auth.example.com") {
    return createKontroliaClient({ supabaseUrl: "https://project.supabase.co", supabaseAnonKey: "anon-key", authServerUrl });
  }

  it("throws when authServerUrl isn't configured", async () => {
    const client = createKontroliaClient({ supabaseUrl: "https://project.supabase.co", supabaseAnonKey: "anon-key" });
    getSessionMock.mockResolvedValue({ data: { session: { access_token: makeFakeAccessToken() } } });

    await expect(client.listOrganizationMembers("org-1")).rejects.toThrow(/authServerUrl/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an empty page without calling fetch when there's no session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    const client = makeClientWithAuthServer();

    const page = await client.listOrganizationMembers("org-1");

    expect(page).toEqual({ members: [], hasMore: false, total: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("listOrganizationMembers", () => {
    it("fetches the members endpoint with the session token, mapping userId -> id", async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: "session-token-1" } } });
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({ members: [{ userId: "user-1", email: "ana@example.com", name: "Ana" }], hasMore: true, total: 42 }),
          { status: 200 },
        ),
      );
      const client = makeClientWithAuthServer();

      const page = await client.listOrganizationMembers("org-1", { offset: 100 });

      expect(page).toEqual({ members: [{ id: "user-1", email: "ana@example.com", name: "Ana" }], hasMore: true, total: 42 });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://auth.example.com/api/organization-members?organizationId=org-1&offset=100");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer session-token-1");
    });
  });

  describe("searchOrganizationMembers", () => {
    it("sends the search query param", async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: "session-token-1" } } });
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ members: [], hasMore: false, total: 0 }), { status: 200 }));
      const client = makeClientWithAuthServer();

      await client.searchOrganizationMembers("org-1", "ana");

      const [url] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://auth.example.com/api/organization-members?organizationId=org-1&search=ana");
    });
  });

  describe("getOrganizationMemberCount", () => {
    it("sends count=true and returns just the total", async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: "session-token-1" } } });
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ members: [], hasMore: false, total: 17 }), { status: 200 }));
      const client = makeClientWithAuthServer();

      const total = await client.getOrganizationMemberCount("org-1");

      expect(total).toBe(17);
      const [url] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://auth.example.com/api/organization-members?organizationId=org-1&count=true");
    });
  });

  it("throws with the server's error message when the request fails", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "session-token-1" } } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "No autenticado" }), { status: 401 }));
    const client = makeClientWithAuthServer();

    await expect(client.listOrganizationMembers("org-1")).rejects.toThrow("No autenticado");
  });
});

function makeFakeAccessToken(): string {
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ sub: "user-1" })}.sig`;
}
