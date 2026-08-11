"use client";

import type { OrgOption } from "@kontrolia/ui";
import { useCallback, useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "./supabase-browser";

/**
 * Organizations the signed-in admin belongs to. Unlike auth-server (which
 * goes through its own API route), this queries kontrolia_auth.organizations
 * directly — the "members can view their organizations" RLS policy already
 * scopes the result to the caller's memberships, same end result.
 */
export function useOrganizations(isAuthenticated: boolean) {
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setOrganizations([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const supabase = createKontroliaSchemaClient();
    const { data, error: fetchError } = await supabase.from("organizations").select("id, name").order("name");
    if (fetchError) {
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }
    setError(null);
    setOrganizations(data ?? []);
    setIsLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { organizations, isLoading, error, reload };
}
