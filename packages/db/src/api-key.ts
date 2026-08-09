import { createHash, randomBytes } from "node:crypto";

const API_KEY_PREFIX = "kapp_";

/** Generates a new plaintext application sync API key. Shown once, never stored. */
export function generateApplicationApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

/** sha256 hex digest — what actually gets stored in kontrolia_auth.applications.api_key_hash. */
export function hashApplicationApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
