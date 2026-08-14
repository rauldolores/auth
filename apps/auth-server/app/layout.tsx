import type { Metadata } from "next";
import { getGotrueExternalSettings } from "@/lib/gotrue-settings";
import { getInstanceSettings } from "@/lib/instance-settings";
import { InstanceSettingsProvider } from "@/lib/instance-settings-context";
import { buildThemeStyle } from "@/lib/theme-vars";
import { Providers } from "./providers";
import "./globals.css";

// Every page here depends on client-side auth state resolved against a live
// Supabase project — there is nothing meaningful to statically prerender,
// and doing so would require Supabase env vars at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KontrolIA Auth",
  description: "Inicia sesión para continuar",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Both fetched fresh on every request (this layout is force-dynamic) —
  // toggling a social provider from admin-panel's new Social login screen
  // takes effect on the very next page load here, no rebuild/redeploy.
  const [settings, externalSettings] = await Promise.all([getInstanceSettings(), getGotrueExternalSettings()]);

  return (
    <html lang="es">
      {/* The style override has to live on <body> itself, not a wrapper div —
          globals.css's `body { background: hsl(var(--k-background)) }` rule
          resolves the variable at body's own scope, so a value set only on a
          descendant never reaches it (custom properties cascade to
          descendants, not back up to where an ancestor's own rule reads them). */}
      <body style={buildThemeStyle(settings.theme, settings.buttonColor)}>
        <Providers>
          <InstanceSettingsProvider
            value={{
              registrationEnabled: settings.registrationEnabled,
              logoUrl: settings.logoUrl,
              googleLoginEnabled: externalSettings.googleEnabled,
              microsoftLoginEnabled: externalSettings.azureEnabled,
            }}
          >
            {children}
          </InstanceSettingsProvider>
        </Providers>
      </body>
    </html>
  );
}
