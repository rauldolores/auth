import { type PermissionChecker, createPermissionChecker } from "@kontrolia/permissions";
import type { KontroliaOrganization, KontroliaUser } from "@kontrolia/shared";
import { type Session, type SupabaseClient, createClient } from "@supabase/supabase-js";
import { decodeAccessToken } from "./jwt.js";
import type {
  AuthStateListener,
  KontroliaClientConfig,
  KontroliaSessionState,
  LoginCredentials,
  RegisterInput,
  Unsubscribe,
  UpdateProfileInput,
} from "./types.js";

const KONTROLIA_SCHEMA = "kontrolia";

function toKontroliaUser(session: Session | null): KontroliaUser | null {
  if (!session?.user) return null;
  const { user } = session;
  return {
    id: user.id,
    email: user.email ?? null,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    locale: (user.user_metadata?.locale as string | undefined) ?? null,
    timezone: (user.user_metadata?.timezone as string | undefined) ?? null,
    lastSeenAt: user.last_sign_in_at ?? null,
  };
}

/**
 * The only supported way to integrate an application with KontrolIA Auth.
 * Wraps @supabase/supabase-js entirely — consumers never see a Supabase
 * client, a JWT, or an OAuth redirect.
 */
export class KontroliaClient {
  private readonly supabase: SupabaseClient;
  private listeners = new Set<AuthStateListener>();

  constructor(config: KontroliaClientConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

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
   * Switches the user's active organization. Because the JWT carries roles
   * and permissions for a single organization at a time (see the Custom
   * Access Token Hook), this updates kontrolia.sessions_context and forces
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
