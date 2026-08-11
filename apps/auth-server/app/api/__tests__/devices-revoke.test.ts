import { beforeEach, expect, it, vi } from "vitest";
import { makeThenableBuilder } from "./test-helpers";

// Light coverage: a thin wrapper around the kontrolia_auth.revoke_session()
// RPC — the actual revocation logic lives in the database function, out of
// scope here; this just checks the route's own input validation, auth gate,
// and error passthrough.
const getUserMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  createRouteHandlerSupabaseClient: async () => ({
    auth: { getUser: getUserMock },
    schema: () => ({ rpc: rpcMock }),
  }),
}));

const { POST } = await import("../devices/revoke/route");

const BASE_URL = "https://auth.example.com/api/devices/revoke";

beforeEach(() => {
  getUserMock.mockReset();
  rpcMock.mockReset();
});

it("returns 400 when sessionId is missing from the body", async () => {
  const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({}) }));
  expect(response.status).toBe(400);
});

it("returns 401 when not signed in", async () => {
  getUserMock.mockResolvedValue({ data: { user: null } });
  const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({ sessionId: "session-2" }) }));
  expect(response.status).toBe(401);
});

it("revokes the named session", async () => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  rpcMock.mockReturnValue(makeThenableBuilder({ error: null }));
  const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({ sessionId: "session-2" }) }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(rpcMock).toHaveBeenCalledWith("revoke_session", { target_session_id: "session-2" });
});

it("returns 400 when the RPC errors", async () => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  rpcMock.mockReturnValue(makeThenableBuilder({ error: { message: "session not found" } }));
  const response = await POST(new Request(BASE_URL, { method: "POST", body: JSON.stringify({ sessionId: "nope" }) }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "session not found" });
});
