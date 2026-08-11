import { NextResponse } from "next/server";

/** Liveness check for load balancers/uptime monitors — deliberately has no
 * dependencies of its own (no DB call) so it reflects whether this Next.js
 * process itself is up, not whether Supabase is reachable; a dependency
 * outage shouldn't make the orchestrator restart a perfectly healthy app. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
