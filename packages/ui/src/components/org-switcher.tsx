"use client";

import { useAuth } from "@kontrolia/react";
import { cn } from "../lib/cn.js";

export interface OrgOption {
  id: string;
  name: string;
}

export interface OrgSwitcherProps {
  organizations: OrgOption[];
  className?: string;
  onSwitched?: (organizationId: string) => void;
}

/**
 * The list of organizations the user belongs to isn't tracked by
 * KontrolIA's own JWT (only the *active* org is, by design — see
 * switchOrganization() in @kontrolia/auth). Consuming apps fetch that list
 * from their own backend / the admin API and pass it in here.
 */
export function OrgSwitcher({ organizations, className, onSwitched }: OrgSwitcherProps) {
  const { organization, switchOrganization } = useAuth();

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    await switchOrganization(id);
    onSwitched?.(id);
  }

  return (
    <select
      value={organization?.id ?? ""}
      onChange={handleChange}
      className={cn("k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-1.5 k-text-sm", className)}
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
