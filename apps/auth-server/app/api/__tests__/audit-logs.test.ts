import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAdminClient, makeSchemaClient } from "./test-helpers";

const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const logErrorMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

const { GET } = await import("../audit-logs/route");

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

const BASE_URL = "https://auth.example.com/api/audit-logs";

beforeEach(() => {
  createClientMock.mockReset();
  createSupabaseAdminClientMock.mockReset();
  logErrorMock.mockReset();
  createSupabaseAdminClientMock.mockReturnValue(makeAdminClient());
});

describe("GET /api/audit-logs", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new Request(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(401);
  });

  it("returns 400 when organizationId is missing", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({}));
    const response = await GET(requestWithAuth(BASE_URL));
    expect(response.status).toBe(400);
  });

  it("resolves the actor's email onto each row", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        audit_logs: [
          {
            data: [
              {
                id: "log-1",
                actor_user_id: "user-1",
                action: "organization.created",
                target_type: "organization",
                target_id: "org-1",
                metadata: { name: "Kontrolia" },
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            error: null,
          },
        ],
      }),
    );
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({}, { data: { users: [{ id: "user-1", email: "owner@example.com" }] }, error: null }),
    );

    const response = await GET(requestWithAuth(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.logs[0].actorEmail).toBe("owner@example.com");
    expect(body.hasMore).toBe(false);
  });

  it("leaves actorEmail null for system-triggered rows with no actor_user_id", async () => {
    createClientMock.mockReturnValue(
      makeSchemaClient({
        audit_logs: [
          {
            data: [
              {
                id: "log-2",
                actor_user_id: null,
                action: "role.created",
                target_type: "role",
                target_id: "role-1",
                metadata: {},
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            error: null,
          },
        ],
      }),
    );

    const response = await GET(requestWithAuth(`${BASE_URL}?organizationId=org-1`));
    const body = await response.json();
    expect(body.logs[0].actorEmail).toBeNull();
  });

  it("returns 500 and logs when the query errors", async () => {
    createClientMock.mockReturnValue(makeSchemaClient({ audit_logs: [{ data: null, error: { message: "db exploded" } }] }));
    const response = await GET(requestWithAuth(`${BASE_URL}?organizationId=org-1`));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("GET /api/audit-logs", { message: "db exploded" }, { organizationId: "org-1" });
  });
});
