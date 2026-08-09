import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/** Signs a specific device/session out via kontrolia_auth.revoke_session(). */
export async function POST(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();
  const body = (await request.json()) as { sessionId?: string };
  if (!body.sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.schema("kontrolia_auth").rpc("revoke_session", { target_session_id: body.sessionId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
