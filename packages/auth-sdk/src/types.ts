import type { KontroliaOrganization, KontroliaUser } from "@kontrolia/shared";

export interface KontroliaClientConfig {
  /** URL of the Supabase project GoTrue/Postgres this app authenticates against. */
  supabaseUrl: string;
  /** Supabase anon/public key — safe to expose in the browser. */
  supabaseAnonKey: string;
  /**
   * Only needed when auth-server and admin-panel (or any other app sharing
   * this session) are deployed on different subdomains of the same domain,
   * e.g. "auth.example.com" and "admin.example.com" — set this to
   * ".example.com" so the session cookie is readable by both. Leave unset
   * when both apps share the same host (including "localhost" during local
   * development, where the browser already shares cookies across ports).
   */
  cookieDomain?: string;
  /**
   * Base URL of this installation's auth-server (e.g. "https://auth.example.com"),
   * with no trailing slash needed. Only required for the handful of methods
   * that go through auth-server's own REST API instead of talking to
   * Supabase directly — listOrganizationMembers, searchOrganizationMembers,
   * getOrganizationMemberCount — since resolving a member's email/name
   * needs a service-role-backed lookup a browser client can never do on its
   * own. Leave unset if your app doesn't call those.
   */
  authServerUrl?: string;
}

/** One member of an organization, as returned by listOrganizationMembers/searchOrganizationMembers. */
export interface OrganizationMember {
  /** The member's user id (auth.users.id) — not a membership row id. */
  id: string;
  email: string;
  /** From user_metadata.full_name, set at registration — null if never provided. */
  name: string | null;
}

export interface OrganizationMembersPage {
  members: OrganizationMember[];
  /** True if there are more members beyond this page — pass a higher `offset` to fetch them. */
  hasMore: boolean;
  /** Total members matching the query (the whole org for listOrganizationMembers, or the search results for searchOrganizationMembers) — independent of pagination. */
  total: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName?: string;
}

/**
 * Social providers KontrolIA Auth's SDK knows how to start a redirect for.
 * Whether one actually works depends entirely on whether that provider is
 * enabled in the installation's own Supabase project — this list is not a
 * promise every install supports every provider.
 */
export type OAuthProvider = "google" | "azure";

export interface MfaEnrollment {
  factorId: string;
  /** SVG QR code as a data URI — hand straight to an <img src=...>. */
  qrCode: string;
  /** Raw TOTP secret, for authenticator apps that don't support scanning. */
  secret: string;
  /** Full otpauth:// URI, in case a consuming app wants to render its own QR code. */
  uri: string;
}

export interface MfaFactor {
  id: string;
  friendlyName: string | null;
  factorType: string;
  status: "verified" | "unverified";
}

export interface OAuthServerAuthorizeRequest {
  /** Client ID GoTrue issued when this app was registered as an OAuth client. */
  clientId: string;
  /** Must exactly match one of the redirect_uris registered for that client. */
  redirectUri: string;
  scope?: string;
  /** Round-tripped back unchanged — typically the page to return to after the exchange. */
  state?: string;
}

export interface OAuthServerAuthorizeResult {
  /** Navigate the browser here (a real navigation, not a fetch — it's a cross-app redirect). */
  url: string;
  /** Persist this (e.g. sessionStorage) — needed again in exchangeOAuthServerCode() after the redirect completes. */
  codeVerifier: string;
}

export interface OAuthAuthorizationDetails {
  authorizationId: string;
  redirectUri: string;
  client: { id: string; name: string };
  user: { id: string; email: string | null };
  scope: string;
}

/**
 * GoTrue's authorization-details endpoint doesn't always hand back a
 * pending authorization to show a consent screen for — for some clients it
 * auto-decides on the very first GET and returns the same redirect_url a
 * POST .../consent would have, with no separate approval step at all.
 * Callers must branch on `status` before assuming `details` exists.
 */
export type OAuthAuthorizationResult =
  | { status: "pending"; details: OAuthAuthorizationDetails }
  | { status: "decided"; redirectUrl: string };

export interface AuthenticatorAssuranceLevel {
  /** In practice always "aal1" | "aal2" | null — typed loosely to match Supabase's own forward-compatible type. */
  currentLevel: string | null;
  nextLevel: string | null;
}

export interface UpdateProfileInput {
  fullName?: string;
  avatarUrl?: string;
  locale?: string;
  timezone?: string;
}

export interface KontroliaSessionState {
  user: KontroliaUser | null;
  organization: KontroliaOrganization | null;
  roles: string[];
  permissions: string[];
}

export type AuthStateListener = (state: KontroliaSessionState) => void;
export type Unsubscribe = () => void;
