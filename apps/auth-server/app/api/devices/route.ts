import { decodeAccessToken } from "@kontrolia/auth";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/** The caller's own devices/sessions — kontrolia_auth.devices RLS already scopes this to auth.uid(). */
export async function GET() {
  const supabase = await createRouteHandlerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentSessionId = decodeAccessToken(session.access_token)?.session_id ?? null;

  const { data, error } = await supabase
    .schema("kontrolia_auth")
    .from("devices")
    .select("session_id, label, ip, last_seen_at, created_at")
    .order("last_seen_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ devices: data, currentSessionId });
}
