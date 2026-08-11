import { beforeEach, expect, it, vi } from "vitest";
import { makeSchemaClient } from "./test-helpers";

// Light coverage: an upsert-and-return-ok endpoint called once per session
// by the client; friendlyLabel()'s user-agent parsing is a pure string
// switch not worth enumerating every OS/browser combination for.
const getSessionMock = vi.fn();
const schemaClientHolder: { current: ReturnType<typeof makeSchemaClient> | null } = { current: null };
vi.mock("@/lib/supabase-server", () => ({
  createRouteHandlerSupabaseClient: async () => ({
    auth: { getSession: getSessionMock },
    ...schemaClientHolder.current,
  }),
}));

const logErrorMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

const { POST } = await import("../devices/touch/route");

const BASE_URL = "https://auth.example.com/api/devices/touch";

function fakeAccessToken(sessionId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ session_id: sessionId })).toString("base64url");
  return `${header}.${payload}.`;
}

beforeEach(() => {
  getSessionMock.mockReset();
  logErrorMock.mockReset();
  schemaClientHolder.current = null;
});

it("returns 401 when there's no session", async () => {
  getSessionMock.mockResolvedValue({ data: { session: null } });
  const response = await POST(new Request(BASE_URL, { method: "POST", headers: { "user-agent": "Mozilla/5.0 Chrome/1.0" } }));
  expect(response.status).toBe(401);
});

it("returns 400 when the access token carries no session_id claim", async () => {
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "not-a-valid-jwt", user: { id: "user-1" } } } });
  const response = await POST(new Request(BASE_URL, { method: "POST" }));
  expect(response.status).toBe(400);
});

it("upserts the device record and returns ok", async () => {
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: fakeAccessToken("session-abc"), user: { id: "user-1" } } },
  });
  schemaClientHolder.current = makeSchemaClient({ devices: [{ error: null }] });
  const response = await POST(new Request(BASE_URL, { method: "POST", headers: { "user-agent": "Mozilla/5.0 Chrome/1.0" } }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

it("returns 500 and logs when the upsert fails", async () => {
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: fakeAccessToken("session-abc"), user: { id: "user-1" } } },
  });
  schemaClientHolder.current = makeSchemaClient({ devices: [{ error: { message: "upsert failed" } }] });
  const response = await POST(new Request(BASE_URL, { method: "POST" }));
  expect(response.status).toBe(500);
  expect(logErrorMock).toHaveBeenCalledWith("POST /api/devices/touch", { message: "upsert failed" });
});
