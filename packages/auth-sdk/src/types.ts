import type { KontroliaOrganization, KontroliaUser } from "@kontrolia/shared";

export interface KontroliaClientConfig {
  /** URL of the Supabase project GoTrue/Postgres this app authenticates against. */
  supabaseUrl: string;
  /** Supabase anon/public key — safe to expose in the browser. */
  supabaseAnonKey: string;
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
