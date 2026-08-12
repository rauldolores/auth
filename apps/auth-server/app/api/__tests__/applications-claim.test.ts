import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { makeSchemaClient } from "./test-helpers";

// Closes INT-API-007/INT-API-008/PQ-TECH-010: this is the only place
// applications.owner_organization_id can ever be set, since no RLS policy
// permits it for a regular user (see migration 0034's comment) and the CLI
// wizard never asks which org should own the app it registers.
const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const verifyRequestMock = vi.fn();
vi.mock("@kontrolia/auth/server", () => ({
  verifyRequest: (...args: unknown[]) => verifyRequestMock(...args),
}));

const logErrorMock = vi.fn();
const logSecurityEventMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
  logSecurityEvent: (...args: unknown[]) => logSecurityEventMock(...args),
}));

const { POST } = await import("../applications/claim/route");

const BASE_URL = "https://auth.example.com/api/applications/claim";

function requestWithAuth(body: unknown, init?: RequestInit): Request {
  return new Request(BASE_URL, {
    method: "POST",
    ...init,
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json", ...init?.headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
  verifyRequestMock.mockReset();
  logErrorMock.mockReset();
  logSecurityEventMock.mockReset();
  resetRateLimitsForTests();
});

describe("platform-admin gate", () => {
  it("returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await POST(requestWithAuth({ applicationId: "app-1", organizationId: "org-1" }));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false } });
    const response = await POST(requestWithAuth({ applicationId: "app-1", organizationId: "org-1" }));
    expect(response.status).toBe(403);
  });

  it("rate limits after too many requests from the same IP within the window", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: false } });
    const makeRequest = () =>
      requestWithAuth({ applicationId: "app-1", organizationId: "org-1" }, { headers: { "X-Forwarded-For": "198.51.100.9" } });

    for (let i = 0; i < 30; i++) {
      const response = await POST(makeRequest());
      expect(response.status).not.toBe(429);
    }

    const limited = await POST(makeRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect(logSecurityEventMock).toHaveBeenCalledWith("applications/claim: rate limited", { ip: "198.51.100.9" });
  });
});

describe("POST /api/applications/claim", () => {
  it("returns 400 when applicationId or organizationId is missing", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    const response = await POST(requestWithAuth({ applicationId: "app-1" }));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the application doesn't exist", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(makeSchemaClient({ applications: [{ data: null, error: null }] }));
    const response = await POST(requestWithAuth({ applicationId: "app-1", organizationId: "org-1" }));
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Aplicación no encontrada");
  });

  it("returns 409 when the application already has an owner", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeSchemaClient({ applications: [{ data: { id: "app-1", owner_organization_id: "org-existing" }, error: null }] }),
    );
    const response = await POST(requestWithAuth({ applicationId: "app-1", organizationId: "org-1" }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("Esta aplicación ya tiene una organización propietaria.");
  });

  it("returns 404 when the target organization doesn't exist", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeSchemaClient({
        applications: [{ data: { id: "app-1", owner_organization_id: null }, error: null }],
        organizations: [{ data: null, error: null }],
      }),
    );
    const response = await POST(requestWithAuth({ applicationId: "app-1", organizationId: "org-missing" }));
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Organización no encontrada");
  });

  it("claims an unowned application for the given organization", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeSchemaClient({
        applications: [
          { data: { id: "app-1", owner_organization_id: null }, error: null },
          { data: { id: "app-1", slug: "facturacion", owner_organization_id: "org-1" }, error: null },
        ],
        organizations: [{ data: { id: "org-1" }, error: null }],
      }),
    );
    const response = await POST(requestWithAuth({ applicationId: "app-1", organizationId: "org-1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      application: { id: "app-1", slug: "facturacion", owner_organization_id: "org-1" },
    });
  });

  it("returns 500 and logs when the update fails", async () => {
    verifyRequestMock.mockResolvedValue({ claims: { is_platform_admin: true } });
    createSupabaseAdminClientMock.mockReturnValue(
      makeSchemaClient({
        applications: [
          { data: { id: "app-1", owner_organization_id: null }, error: null },
          { data: null, error: { message: "update failed" } },
        ],
        organizations: [{ data: { id: "org-1" }, error: null }],
      }),
    );
    const response = await POST(requestWithAuth({ applicationId: "app-1", organizationId: "org-1" }));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith(
      "POST /api/applications/claim",
      { message: "update failed" },
      { applicationId: "app-1", organizationId: "org-1" },
    );
  });
});
