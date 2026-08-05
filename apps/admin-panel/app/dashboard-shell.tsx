"use client";

import { AuthGuard, useAuth } from "@kontrolia/react";
import { OrgSwitcher, UnauthorizedScreen, UserMenu } from "@kontrolia/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganizations } from "@/lib/use-organizations";

type IconProps = { className?: string };

function IconDashboard({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8.5" y="1.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="8.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8.5" y="8.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconBuilding({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="2.5" y="1.5" width="8" height="13" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 4.5h.01M8 4.5h.01M5 7.5h.01M8 7.5h.01M5 10.5h.01M8 10.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10.5 6.5H13a.5.5 0 0 1 .5.5v7.5h-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconApps({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconUsers({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="6" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.75 14c0-2.3 1.9-4 4.25-4s4.25 1.7 4.25 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10.5 2.75c1.1.3 1.9 1.3 1.9 2.5 0 1.2-.8 2.2-1.9 2.5M14 14c0-2-1.4-3.6-3.25-3.95" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconShield({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M8 1.5 13.5 3.5v4c0 3.6-2.3 6.1-5.5 7-3.2-.9-5.5-3.4-5.5-7v-4L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function IconKey({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="5" cy="11" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.1 8.9 13 3l1.5 1.5-1 1-1.2-.2.2 1.2-1.2.2.2 1.2-2.2 2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMail({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.2 4.3 8 8.5l5.8-4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.75V8l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: (props: IconProps) => React.ReactNode;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ href: "/", label: "Dashboard", icon: IconDashboard }] },
  {
    label: "Operaciones",
    items: [
      { href: "/organizations", label: "Organizaciones", icon: IconBuilding },
      { href: "/applications", label: "Aplicaciones", icon: IconApps },
    ],
  },
  {
    label: "Accesos",
    items: [
      { href: "/users", label: "Usuarios", icon: IconUsers },
      { href: "/roles", label: "Roles", icon: IconShield },
      { href: "/permissions", label: "Permisos", icon: IconKey },
      { href: "/invitations", label: "Invitaciones", icon: IconMail },
    ],
  },
  { label: "Configuración", items: [{ href: "/audit-logs", label: "Audit log", icon: IconClock }] },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { organization, isAuthenticated } = useAuth();
  const { organizations, isLoading, reload } = useOrganizations(isAuthenticated);
  const pathname = usePathname();

  return (
    <AuthGuard
      loading={<p className="k-p-8 k-text-sm k-text-muted-foreground">Cargando...</p>}
      fallback={
        <UnauthorizedScreen
          action={
            <a
              href={process.env.NEXT_PUBLIC_AUTH_SERVER_URL ? `${process.env.NEXT_PUBLIC_AUTH_SERVER_URL}/login` : "/login"}
              className="k-text-sm k-underline"
            >
              Iniciar sesión
            </a>
          }
        />
      }
    >
      <div className="k-flex k-min-h-screen k-bg-background">
        <aside className="k-flex k-w-[220px] k-shrink-0 k-flex-col k-bg-sidebar k-p-3">
          <div className="k-mb-6 k-flex k-items-center k-gap-2.5 k-px-2 k-pt-2">
            <div className="k-flex k-h-8 k-w-8 k-shrink-0 k-items-center k-justify-center k-rounded-lg k-bg-gradient-to-br k-from-primary k-to-[#4c2a8c] k-text-sm k-font-extrabold k-text-white">
              K
            </div>
            <div className="k-leading-tight">
              <p className="k-text-sm k-font-extrabold k-text-sidebar-foreground">KontrolIA Auth</p>
              <p className="k-text-[10px] k-font-semibold k-uppercase k-tracking-wide k-text-sidebar-muted">
                Auth &amp; Access Platform
              </p>
            </div>
          </div>

          <nav className="k-flex k-flex-1 k-flex-col k-gap-4 k-overflow-y-auto">
            {NAV_GROUPS.map((group, index) => (
              <div key={group.label ?? `group-${index}`}>
                {group.label && (
                  <p className="k-mb-1 k-px-3 k-text-[10px] k-font-semibold k-uppercase k-tracking-wide k-text-sidebar-muted">
                    {group.label}
                  </p>
                )}
                <div className="k-flex k-flex-col k-gap-0.5">
                  {group.items.map((item) => {
                    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={
                          isActive
                            ? "k-flex k-items-center k-gap-2.5 k-rounded-lg k-bg-sidebar-active k-px-3 k-py-2 k-text-sm k-font-medium k-text-white"
                            : "k-flex k-items-center k-gap-2.5 k-rounded-lg k-px-3 k-py-2 k-text-sm k-font-medium k-text-sidebar-foreground/80 hover:k-bg-white/5 hover:k-text-sidebar-foreground"
                        }
                      >
                        <item.icon className="k-h-4 k-w-4 k-shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="k-flex k-flex-1 k-flex-col">
          <header className="k-flex k-items-center k-justify-between k-border-b k-border-border k-bg-card k-px-6 k-py-3">
            {!isLoading && organizations.length > 0 ? (
              <OrgSwitcher organizations={organizations} onSwitched={() => void reload()} />
            ) : (
              <span />
            )}
            <UserMenu />
          </header>
          <main className="k-flex-1 k-p-8">
            {organization && (
              <p className="k-mb-5 k-text-xs k-font-semibold k-uppercase k-tracking-wide k-text-muted-foreground">
                {organization.name}
              </p>
            )}
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
