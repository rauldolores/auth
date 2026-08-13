import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Shared entry point for every "auth model A" route: a caller-scoped
 * Supabase client built from a bearer token in the Authorization header
 * (not a browser cookie session), so the exact same route works whether the
 * caller is admin-panel (cross-origin fetch) or the MCP server (no browser
 * session to forward at all). Extracted from organization-members/route.ts,
 * the first route to need this pattern.
 */

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

export function scopedClient(token: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export type ScopedClient = ReturnType<typeof scopedClient>;

/** Extracts the bearer token and builds a scoped client, or returns a 401 NextResponse directly. */
export function authenticateBearer(request: Request): { token: string; caller: ScopedClient } | NextResponse {
  const token = extractBearerToken(request);
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return { token, caller: scopedClient(token) };
}
