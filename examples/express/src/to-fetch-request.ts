import type { Request as ExpressRequest } from "express";

/**
 * @kontrolia/auth/server works against the standard Fetch API Request —
 * Express's req is a Node IncomingMessage wrapper, not that, so this is the
 * one bit of glue code an Express app needs. Only headers matter for
 * verifyRequest()/requirePermission(), so this doesn't need to be a fully
 * faithful Request reconstruction.
 */
export function toFetchRequest(req: ExpressRequest): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }
  return new Request(`http://localhost${req.originalUrl}`, { headers });
}
