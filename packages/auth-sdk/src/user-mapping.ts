import type { KontroliaUser } from "@kontrolia/shared";

interface UserMetadataShape {
  full_name?: string | null;
  avatar_url?: string | null;
  locale?: string | null;
  timezone?: string | null;
}

interface KontroliaUserSource {
  id: string;
  email?: string | null;
  user_metadata?: UserMetadataShape | null;
  /** Not present in a decoded JWT — only the client-side Session.user object has it. */
  lastSeenAt?: string | null;
}

/**
 * Single field-mapping core for KontroliaUser, shared by client.ts's
 * toKontroliaUser() (from a Supabase Session.user, browser-side) and
 * server.ts's getUserFromClaims() (from decoded JWT claims, server-side) —
 * both read the exact same user_metadata keys, so this is the one place
 * that mapping can drift if it's ever changed.
 */
export function mapToKontroliaUser(source: KontroliaUserSource): KontroliaUser {
  const metadata = source.user_metadata ?? {};
  return {
    id: source.id,
    email: source.email ?? null,
    fullName: metadata.full_name ?? null,
    avatarUrl: metadata.avatar_url ?? null,
    locale: metadata.locale ?? null,
    timezone: metadata.timezone ?? null,
    lastSeenAt: source.lastSeenAt ?? null,
  };
}
