import { beforeEach, expect, it, vi } from "vitest";
import { makeSchemaClient } from "./test-helpers";

// Light coverage: session/device listing and revocation are simple,
// single-branch RLS-scoped operations. decodeAccessToken() (from
// @kontrolia/auth, real JWT decoding logic) is exercised for real with a
// hand-built unsigned JWT rather than mocked, since it's pure decoding with
// no network/crypto verification involved.
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

const { GET } = await import("../devices/route");

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
  const response = await GET();
  expect(response.status).toBe(401);
});

it("returns the caller's devices with the current session flagged", async () => {
  getSessionMock.mockResolvedValue({ data: { session: { access_token: fakeAccessToken("session-abc") } } });
  schemaClientHolder.current = makeSchemaClient({
    devices: [
      {
        data: [{ session_id: "session-abc", label: "Chrome en Windows", ip: "1.2.3.4", last_seen_at: "2026-01-01T00:00:00Z", created_at: "2025-12-01T00:00:00Z" }],
        error: null,
      },
    ],
  });
  const response = await GET();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.currentSessionId).toBe("session-abc");
  expect(body.devices).toHaveLength(1);
});

it("returns 500 and logs on a query error", async () => {
  getSessionMock.mockResolvedValue({ data: { session: { access_token: fakeAccessToken("session-abc") } } });
  schemaClientHolder.current = makeSchemaClient({ devices: [{ data: null, error: { message: "boom" } }] });
  const response = await GET();
  expect(response.status).toBe(500);
  expect(logErrorMock).toHaveBeenCalledWith("GET /api/devices", { message: "boom" });
});
