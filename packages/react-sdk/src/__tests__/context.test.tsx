import type { KontroliaOrganization, KontroliaSessionState, KontroliaUser } from "@kontrolia/shared";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useKontroliaAuthContext } from "../context.js";

/**
 * AuthProvider's own job is the reactive state machine: call the SDK client
 * once on mount, expose {isLoading, isAuthenticated, user, organization,
 * roles, permissions, checker} to consumers, and re-derive that same shape
 * whenever the client's onAuthStateChange listener fires. The underlying
 * KontroliaClient (cookie/session wiring, network calls) is @kontrolia/auth's
 * own concern and already covered by that package's tests, so — exactly
 * like next-sdk's middleware.test.ts mocks @supabase/ssr to isolate the
 * middleware's own routing logic — we mock createKontroliaClient here to
 * isolate AuthProvider's own state transitions from the real SDK.
 */
const getUserMock = vi.fn();
const getOrganizationMock = vi.fn();
const getRolesMock = vi.fn();
const getPermissionsMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const unsubscribeMock = vi.fn();

let capturedListener: ((state: KontroliaSessionState) => void) | undefined;

vi.mock("@kontrolia/auth", () => ({
  createKontroliaClient: vi.fn(() => ({
    getUser: getUserMock,
    getOrganization: getOrganizationMock,
    getRoles: getRolesMock,
    getPermissions: getPermissionsMock,
    onAuthStateChange: onAuthStateChangeMock,
  })),
}));

// @testing-library/react's automatic afterEach(cleanup) only registers
// itself when it finds a global `afterEach` on globalThis; this suite
// imports vitest's test functions explicitly rather than relying on
// vitest's `globals: true`, so each mounted tree must be unmounted by hand
// or later tests' queries (getByTestId etc.) see every previous render too.
afterEach(() => cleanup());

const baseConfig = { supabaseUrl: "https://project.supabase.co", supabaseAnonKey: "anon-key" };

const fakeUser: KontroliaUser = {
  id: "user-1",
  email: "user@example.com",
  fullName: "Ada Lovelace",
  avatarUrl: null,
  locale: "es-MX",
  timezone: "America/Mexico_City",
  lastSeenAt: null,
};

const fakeOrg: KontroliaOrganization = { id: "org-1", name: "Acme", slug: "acme", settings: {} };

function ProbeConsumer() {
  const ctx = useKontroliaAuthContext();
  return (
    <div>
      <span data-testid="isLoading">{String(ctx.isLoading)}</span>
      <span data-testid="isAuthenticated">{String(ctx.isAuthenticated)}</span>
      <span data-testid="userId">{ctx.user?.id ?? "none"}</span>
      <span data-testid="orgId">{ctx.organization?.id ?? "none"}</span>
      <span data-testid="roles">{ctx.roles.join(",") || "none"}</span>
      <span data-testid="hasPermission">{String(ctx.checker.hasPermission("facturacion.facturas.crear"))}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    getUserMock.mockReset().mockResolvedValue(null);
    getOrganizationMock.mockReset().mockResolvedValue(null);
    getRolesMock.mockReset().mockResolvedValue([]);
    getPermissionsMock.mockReset().mockResolvedValue([]);
    unsubscribeMock.mockReset();
    capturedListener = undefined;
    onAuthStateChangeMock.mockReset().mockImplementation((listener: (state: KontroliaSessionState) => void) => {
      capturedListener = listener;
      return unsubscribeMock;
    });
  });

  it("initializes with a loading state, then resolves to the unauthenticated shape with no session (no crash, no loop)", async () => {
    render(
      <AuthProvider config={baseConfig}>
        <ProbeConsumer />
      </AuthProvider>,
    );

    // Synchronously after mount, the initial session lookup hasn't resolved
    // yet — isLoading must start true so guards don't briefly flash
    // "logged out" content before the real answer is known.
    expect(screen.getByTestId("isLoading").textContent).toBe("true");

    await waitFor(() => expect(screen.getByTestId("isLoading").textContent).toBe("false"));

    expect(screen.getByTestId("isAuthenticated").textContent).toBe("false");
    expect(screen.getByTestId("userId").textContent).toBe("none");
    expect(screen.getByTestId("orgId").textContent).toBe("none");
    expect(screen.getByTestId("roles").textContent).toBe("none");
    expect(screen.getByTestId("hasPermission").textContent).toBe("false");

    // Exactly one initial load — not re-fetching in a loop.
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(getOrganizationMock).toHaveBeenCalledTimes(1);
    expect(getRolesMock).toHaveBeenCalledTimes(1);
    expect(getPermissionsMock).toHaveBeenCalledTimes(1);
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1);
  });

  it("exposes the full KontroliaAuthState shape (client, checker, roles/permissions arrays) to consumers", async () => {
    let seenKeys: string[] = [];
    function ShapeProbe() {
      const ctx = useKontroliaAuthContext();
      seenKeys = Object.keys(ctx).sort();
      return null;
    }

    render(
      <AuthProvider config={baseConfig}>
        <ShapeProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(seenKeys).toEqual(
        ["checker", "client", "isAuthenticated", "isLoading", "organization", "permissions", "roles", "user"].sort(),
      ),
    );
  });

  it("transitions consumers to the authenticated shape when the client reports a session established", async () => {
    render(
      <AuthProvider config={baseConfig}>
        <ProbeConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("isLoading").textContent).toBe("false"));
    expect(screen.getByTestId("isAuthenticated").textContent).toBe("false");

    act(() => {
      capturedListener!({
        user: fakeUser,
        organization: fakeOrg,
        roles: ["billing_clerk"],
        permissions: ["facturacion.facturas.crear"],
      });
    });

    await waitFor(() => expect(screen.getByTestId("isAuthenticated").textContent).toBe("true"));
    expect(screen.getByTestId("userId").textContent).toBe("user-1");
    expect(screen.getByTestId("orgId").textContent).toBe("org-1");
    expect(screen.getByTestId("roles").textContent).toBe("billing_clerk");
    expect(screen.getByTestId("hasPermission").textContent).toBe("true");
  });

  it("transitions consumers back to the cleared/unauthenticated shape when the client reports sign-out", async () => {
    // Start already authenticated, established via the same
    // onAuthStateChange path the previous test exercises.
    render(
      <AuthProvider config={baseConfig}>
        <ProbeConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("isLoading").textContent).toBe("false"));
    act(() => {
      capturedListener!({ user: fakeUser, organization: fakeOrg, roles: ["admin"], permissions: ["*.*.*"] });
    });
    await waitFor(() => expect(screen.getByTestId("isAuthenticated").textContent).toBe("true"));

    act(() => {
      capturedListener!({ user: null, organization: null, roles: [], permissions: [] });
    });

    await waitFor(() => expect(screen.getByTestId("isAuthenticated").textContent).toBe("false"));
    expect(screen.getByTestId("userId").textContent).toBe("none");
    expect(screen.getByTestId("orgId").textContent).toBe("none");
    expect(screen.getByTestId("roles").textContent).toBe("none");
    expect(screen.getByTestId("hasPermission").textContent).toBe("false");
  });

  it("starts already-authenticated when the initial session lookup itself returns a user", async () => {
    getUserMock.mockResolvedValue(fakeUser);
    getOrganizationMock.mockResolvedValue(fakeOrg);
    getRolesMock.mockResolvedValue(["admin"]);
    getPermissionsMock.mockResolvedValue(["facturacion.facturas.crear"]);

    render(
      <AuthProvider config={baseConfig}>
        <ProbeConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("isLoading").textContent).toBe("false"));
    expect(screen.getByTestId("isAuthenticated").textContent).toBe("true");
    expect(screen.getByTestId("userId").textContent).toBe("user-1");
  });

  it("unsubscribes from the client's auth-state listener on unmount", async () => {
    const { unmount } = render(
      <AuthProvider config={baseConfig}>
        <ProbeConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("isLoading").textContent).toBe("false"));

    expect(unsubscribeMock).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});

describe("useKontroliaAuthContext", () => {
  it("throws a descriptive error when used outside of an <AuthProvider>", () => {
    function Orphan() {
      useKontroliaAuthContext();
      return null;
    }
    // Suppress React's expected error-boundary console.error noise for this
    // deliberate throw-on-render case.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow("useAuth() must be used within an <AuthProvider>");
    consoleError.mockRestore();
  });
});
