import { decodeAccessToken } from "@kontrolia/auth";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

function friendlyLabel(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido";
  const os = /windows/i.test(userAgent)
    ? "Windows"
    : /mac os/i.test(userAgent)
      ? "macOS"
      : /android/i.test(userAgent)
        ? "Android"
        : /iphone|ipad/i.test(userAgent)
          ? "iOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "Desconocido";
  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /chrome\//i.test(userAgent)
      ? "Chrome"
      : /firefox\//i.test(userAgent)
        ? "Firefox"
        : /safari\//i.test(userAgent)
          ? "Safari"
          : "Navegador";
  return `${browser} en ${os}`;
}

/** Records/refreshes the current session as a known device — called once per session on the client. */
export async function POST(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const claims = decodeAccessToken(session.access_token);
  if (!claims?.session_id) return NextResponse.json({ error: "No session_id claim" }, { status: 400 });

  const userAgent = request.headers.get("user-agent");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error } = await supabase
    .schema("kontrolia_auth")
    .from("devices")
    .upsert(
      {
        user_id: session.user.id,
        session_id: claims.session_id,
        label: friendlyLabel(userAgent),
        user_agent: userAgent,
        ip,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
