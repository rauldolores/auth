import { createSupabaseAdminClient } from "./supabase-admin";

export interface InstanceSettings {
  registrationEnabled: boolean;
  theme: "light" | "dark" | "system";
  buttonColor: string | null;
  logoUrl: string | null;
}

const DEFAULT_SETTINGS: InstanceSettings = {
  registrationEnabled: true,
  theme: "system",
  buttonColor: null,
  logoUrl: null,
};

interface InstanceSettingsRow {
  registration_enabled: boolean;
  theme: "light" | "dark" | "system";
  button_color: string | null;
  logo_url: string | null;
}

/**
 * Reads the singleton instance_settings row. Used both by the /api/instance-settings
 * route (for admin-panel) and directly by the (auth) route group's server-component
 * layout (avoids an HTTP round-trip to its own API for the same data).
 */
export async function getInstanceSettings(): Promise<InstanceSettings> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("kontrolia_auth")
    .from("instance_settings")
    .select("registration_enabled, theme, button_color, logo_url")
    .eq("id", true)
    .maybeSingle<InstanceSettingsRow>();

  if (!data) return DEFAULT_SETTINGS;

  return {
    registrationEnabled: data.registration_enabled,
    theme: data.theme,
    buttonColor: data.button_color,
    logoUrl: data.logo_url,
  };
}
