import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generatePkcePair } from "../pkce.js";

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("generatePkcePair", () => {
  it("produces a code_challenge that is the correct S256 hash of the code_verifier", async () => {
    const { verifier, challenge } = await generatePkcePair();

    const expectedChallenge = base64UrlEncode(createHash("sha256").update(verifier).digest());
    expect(challenge).toBe(expectedChallenge);

    // A wrong verifier must not hash to the same challenge (sanity check
    // that this isn't a constant/degenerate digest).
    const wrongDigest = base64UrlEncode(createHash("sha256").update(`${verifier}x`).digest());
    expect(challenge).not.toBe(wrongDigest);
  });

  it("produces a verifier and challenge using only base64url-safe characters, unpadded", async () => {
    const { verifier, challenge } = await generatePkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 random bytes -> 43 base64url characters (no padding).
    expect(verifier.length).toBe(43);
    // A SHA-256 digest is 32 bytes -> also 43 base64url characters.
    expect(challenge.length).toBe(43);
  });

  it("generates a unique verifier/challenge pair on every call (no reuse or determinism bug)", async () => {
    const pairs = await Promise.all(Array.from({ length: 25 }, () => generatePkcePair()));
    expect(new Set(pairs.map((p) => p.verifier)).size).toBe(25);
    expect(new Set(pairs.map((p) => p.challenge)).size).toBe(25);
  });
});
