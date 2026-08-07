"use client";

import { AuthGuard, useAuth } from "@kontrolia/react";
import { OrgSwitcher, UnauthorizedScreen, UserMenu } from "@kontrolia/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OAUTH_CODE_VERIFIER_KEY } from "@/lib/oauth";
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

function IconLink({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M6.5 9.5 9.5 6.5M6.8 4.3 8 3.1a2.5 2.5 0 0 1 3.5 3.5l-1.2 1.2M9.2 11.7 8 12.9a2.5 2.5 0 0 1-3.5-3.5l1.2-1.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 1.8 9.7 5.6l4.1.4-3.1 2.8.9 4-3.6-2.1-3.6 2.1.9-4-3.1-2.8 4.1-.4L8 1.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
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

const PLATFORM_NAV_GROUP: NavGroup = {
  label: "Plataforma",
  items: [
    { href: "/oauth-clients", label: "Clientes OAuth", icon: IconLink },
    { href: "/platform-admins", label: "Platform admins", icon: IconStar },
  ],
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const {
    organization,
    isAuthenticated,
    isLoading: authLoading,
    buildOAuthServerAuthorizeUrl,
    isPlatformAdmin,
  } = useAuth();
  const { organizations, isLoading: orgsLoading, reload } = useOrganizations(isAuthenticated);
  const pathname = usePathname();
  const [platformAdmin, setPlatformAdmin] = useState(false);

  // Only visible to platform admins — registering an OAuth client affects
  // every organization, not just the active one. The page itself checks
  // this again independently (a hidden nav link isn't access control).
  useEffect(() => {
    if (!isAuthenticated) {
      setPlatformAdmin(false);
      return;
    }
    void isPlatformAdmin().then(setPlatformAdmin);
  }, [isAuthenticated, isPlatformAdmin]);

  const navGroups = platformAdmin ? [...NAV_GROUPS, PLATFORM_NAV_GROUP] : NAV_GROUPS;
  // /oauth/callback manages its own auth/loading UI while the code exchange
  // is in flight — during that window isAuthenticated is still false, and
  // wrapping it in the same guard below would race: this effect would fire
  // a second authorize redirect (with the callback URL itself as `state`)
  // before the exchange has a chance to finish and land the user on "/".
  const isOAuthCallback = pathname === "/oauth/callback";
  // Guards against firing the redirect twice (React Strict Mode double-invokes
  // effects in dev) — a second call would overwrite the PKCE verifier in
  // sessionStorage with one that no longer matches the challenge already
  // baked into the first call's in-flight authorize URL.
  const redirectStartedRef = useRef(false);

  const authServerUrl = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;
  const oauthClientId = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID;
  const loginHref = authServerUrl
    ? `${authServerUrl}/login?redirect_to=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : authServerUrl)}`
    : "/login";

  // No session — leave immediately instead of waiting for a click. When
  // admin-panel has been registered as an OAuth client (the only way SSO
  // survives auth-server and admin-panel living on genuinely different
  // domains, not just subdomains — a shared cookie can't cross that), go
  // through the authorization-code flow; otherwise fall back to the plain
  // redirect_to link, which only works when a shared cookie domain is set up.
  useEffect(() => {
    if (isOAuthCallback || authLoading || isAuthenticated) return;
    if (redirectStartedRef.current) return;
    redirectStartedRef.current = true;

    if (oauthClientId) {
      void (async () => {
        const { url, codeVerifier } = await buildOAuthServerAuthorizeUrl({
          clientId: oauthClientId,
          redirectUri: `${window.location.origin}/oauth/callback`,
          state: window.location.pathname + window.location.search,
        });
        sessionStorage.setItem(OAUTH_CODE_VERIFIER_KEY, codeVerifier);
        window.location.href = url;
      })();
    } else {
      window.location.href = loginHref;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, isOAuthCallback]);

  // Bypass the sidebar chrome and the guard's own "redirecting" fallback
  // entirely here — the callback page renders its own loading/error state
  // while it's mid-exchange, and briefly looks unauthenticated to AuthGuard.
  if (isOAuthCallback) return <>{children}</>;

  return (
    <AuthGuard
      loading={<p className="k-p-8 k-text-sm k-text-muted-foreground">Cargando...</p>}
      fallback={
        <UnauthorizedScreen
          title="Redirigiendo..."
          description="Te estamos llevando a la pantalla de inicio de sesión."
          action={
            <a href={loginHref} className="k-text-sm k-underline">
              ¿No pasa nada? Haz clic aquí
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
            {navGroups.map((group, index) => (
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
            {!orgsLoading && organizations.length > 0 ? (
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
