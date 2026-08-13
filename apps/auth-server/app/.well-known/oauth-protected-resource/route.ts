import { NextResponse } from "next/server";

/**
 * RFC 9728 Protected Resource Metadata — tells an MCP client (Claude Code,
 * Claude.ai Connectors, ChatGPT, etc.) which authorization server issues
 * tokens this server accepts, so it can drive the OAuth 2.1 flow itself.
 * Points at GoTrue directly: it already serves RFC 8414 authorization-server
 * metadata at {SUPABASE_URL}/auth/v1/.well-known/oauth-authorization-server
 * (confirmed against the local sandbox) — no metadata needs synthesizing
 * here beyond this one small document.
 */
export async function GET(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return NextResponse.json({ error: "SUPABASE_URL not configured" }, { status: 500 });

  const resource = new URL("/api/mcp", request.url).toString();

  return NextResponse.json({
    resource,
    authorization_servers: [`${supabaseUrl.replace(/\/$/, "")}/auth/v1`],
  });
}
