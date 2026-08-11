"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrgOption } from "@kontrolia/ui";

/**
 * Organizations the signed-in user belongs to, via GET /api/organizations.
 * Not carried in the JWT on purpose (see the architecture notes on
 * switchOrganization) — the active org's roles/permissions live in the
 * token, the full membership list is a separate fetch.
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
    const response = await fetch("/api/organizations");
    if (response.ok) {
      const body = (await response.json()) as { organizations: OrgOption[] };
      setError(null);
      setOrganizations(body.organizations);
    } else {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "No se pudieron cargar tus organizaciones.");
    }
    setIsLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { organizations, isLoading, error, reload };
}
