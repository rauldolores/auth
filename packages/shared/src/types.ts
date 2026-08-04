export interface KontroliaUser {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  locale: string | null;
  timezone: string | null;
  lastSeenAt: string | null;
}

export interface KontroliaOrganization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
}

export interface KontroliaMembership {
  id: string;
  organizationId: string;
  status: "active" | "invited" | "suspended";
  roles: string[];
}

/**
 * Shape of the custom claims injected by kontrolia.custom_access_token_hook
 * (see packages/db/migrations/0007_custom_access_token_hook.sql). Present
 * under the top-level JWT claims, decoded by @kontrolia/auth.
 */
export interface KontroliaTokenClaims {
  sub: string;
  /** Correlates to auth.sessions.id — used to identify/revoke this specific device's session. */
  session_id: string;
  organization_id: string | null;
  roles: string[];
  permissions: string[];
  exp: number;
  [key: string]: unknown;
}

export interface KontroliaInvitation {
  id: string;
  organizationId: string;
  email: string;
  roleId: string | null;
  expiresAt: string;
}

/** A single "resource.action" permission key, e.g. "facturacion.facturas.crear". */
export type PermissionKey = string;
