import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAdminClient } from "./test-helpers";

const verifyRequestMock = vi.fn();
vi.mock("@kontrolia/auth/server", () => ({
  verifyRequest: (...args: unknown[]) => verifyRequestMock(...args),
}));

const createSupabaseAdminClientMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

const logErrorMock = vi.fn();
const logSecurityEventMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
  logSecurityEvent: (...args: unknown[]) => logSecurityEventMock(...args),
}));

const { POST, DELETE } = await import("../instance-settings/logo/route");

const BASE_URL = "https://auth.example.com/api/instance-settings/logo";
const ROW = { registration_enabled: true, theme: "system", button_color: null, logo_url: null };

function requestWithAuth(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { Authorization: "Bearer test-token", ...init?.headers } });
}

function claimsFor(userId: string, isPlatformAdmin: boolean) {
  return { claims: { sub: userId, is_platform_admin: isPlatformAdmin } };
}

function uploadFormRequest(file: File): Request {
  const formData = new FormData();
  formData.append("file", file);
  return new Request(BASE_URL, { method: "POST", headers: { Authorization: "Bearer test-token" }, body: formData });
}

function makeStorageMock(overrides: {
  upload?: ReturnType<typeof vi.fn>;
  remove?: ReturnType<typeof vi.fn>;
  getPublicUrl?: ReturnType<typeof vi.fn>;
}) {
  return () => ({
    upload: overrides.upload ?? vi.fn().mockResolvedValue({ error: null }),
    remove: overrides.remove ?? vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl:
      overrides.getPublicUrl ??
      vi.fn().mockReturnValue({ data: { publicUrl: "https://supabase.local/storage/v1/object/public/branding/logo.png" } }),
  });
}

beforeEach(() => {
  verifyRequestMock.mockReset();
  createSupabaseAdminClientMock.mockReset();
  logErrorMock.mockReset();
  logSecurityEventMock.mockReset();
});

describe("POST /api/instance-settings/logo — auth gate", () => {
  it("returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await POST(uploadFormRequest(new File(["x"], "logo.png", { type: "image/png" })));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-platform-admin caller", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("user-1", false));
    const response = await POST(uploadFormRequest(new File(["x"], "logo.png", { type: "image/png" })));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/instance-settings/logo — validation", () => {
  beforeEach(() => verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true)));

  it("returns 400 when no file is attached", async () => {
    const response = await POST(
      new Request(BASE_URL, { method: "POST", headers: { Authorization: "Bearer test-token" }, body: new FormData() }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects an unsupported content type", async () => {
    const response = await POST(uploadFormRequest(new File(["x"], "logo.gif", { type: "image/gif" })));
    expect(response.status).toBe(400);
  });

  it("rejects a file over 2MB", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    const response = await POST(uploadFormRequest(new File([big], "logo.png", { type: "image/png" })));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/instance-settings/logo — happy path", () => {
  it("clears every known extension, uploads, updates the row, and returns a cache-busted URL", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    const removeMock = vi.fn().mockResolvedValue({ error: null });
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient(
        { instance_settings: [{ error: null }] },
        undefined,
        makeStorageMock({ upload: uploadMock, remove: removeMock }),
      ),
    );

    const response = await POST(uploadFormRequest(new File(["x"], "logo.png", { type: "image/png" })));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { logoUrl: string };
    expect(body.logoUrl).toMatch(/^https:\/\/supabase\.local\/storage\/v1\/object\/public\/branding\/logo\.png\?v=\d+$/);
    expect(removeMock).toHaveBeenCalledWith(["logo.png", "logo.jpg", "logo.svg", "logo.webp"]);
    expect(uploadMock).toHaveBeenCalledWith("logo.png", expect.anything(), expect.objectContaining({ upsert: true }));
    expect(logSecurityEventMock).toHaveBeenCalledWith("instance-settings: logo uploaded", { userId: "admin-1" });
  });

  it("returns 500 and logs when the storage upload fails", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient({}, undefined, makeStorageMock({ upload: vi.fn().mockResolvedValue({ error: { message: "disk full" } }) })),
    );

    const response = await POST(uploadFormRequest(new File(["x"], "logo.png", { type: "image/png" })));
    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith(
      "POST /api/instance-settings/logo",
      { message: "disk full" },
      { userId: "admin-1" },
    );
  });
});

describe("DELETE /api/instance-settings/logo", () => {
  it("returns 401 when unauthenticated", async () => {
    verifyRequestMock.mockRejectedValue(new Response("Unauthorized", { status: 401 }));
    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }));
    expect(response.status).toBe(401);
  });

  it("removes known logo files, clears logo_url, and returns fresh settings", async () => {
    verifyRequestMock.mockResolvedValue(claimsFor("admin-1", true));
    const removeMock = vi.fn().mockResolvedValue({ error: null });
    createSupabaseAdminClientMock.mockReturnValue(
      makeAdminClient(
        { instance_settings: [{ error: null }, { data: ROW, error: null }] },
        undefined,
        makeStorageMock({ remove: removeMock }),
      ),
    );

    const response = await DELETE(requestWithAuth(BASE_URL, { method: "DELETE" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ registrationEnabled: true, theme: "system", buttonColor: null, logoUrl: null });
    expect(removeMock).toHaveBeenCalledWith(["logo.png", "logo.jpg", "logo.svg", "logo.webp"]);
    expect(logSecurityEventMock).toHaveBeenCalledWith("instance-settings: logo removed", { userId: "admin-1" });
  });
});
