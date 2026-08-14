import { createHash, randomBytes } from "node:crypto";

const API_KEY_PREFIX = "kapp_";

/** Generates a new plaintext application sync API key. Shown once, never stored. */
export function generateApplicationApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

/** sha256 hex digest — what actually gets stored as application_api_keys.key_hash. */
export function hashApplicationApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** First few characters after the prefix, stored alongside the hash purely so a key list UI can show "kapp_a1b2c3…" without ever persisting (or being able to redisplay) the full secret. */
export function applicationApiKeyDisplayPrefix(plaintext: string): string {
  return plaintext.slice(0, API_KEY_PREFIX.length + 6);
}
