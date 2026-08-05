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
