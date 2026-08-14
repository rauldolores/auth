import { logError } from "@/lib/logger";

/**
 * GoTrue's own public `/auth/v1/settings` endpoint — no auth required,
 * present on every deployment (self-hosted Docker or Supabase Cloud). It
 * reports which external OAuth providers are ACTUALLY wired up right now,
 * independent of anything this app tracks — the single source of truth for
 * whether the "Continuar con Google/Microsoft" buttons should render, and
 * for the read-only status half of admin-panel's Social login screen when
 * the Supabase Management API isn't configured (see supabase-management.ts).
 */

export interface GotrueExternalSettings {
  googleEnabled: boolean;
  azureEnabled: boolean;
}

const DEFAULT_SETTINGS: GotrueExternalSettings = { googleEnabled: false, azureEnabled: false };
const TIMEOUT_MS = 5_000;

export async function getGotrueExternalSettings(): Promise<GotrueExternalSettings> {
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return DEFAULT_SETTINGS;
    const data = (await response.json()) as { external?: { google?: boolean; azure?: boolean } };
    return {
      googleEnabled: Boolean(data.external?.google),
      azureEnabled: Boolean(data.external?.azure),
    };
  } catch (error) {
    // Fail closed — an unreachable GoTrue should hide the buttons, not show
    // a login option that's actually broken.
    logError("gotrue-settings:getGotrueExternalSettings", error);
    return DEFAULT_SETTINGS;
  }
}
