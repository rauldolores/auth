import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { KontroliaTokenClaims } from "@kontrolia/shared";
import { type KeyLike, SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getUserFromClaims, requirePermission, verifyRequest } from "../server.js";

/**
 * verifyRequest() is the single place a resource server verifies a bearer
 * access token's *signature* against the project's real JWKS (via jose's
 * jwtVerify + createRemoteJWKSet) — the most security-critical function in
 * the SDK. jose's remote JWKS fetcher uses node:http/https directly (not
 * global fetch), so rather than mocking fetch we spin up a real local HTTP
 * server that serves a JWKS document, exactly like GoTrue's
 * /auth/v1/.well-known/jwks.json would in production.
 */
describe("verifyRequest", () => {
  let server: Server;
  let supabaseUrl: string;
  let privateKey: KeyLike;
  let wrongPrivateKey: KeyLike;

  const alg = "RS256";
  const kid = "test-signing-key";

  beforeAll(async () => {
    const pair = await generateKeyPair(alg, { extractable: true });
    privateKey = pair.privateKey;
    const wrongPair = await generateKeyPair(alg, { extractable: true });
    wrongPrivateKey = wrongPair.privateKey;

    const publicJwk = await exportJWK(pair.publicKey);
    const jwks = { keys: [{ ...publicJwk, kid, alg, use: "sig" }] };

    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(jwks));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    supabaseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  function baseClaims(overrides: Partial<KontroliaTokenClaims> = {}): KontroliaTokenClaims {
    return {
      sub: "user-123",
      session_id: "session-abc",
      organization_id: "org-1",
      roles: ["admin"],
      permissions: ["facturacion.facturas.crear"],
      email: "user@example.com",
      user_metadata: { full_name: "Ada Lovelace", avatar_url: null, locale: "es-MX", timezone: "America/Mexico_City" },
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    };
  }

  async function signToken(claims: KontroliaTokenClaims, key: KeyLike = privateKey): Promise<string> {
    return new SignJWT(claims as unknown as Record<string, unknown>).setProtectedHeader({ alg, kid }).sign(key);
  }

  function requestWithAuthHeader(headerValue: string | null): Request {
    return new Request("https://app.example.com/api/protected", {
      headers: headerValue ? { Authorization: headerValue } : {},
    });
  }

  async function expectRejectsWith401(promise: Promise<unknown>): Promise<void> {
    await expect(promise).rejects.toBeInstanceOf(Response);
    await promise.catch((response: Response) => {
      expect(response.status).toBe(401);
    });
  }

  it("verifies a validly-signed token and returns the expected claims, user and checker", async () => {
    const claims = baseClaims();
    const token = await signToken(claims);

    const result = await verifyRequest(requestWithAuthHeader(`Bearer ${token}`), { supabaseUrl });

    expect(result.claims.sub).toBe(claims.sub);
    expect(result.claims.roles).toEqual(claims.roles);
    expect(result.claims.permissions).toEqual(claims.permissions);
    expect(result.claims.organization_id).toBe(claims.organization_id);

    expect(result.user).toEqual({
      id: claims.sub,
      email: claims.email,
      fullName: "Ada Lovelace",
      avatarUrl: null,
      locale: "es-MX",
      timezone: "America/Mexico_City",
      lastSeenAt: null,
    });

    expect(result.checker.hasPermission("facturacion.facturas.crear")).toBe(true);
    expect(result.checker.hasPermission("facturacion.facturas.cancelar")).toBe(false);
    expect(result.checker.hasRole("admin")).toBe(true);
  });

  it("rejects a token whose signature does not match the JWKS (wrong signing key)", async () => {
    // Same header/kid as a real token, but signed with a different private
    // key than the one whose public half is published in the JWKS — this is
    // what a forged/tampered token looks like.
    const token = await signToken(baseClaims(), wrongPrivateKey);
    await expectRejectsWith401(verifyRequest(requestWithAuthHeader(`Bearer ${token}`), { supabaseUrl }));
  });

  it("rejects an expired token", async () => {
    const token = await signToken(baseClaims({ exp: Math.floor(Date.now() / 1000) - 60 }));
    await expectRejectsWith401(verifyRequest(requestWithAuthHeader(`Bearer ${token}`), { supabaseUrl }));
  });

  it("rejects a malformed token", async () => {
    await expectRejectsWith401(verifyRequest(requestWithAuthHeader("Bearer not-a-jwt"), { supabaseUrl }));
  });

  it("rejects a request with no Authorization header", async () => {
    await expectRejectsWith401(verifyRequest(requestWithAuthHeader(null), { supabaseUrl }));
  });

  it("rejects a request with a non-Bearer Authorization header", async () => {
    await expectRejectsWith401(verifyRequest(requestWithAuthHeader("Basic dXNlcjpwYXNz"), { supabaseUrl }));
  });
});

describe("requirePermission", () => {
  let server: Server;
  let supabaseUrl: string;
  let privateKey: KeyLike;
  const alg = "RS256";
  const kid = "test-signing-key";

  beforeAll(async () => {
    const pair = await generateKeyPair(alg, { extractable: true });
    privateKey = pair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    const jwks = { keys: [{ ...publicJwk, kid, alg, use: "sig" }] };

    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(jwks));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    supabaseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  function requestWithToken(token: string): Request {
    return new Request("https://app.example.com/api/protected", { headers: { Authorization: `Bearer ${token}` } });
  }

  it("resolves when the verified token carries the required permission", async () => {
    const token = await new SignJWT({
      sub: "user-1",
      session_id: "s1",
      organization_id: "org-1",
      roles: ["billing_clerk"],
      permissions: ["facturacion.facturas.crear"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    }).setProtectedHeader({ alg, kid }).sign(privateKey);

    const verified = await requirePermission(requestWithToken(token), { supabaseUrl }, "facturacion.facturas.crear");
    expect(verified.claims.sub).toBe("user-1");
  });

  it("rejects with 403 when the verified token lacks the required permission", async () => {
    const token = await new SignJWT({
      sub: "user-1",
      session_id: "s1",
      organization_id: "org-1",
      roles: ["viewer"],
      permissions: ["facturacion.facturas.leer"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    }).setProtectedHeader({ alg, kid }).sign(privateKey);

    await expect(requirePermission(requestWithToken(token), { supabaseUrl }, "facturacion.facturas.crear")).rejects.toBeInstanceOf(
      Response,
    );
    await requirePermission(requestWithToken(token), { supabaseUrl }, "facturacion.facturas.crear").catch((response: Response) => {
      expect(response.status).toBe(403);
    });
  });
});

describe("getUserFromClaims", () => {
  it("maps token claims to the KontroliaUser shape, with lastSeenAt always null", () => {
    const claims: KontroliaTokenClaims = {
      sub: "user-9",
      session_id: "s9",
      organization_id: "org-9",
      roles: [],
      permissions: [],
      email: "nine@example.com",
      user_metadata: { full_name: "Nine", avatar_url: "https://example.com/a.png", locale: null, timezone: null },
      exp: 0,
    };

    expect(getUserFromClaims(claims)).toEqual({
      id: "user-9",
      email: "nine@example.com",
      fullName: "Nine",
      avatarUrl: "https://example.com/a.png",
      locale: null,
      timezone: null,
      lastSeenAt: null,
    });
  });
});
