"use client";

import { type KontroliaClient, type KontroliaClientConfig, createKontroliaClient } from "@kontrolia/auth";
import { type PermissionChecker, createPermissionChecker } from "@kontrolia/permissions";
import type { KontroliaOrganization, KontroliaUser } from "@kontrolia/shared";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface KontroliaAuthState {
  client: KontroliaClient;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: KontroliaUser | null;
  organization: KontroliaOrganization | null;
  roles: string[];
  permissions: string[];
  checker: PermissionChecker;
}

const KontroliaAuthContext = createContext<KontroliaAuthState | null>(null);

export interface AuthProviderProps {
  config: KontroliaClientConfig;
  children: React.ReactNode;
}

export function AuthProvider({ config, children }: AuthProviderProps) {
  // Deliberately narrower than the whole `config` object: consumers
  // commonly pass an inline object literal (`<AuthProvider config={{...}}>`),
  // which is a new reference every render — depending on `config` itself
  // would recreate the Supabase client (and tear down its auth listener)
  // on every render. supabaseUrl/supabaseAnonKey are the only fields that
  // actually determine client identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const client = useMemo(() => createKontroliaClient(config), [config.supabaseUrl, config.supabaseAnonKey]);

  const [state, setState] = useState<Omit<KontroliaAuthState, "client" | "checker">>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    organization: null,
    roles: [],
    permissions: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const [user, organization, roles, permissions] = await Promise.all([
        client.getUser(),
        client.getOrganization(),
        client.getRoles(),
        client.getPermissions(),
      ]);
      if (cancelled) return;
      setState({ isLoading: false, isAuthenticated: user !== null, user, organization, roles, permissions });
    }

    void loadInitial();

    const unsubscribe = client.onAuthStateChange((next) => {
      if (cancelled) return;
      setState({
        isLoading: false,
        isAuthenticated: next.user !== null,
        user: next.user,
        organization: next.organization,
        roles: next.roles,
        permissions: next.permissions,
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client]);

  const checker = useMemo(
    () => createPermissionChecker({ roles: state.roles, permissions: state.permissions }),
    [state.roles, state.permissions],
  );

  const value: KontroliaAuthState = { ...state, client, checker };

  return <KontroliaAuthContext.Provider value={value}>{children}</KontroliaAuthContext.Provider>;
}

export function useKontroliaAuthContext(): KontroliaAuthState {
  const context = useContext(KontroliaAuthContext);
  if (!context) {
    throw new Error("useAuth() must be used within an <AuthProvider>");
  }
  return context;
}
