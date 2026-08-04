import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Server-side leg of the OAuth/PKCE redirect (Google, etc.). Because
 * sessions live in cookies (@supabase/ssr), the authorization code Supabase
 * appends to this URL has to be exchanged here — not client-side — so the
 * resulting session cookies get set on the response before the browser
 * lands back on the app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTarget = url.searchParams.get("redirect") ?? "/";

  if (code) {
    const supabase = await createRouteHandlerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(redirectTarget, url.origin));
}
