import { randomBytes } from "node:crypto";

/** Local-only secret generation for the self-hosted docker-compose path. */
export function generateJwtSecret(): string {
  return randomBytes(32).toString("hex");
}
