import { type PermissionChecker, createPermissionChecker } from "@kontrolia/permissions";
import type { KontroliaMembershipWithOrganization, KontroliaOrganization, KontroliaUser } from "@kontrolia/shared";
import { createBrowserClient } from "@supabase/ssr";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { decodeAccessToken } from "./jwt.js";
import { mapMembershipRows } from "./membership-mapping.js";
import { generatePkcePair } from "./pkce.js";
import { mapToKontroliaUser } from "./user-mapping.js";
import type {
  AuthenticatorAssuranceLevel,
  AuthStateListener,
  KontroliaClientConfig,
  KontroliaSessionState,
  LoginCredentials,
  MfaEnrollment,
  MfaFactor,
  OAuthAuthorizationResult,
  OAuthProvider,
  OAuthServerAuthorizeRequest,
  OAuthServerAuthorizeResult,
  OrganizationMembersPage,
  RegisterInput,
  Unsubscribe,
  UpdateProfileInput,
} from "./types.js";

const KONTROLIA_SCHEMA = "kontrolia_auth";

function toKontroliaUser(session: Session | null): KontroliaUser | null {
  if (!session?.user) return null;
  const { user } = session;
  return mapToKontroliaUser({
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
    lastSeenAt: user.last_sign_in_at,
  });
}

/**
 * The only supported way to integrate an application with KontrolIA Auth.
 * Wraps @supabase/supabase-js entirely — consumers never see a Supabase
 * client, a JWT, or an OAuth redirect.
 */
export class KontroliaClient {
  private readonly supabase: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;
  private readonly authServerUrl?: string;
  private listeners = new Set<AuthStateListener>();

  constructor(config: KontroliaClientConfig) {
    // createBrowserClient (not plain supabase-js createClient) stores the
    // session in cookies instead of localStorage — the same cookies
    // @kontrolia/next's middleware and Route Handlers read server-side via
    // @supabase/ssr's createServerClient. A plain createClient() here would
    // leave the server unable to see the browser's session at all.
    this.supabase = createBrowserClient(config.supabaseUrl, config.supabaseAnonKey, {
      cookieOptions: config.cookieDomain ? { domain: config.cookieDomain } : undefined,
    });
    this.supabaseUrl = config.supabaseUrl.replace(/\/$/, "");
    this.supabaseAnonKey = config.supabaseAnonKey;
    this.authServerUrl = config.authServerUrl?.replace(/\/$/, "");

    this.supabase.auth.onAuthStateChange(() => {
      this.emit();
    });
  }

  private emit() {
    void this.getState().then((state) => {
      for (const listener of this.listeners) listener(state);
    });
  }

  onAuthStateChange(listener: AuthStateListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async login({ email, password }: LoginCredentials): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async register({ email, password, fullName }: RegisterInput): Promise<void> {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: fullName ? { full_name: fullName } : undefined },
    });
    if (error) throw error;
  }

  /**
   * Starts a social login redirect (Google, and whatever other providers
   * the installation enables). The provider's client_id/secret live in the
   * Supabase project's own Auth config — never in application code — so
   * this method works identically regardless of which providers are
   * actually turned on for a given install.
   *
   * redirectTo defaults to `${origin}/auth/callback` — the app must have a
   * Route Handler there that calls exchangeCodeForSession() server-side
   * (see @kontrolia/next), since cookie-based sessions require the PKCE
   * code exchange to happen on the server, not via the URL fragment.
   */
  async loginWithOAuth(provider: OAuthProvider, redirectTo?: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo ?? `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }

  async logout(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async refresh(): Promise<void> {
    const { error } = await this.supabase.auth.refreshSession();
    if (error) throw error;
  }

  async requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async updateProfile(input: UpdateProfileInput): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({
      data: {
        ...(input.fullName !== undefined && { full_name: input.fullName }),
        ...(input.avatarUrl !== undefined && { avatar_url: input.avatarUrl }),
        ...(input.locale !== undefined && { locale: input.locale }),
        ...(input.timezone !== undefined && { timezone: input.timezone }),
      },
    });
    if (error) throw error;
  }

  async getUser(): Promise<KontroliaUser | null> {
    const { data } = await this.supabase.auth.getSession();
    return toKontroliaUser(data.session);
  }

  async isAuthenticated(): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession();
    return data.session !== null;
  }

  async getToken(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async getRoles(): Promise<string[]> {
    const token = await this.getToken();
    if (!token) return [];
    return decodeAccessToken(token)?.roles ?? [];
  }

  async getPermissions(): Promise<string[]> {
    const token = await this.getToken();
    if (!token) return [];
    return decodeAccessToken(token)?.permissions ?? [];
  }

  /** True for a user granted cross-tenant platform-admin status — see kontrolia_auth.platform_admins. */
  async isPlatformAdmin(): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;
    return decodeAccessToken(token)?.is_platform_admin ?? false;
  }

  async getChecker(): Promise<PermissionChecker> {
    const [roles, permissions] = await Promise.all([this.getRoles(), this.getPermissions()]);
    return createPermissionChecker({ roles, permissions });
  }

  async hasPermission(required: string | string[]): Promise<boolean> {
    return (await this.getChecker()).hasPermission(required);
  }

  async hasRole(required: string | string[]): Promise<boolean> {
    return (await this.getChecker()).hasRole(required);
  }

  async getOrganization(): Promise<KontroliaOrganization | null> {
    const token = await this.getToken();
    const orgId = token ? decodeAccessToken(token)?.organization_id : null;
    if (!orgId) return null;

    const { data, error } = await this.supabase
      .schema(KONTROLIA_SCHEMA)
      .from("organizations")
      .select("id, name, slug, settings")
      .eq("id", orgId)
      .single();

    if (error || !data) return null;
    return data as KontroliaOrganization;
  }

  /**
   * Every organization the caller belongs to, with their roles and
   * membership status in each — what a "switch company" selector needs to
   * render before it can call switchOrganization(). Deliberately not on the
   * JWT (see the architecture doc): this queries kontrolia_auth.memberships
   * directly, which RLS already scopes to the caller's own rows.
   */
  async getMemberships(): Promise<KontroliaMembershipWithOrganization[]> {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) return [];

    const { data, error } = await this.supabase
      .schema(KONTROLIA_SCHEMA)
      .from("memberships")
      .select("id, organization_id, status, organization:organizations(id, name, slug, settings), membership_roles(role:roles(slug))")
      .eq("user_id", userData.user.id);

    if (error || !data) return [];
    return mapMembershipRows(data as never);
  }

  /**
   * Every method below (listOrganizationMembers/searchOrganizationMembers/
   * getOrganizationMemberCount) talks to auth-server's own REST API instead
   * of Supabase directly, unlike getMemberships() above — resolving a
   * member's email/name requires the service-role-backed admin lookup
   * auth-server does server-side (kontrolia_auth.memberships has no
   * email/name columns; those live in auth.users, which an RLS-scoped
   * browser client can never read for anyone but itself). Requires
   * config.authServerUrl to be set. Not logged in yet? These return an
   * empty page rather than throwing, matching getMemberships()'s own
   * "not authenticated" behavior above.
   */
  private async fetchOrganizationMembers(
    organizationId: string,
    opts: { search?: string; offset?: number; countOnly?: boolean },
  ): Promise<OrganizationMembersPage> {
    if (!this.authServerUrl) {
      throw new Error(
        "authServerUrl no está configurado en KontroliaClient — es requerido para listOrganizationMembers/searchOrganizationMembers/getOrganizationMemberCount.",
      );
    }
    const token = await this.getToken();
    if (!token) return { members: [], hasMore: false, total: 0 };

    const params = new URLSearchParams({ organizationId });
    if (opts.search) params.set("search", opts.search);
    if (opts.offset) params.set("offset", String(opts.offset));
    if (opts.countOnly) params.set("count", "true");

    const response = await fetch(`${this.authServerUrl}/api/organization-members?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json().catch(() => ({}))) as {
      members?: { userId: string; email: string; name: string | null }[];
      hasMore?: boolean;
      total?: number;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(body.error ?? `No se pudo obtener la lista de miembros (${response.status}).`);
    }

    return {
      members: (body.members ?? []).map((m) => ({ id: m.userId, email: m.email, name: m.name })),
      hasMore: Boolean(body.hasMore),
      total: body.total ?? 0,
    };
  }

  /** Members of an organization the caller belongs to, paginated 100 at a time. */
  async listOrganizationMembers(organizationId: string, options?: { offset?: number }): Promise<OrganizationMembersPage> {
    return this.fetchOrganizationMembers(organizationId, { offset: options?.offset });
  }

  /** Same as listOrganizationMembers, filtered by a case-insensitive substring match on email or name. */
  async searchOrganizationMembers(
    organizationId: string,
    query: string,
    options?: { offset?: number },
  ): Promise<OrganizationMembersPage> {
    return this.fetchOrganizationMembers(organizationId, { search: query, offset: options?.offset });
  }

  /** Total member count for an organization — a fast, rows-free query, not a side effect of fetching a page. */
  async getOrganizationMemberCount(organizationId: string): Promise<number> {
    const page = await this.fetchOrganizationMembers(organizationId, { countOnly: true });
    return page.total;
  }

  /**
   * Switches the user's active organization. Because the JWT carries roles
   * and permissions for a single organization at a time (see the Custom
   * Access Token Hook), this updates kontrolia_auth.sessions_context and forces
   * an immediate session refresh so the new token reflects the new org.
   */
  async switchOrganization(organizationId: string): Promise<void> {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();
    if (userError || !userData.user) throw userError ?? new Error("Not authenticated");

    const { error: upsertError } = await this.supabase
      .schema(KONTROLIA_SCHEMA)
      .from("sessions_context")
      .upsert({ user_id: userData.user.id, active_organization_id: organizationId, updated_at: new Date().toISOString() });
    if (upsertError) throw upsertError;

    await this.refresh();
  }

  /**
   * Builds the URL to send the browser to for the OAuth 2.1 authorization
   * code flow (PKCE) against this project's own GoTrue OAuth server — the
   * mechanism a first-party app on a *different* domain than auth-server
   * uses to get its own session, since a shared session cookie is only
   * possible between subdomains of one domain. Persist the returned
   * codeVerifier (e.g. sessionStorage) before navigating; you'll need it
   * again in exchangeOAuthServerCode() once the redirect completes.
   */
  async buildOAuthServerAuthorizeUrl(request: OAuthServerAuthorizeRequest): Promise<OAuthServerAuthorizeResult> {
    const { verifier, challenge } = await generatePkcePair();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: request.clientId,
      redirect_uri: request.redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      scope: request.scope ?? "openid",
    });
    if (request.state) params.set("state", request.state);
    return { url: `${this.supabaseUrl}/auth/v1/oauth/authorize?${params.toString()}`, codeVerifier: verifier };
  }

  /**
   * Completes the flow started by buildOAuthServerAuthorizeUrl(): exchanges
   * the authorization code GoTrue redirected back with for a real session,
   * and establishes it on this client exactly as login() would (same
   * cookie-backed storage) — the app calling this never sees the tokens.
   */
  async exchangeOAuthServerCode(params: {
    clientId: string;
    redirectUri: string;
    code: string;
    codeVerifier: string;
  }): Promise<void> {
    const response = await fetch(`${this.supabaseUrl}/auth/v1/oauth/token`, {
      method: "POST",
      headers: { apikey: this.supabaseAnonKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        code_verifier: params.codeVerifier,
      }),
    });
    if (!response.ok) throw new Error(`OAuth token exchange failed (${response.status}): ${await response.text()}`);
    const tokens = (await response.json()) as { access_token: string; refresh_token: string };
    const { error } = await this.supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    if (error) throw error;
  }

  /**
   * For the consent screen: fetches what a pending authorization_id is
   * asking for (which client, whose account, what scope) so the hosting app
   * (auth-server) can decide whether to auto-approve it (a first-party app
   * it trusts) or show the visitor an explicit approve/deny screen.
   */
  async getOAuthAuthorizationDetails(authorizationId: string): Promise<OAuthAuthorizationResult> {
    const token = await this.getToken();
    if (!token) throw new Error("Not authenticated");
    const response = await fetch(`${this.supabaseUrl}/auth/v1/oauth/authorizations/${authorizationId}`, {
      headers: { apikey: this.supabaseAnonKey, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Failed to load authorization details (${response.status})`);
    const data = (await response.json()) as {
      redirect_url?: string;
      authorization_id?: string;
      redirect_uri?: string;
      client?: { id: string; name: string };
      user?: { id: string; email: string | null };
      scope?: string;
    };
    // GoTrue auto-decides for some clients right on this GET — no separate
    // consent step exists to call in that case, just follow the URL it gave us.
    if (data.redirect_url) {
      return { status: "decided", redirectUrl: data.redirect_url };
    }
    return {
      status: "pending",
      details: {
        authorizationId: data.authorization_id!,
        redirectUri: data.redirect_uri!,
        client: data.client!,
        user: data.user!,
        scope: data.scope!,
      },
    };
  }

  /** Approves or denies a pending authorization — returns the URL to send the browser to next. */
  async decideOAuthAuthorization(authorizationId: string, action: "approve" | "deny"): Promise<string> {
    const token = await this.getToken();
    if (!token) throw new Error("Not authenticated");
    const response = await fetch(`${this.supabaseUrl}/auth/v1/oauth/authorizations/${authorizationId}/consent`, {
      method: "POST",
      headers: { apikey: this.supabaseAnonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) throw new Error(`Failed to ${action} authorization (${response.status})`);
    const data = (await response.json()) as { redirect_url: string };
    return data.redirect_url;
  }

  /**
   * Starts TOTP enrollment — returns a QR code (and raw secret, for
   * authenticator apps that don't scan) but does NOT activate the factor
   * yet. Call verifyMfaEnrollment() with a code from the authenticator app
   * to complete it; an unverified factor doesn't affect login.
   */
  async enrollMfa(friendlyName?: string): Promise<MfaEnrollment> {
    const { data, error } = await this.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName });
    if (error) throw error;
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
  }

  /** Completes enrollment for a factor returned by enrollMfa(), given a code from the authenticator app. */
  async verifyMfaEnrollment(factorId: string, code: string): Promise<void> {
    const { data: challenge, error: challengeError } = await this.supabase.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;
    const { error: verifyError } = await this.supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) throw verifyError;
  }

  /** Starts a login-time MFA challenge for an already-verified factor. */
  async challengeMfa(factorId: string): Promise<string> {
    const { data, error } = await this.supabase.auth.mfa.challenge({ factorId });
    if (error) throw error;
    return data.id;
  }

  async verifyMfaChallenge(factorId: string, challengeId: string, code: string): Promise<void> {
    const { error } = await this.supabase.auth.mfa.verify({ factorId, challengeId, code });
    if (error) throw error;
  }

  async listMfaFactors(): Promise<MfaFactor[]> {
    const { data, error } = await this.supabase.auth.mfa.listFactors();
    if (error) throw error;
    return (data.totp ?? []).map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name ?? null,
      factorType: f.factor_type,
      status: f.status,
    }));
  }

  async unenrollMfa(factorId: string): Promise<void> {
    const { error } = await this.supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
  }

  /**
   * currentLevel vs nextLevel diverging (aal1 -> aal2) is how you detect a
   * pending MFA challenge after login() — the password was right, but the
   * session isn't fully elevated until challengeMfa()/verifyMfaChallenge()
   * completes.
   */
  async getAuthenticatorAssuranceLevel(): Promise<AuthenticatorAssuranceLevel> {
    const { data, error } = await this.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return { currentLevel: data.currentLevel, nextLevel: data.nextLevel };
  }

  private async getState(): Promise<KontroliaSessionState> {
    const [user, organization, roles, permissions] = await Promise.all([
      this.getUser(),
      this.getOrganization(),
      this.getRoles(),
      this.getPermissions(),
    ]);
    return { user, organization, roles, permissions };
  }
}

export function createKontroliaClient(config: KontroliaClientConfig): KontroliaClient {
  return new KontroliaClient(config);
}
