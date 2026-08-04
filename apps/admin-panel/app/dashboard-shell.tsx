"use client";

import { AuthGuard, useAuth } from "@kontrolia/react";
import { OrgSwitcher, UnauthorizedScreen, UserMenu } from "@kontrolia/ui";
import Link from "next/link";
import { useOrganizations } from "@/lib/use-organizations";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/users", label: "Usuarios" },
  { href: "/organizations", label: "Organizaciones" },
  { href: "/roles", label: "Roles" },
  { href: "/permissions", label: "Permisos" },
  { href: "/invitations", label: "Invitaciones" },
  { href: "/audit-logs", label: "Audit log" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { organization, isAuthenticated } = useAuth();
  const { organizations, isLoading, reload } = useOrganizations(isAuthenticated);

  return (
    <AuthGuard
      loading={<p className="k-p-8 k-text-sm k-text-muted-foreground">Cargando...</p>}
      fallback={<UnauthorizedScreen action={<a href="/login" className="k-text-sm k-underline">Iniciar sesión</a>} />}
    >
      <div className="k-flex k-min-h-screen">
        <aside className="k-w-56 k-shrink-0 k-border-r k-border-border k-p-4">
          <p className="k-mb-4 k-text-sm k-font-semibold">{organization?.name ?? "KontrolIA"}</p>
          <nav className="k-flex k-flex-col k-gap-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="k-rounded-md k-px-2 k-py-1.5 k-text-sm hover:k-bg-muted">
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="k-flex k-flex-1 k-flex-col">
          <header className="k-flex k-items-center k-justify-between k-border-b k-border-border k-p-3">
            {!isLoading && organizations.length > 0 ? (
              <OrgSwitcher organizations={organizations} onSwitched={() => void reload()} />
            ) : (
              <span />
            )}
            <UserMenu />
          </header>
          <main className="k-flex-1 k-p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
