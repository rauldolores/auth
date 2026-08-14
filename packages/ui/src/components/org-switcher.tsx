"use client";

import { useAuth } from "@kontrolia/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn.js";

export interface OrgOption {
  id: string;
  name: string;
  slug?: string;
}

export interface OrgSwitcherProps {
  organizations: OrgOption[];
  className?: string;
  onSwitched?: (organizationId: string) => void;
  manageOrgsHref?: string;
  onManageOrgs?: () => void;
}

// --- Inline SVG Icons ---
function BuildingIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-6 0h6M9 7h1m-1 4h1m4-4h1m-1 4h1" />
    </svg>
  );
}

function ChevronsUpDownIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
    </svg>
  );
}

function SearchIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function CheckIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ManageOrgsIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-6 0h6M9 7h1m-1 4h1m4-4h1m-1 4h1" />
    </svg>
  );
}

/**
 * The list of organizations the user belongs to isn't tracked by
 * KontrolIA's own JWT (only the *active* org is, by design — see
 * switchOrganization() in @kontrolia/auth). Consuming apps fetch that list
 * from their own backend / the admin API and pass it in here.
 */
export function OrgSwitcher({
  organizations,
  className,
  onSwitched,
  manageOrgsHref = "/organizations",
  onManageOrgs,
}: OrgSwitcherProps) {
  const { organization, switchOrganization } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const activeOrg = organizations.find((o) => o.id === organization?.id) ?? organization ?? organizations[0];

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  async function handleSelect(orgId: string) {
    if (orgId === organization?.id) {
      setOpen(false);
      return;
    }
    setSwitchingId(orgId);
    try {
      await switchOrganization(orgId);
      onSwitched?.(orgId);
    } finally {
      setSwitchingId(null);
      setOpen(false);
      setSearch("");
    }
  }

  return (
    <div ref={containerRef} className={cn("k-relative k-inline-block", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="k-flex k-items-center k-gap-2.5 k-rounded-xl k-border k-border-border k-bg-background k-px-3.5 k-py-2 k-text-left k-text-sm k-font-medium hover:k-bg-muted/60 focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 k-transition-all k-shadow-sm"
      >
        <div className="k-flex k-h-7 k-w-7 k-items-center k-justify-center k-rounded-lg k-bg-primary/10 k-text-primary k-shrink-0">
          <BuildingIcon className="k-w-4 k-h-4" />
        </div>
        <span className="k-font-semibold k-text-foreground k-truncate k-max-w-[160px] sm:k-max-w-[200px]">
          {activeOrg?.name ?? "Seleccionar organización"}
        </span>
        <ChevronsUpDownIcon className="k-w-4 k-h-4 k-text-muted-foreground k-shrink-0 k-ml-1" />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="k-absolute k-left-0 k-z-50 k-mt-1.5 k-w-72 k-rounded-xl k-border k-border-border k-bg-card k-p-2 k-shadow-xl k-animate-in k-fade-in-80 k-zoom-in-95">
          {/* Search Input */}
          <div className="k-relative k-mb-1.5">
            <SearchIcon className="k-absolute k-left-2.5 k-top-1/2 -k-translate-y-1/2 k-w-4 k-h-4 k-text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar organización..."
              className="k-w-full k-rounded-lg k-border k-border-border k-bg-background k-pl-8 k-pr-3 k-py-1.5 k-text-xs focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary"
            />
          </div>

          {/* List of Orgs */}
          <div className="k-max-h-60 k-overflow-y-auto k-flex k-flex-col k-gap-0.5 k-py-0.5">
            {filteredOrgs.length === 0 ? (
              <p className="k-px-3 k-py-4 k-text-center k-text-xs k-text-muted-foreground">
                No se encontraron organizaciones.
              </p>
            ) : (
              filteredOrgs.map((org) => {
                const isActive = org.id === organization?.id;
                const isSwitching = switchingId === org.id;

                return (
                  <button
                    key={org.id}
                    type="button"
                    disabled={isSwitching}
                    onClick={() => void handleSelect(org.id)}
                    className={cn(
                      "k-flex k-w-full k-items-center k-justify-between k-gap-2 k-rounded-lg k-px-2.5 k-py-2 k-text-left k-text-xs k-transition-all",
                      isActive
                        ? "k-bg-muted/80 k-font-semibold k-text-foreground"
                        : "k-text-foreground hover:k-bg-muted/50"
                    )}
                  >
                    <div className="k-flex k-items-center k-gap-2 k-min-w-0">
                      <div className="k-w-4 k-h-4 k-flex k-items-center k-justify-center k-shrink-0 k-text-primary">
                        {isActive && <CheckIcon className="k-w-3.5 k-h-3.5" />}
                      </div>
                      <span className="k-truncate k-font-medium">{org.name}</span>
                    </div>

                    {isActive && (
                      <span className="k-shrink-0 k-rounded-full k-bg-foreground k-px-2 k-py-0.5 k-text-[10px] k-font-bold k-text-background">
                        Activa
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Action */}
          <div className="k-mt-1 k-border-t k-border-border k-pt-1.5">
            <a
              href={manageOrgsHref}
              onClick={(e) => {
                if (onManageOrgs) {
                  e.preventDefault();
                  onManageOrgs();
                }
                setOpen(false);
              }}
              className="k-flex k-w-full k-items-center k-gap-2 k-rounded-lg k-px-2.5 k-py-2 k-text-xs k-font-medium k-text-primary hover:k-bg-primary/10 k-transition-colors"
            >
              <ManageOrgsIcon className="k-w-4 k-h-4" />
              <span>Gestionar organizaciones</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
