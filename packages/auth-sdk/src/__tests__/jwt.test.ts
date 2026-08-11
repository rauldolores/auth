import { describe, expect, it } from "vitest";
import { decodeAccessToken } from "../jwt.js";

/**
 * decodeAccessToken() deliberately does NOT verify a signature — see the
 * doc comment on the function itself: it only ever runs against a token the
 * app already received over an authenticated Supabase session, so the real
 * signature check happens server-side (see server.test.ts's coverage of
 * verifyRequest(), which uses jose + the project's JWKS). What matters here
 * is that decoding is correct for well-formed tokens and fails closed (null)
 * for anything malformed, rather than throwing or returning garbage.
 */
function makeToken(payload: object, header: object = { alg: "HS256", typ: "JWT" }): string {
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${encode(header)}.${encode(payload)}.fake-signature`;
}

describe("decodeAccessToken", () => {
  it("decodes the payload of a well-formed three-segment token", () => {
    const claims = {
      sub: "user-1",
      session_id: "s1",
      organization_id: "org-1",
      roles: ["admin"],
      permissions: ["facturacion.facturas.crear"],
      exp: 1999999999,
    };
    expect(decodeAccessToken(makeToken(claims))).toEqual(claims);
  });

  it("restores base64url padding correctly regardless of payload length", () => {
    // decodeAccessToken manually pads the base64url payload back to a
    // multiple of 4 chars before decoding; base64 padding needs differ by
    // payload length mod 4, so exercise several lengths to cover every case.
    for (const padLength of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const claims = { sub: "x".repeat(padLength), session_id: "y", organization_id: null, roles: [], permissions: [], exp: 1 };
      expect(decodeAccessToken(makeToken(claims))).toEqual(claims);
    }
  });

  it("returns null for a token that does not have exactly 3 segments", () => {
    expect(decodeAccessToken("only.two")).toBeNull();
    expect(decodeAccessToken("one")).toBeNull();
    expect(decodeAccessToken("a.b.c.d")).toBeNull();
    expect(decodeAccessToken("")).toBeNull();
  });

  it("returns null when the payload segment is not valid base64/JSON", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    expect(decodeAccessToken(`${header}.not-valid-json-!!!.sig`)).toBeNull();
  });

  it("returns null for a completely garbage string", () => {
    expect(decodeAccessToken("garbage")).toBeNull();
  });
});
