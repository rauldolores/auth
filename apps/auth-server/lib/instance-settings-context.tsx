"use client";

import { createContext, useContext } from "react";

export interface AuthUiSettings {
  registrationEnabled: boolean;
  logoUrl: string | null;
  googleLoginEnabled: boolean;
  microsoftLoginEnabled: boolean;
}

const DEFAULT: AuthUiSettings = {
  registrationEnabled: true,
  logoUrl: null,
  googleLoginEnabled: false,
  microsoftLoginEnabled: false,
};

const InstanceSettingsContext = createContext<AuthUiSettings>(DEFAULT);

/** Provided once by the root Server Component layout, which already fetched instance_settings — every AuthShell-based page reads it via useAuthUiSettings(). */
export function InstanceSettingsProvider({ value, children }: { value: AuthUiSettings; children: React.ReactNode }) {
  return <InstanceSettingsContext.Provider value={value}>{children}</InstanceSettingsContext.Provider>;
}

export function useAuthUiSettings(): AuthUiSettings {
  return useContext(InstanceSettingsContext);
}
