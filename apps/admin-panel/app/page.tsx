"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import Link from "next/link";

// --- Inline SVG Icons ---
function BuildingIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-6 0h6M9 7h1m-1 4h1m4-4h1m-1 4h1" />
    </svg>
  );
}

function KeyIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function UsersGroupIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function AppIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function MailIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function ArrowRightIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function ClockIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function DashboardPage() {
  const { user, organization, roles, permissions } = useAuth();

  const quickLinks = [
    {
      title: "Usuarios",
      description: "Gestiona los miembros de la organización y sus accesos.",
      href: "/users",
      icon: UsersGroupIcon,
      color: "k-bg-blue-500/10 k-text-blue-600 dark:k-text-blue-400",
    },
    {
      title: "Invitaciones",
      description: "Envía e inspeciona invitaciones pendientes.",
      href: "/invitations",
      icon: MailIcon,
      color: "k-bg-purple-500/10 k-text-purple-600 dark:k-text-purple-400",
    },
    {
      title: "Aplicaciones",
      description: "Habilita servicios SSO y sincronización CI/CD.",
      href: "/applications",
      icon: AppIcon,
      color: "k-bg-amber-500/10 k-text-amber-600 dark:k-text-amber-400",
    },
    {
      title: "Roles",
      description: "Administra la matriz de accesos y permisos por app.",
      href: "/roles",
      icon: KeyIcon,
      color: "k-bg-indigo-500/10 k-text-indigo-600 dark:k-text-indigo-400",
    },
    {
      title: "Permisos",
      description: "Catálogo unificado de intenciones y seguridad.",
      href: "/permissions",
      icon: ShieldCheckIcon,
      color: "k-bg-emerald-500/10 k-text-emerald-600 dark:k-text-emerald-400",
    },
    {
      title: "Audit Log",
      description: "Bitácora inmutable de eventos y cambios.",
      href: "/audit-logs",
      icon: ClockIcon,
      color: "k-bg-rose-500/10 k-text-rose-600 dark:k-text-rose-400",
    },
  ];

  return (
    <div className="k-flex k-flex-col k-gap-6 k-pb-12">
      {/* --- HERO BANNER --- */}
      <div className="k-relative k-overflow-hidden k-rounded-2xl k-bg-[linear-gradient(135deg,#1b1030,#2b1a52_45%,#4c2a8c)] k-p-6 sm:k-p-8 k-shadow-md k-text-white">
        <div className="k-relative k-z-10 k-flex k-flex-col md:k-flex-row md:k-items-center md:k-justify-between k-gap-6">
          <div>
            <span className="k-inline-flex k-items-center k-gap-2 k-rounded-full k-bg-white/10 k-px-3.5 k-py-1 k-text-xs k-font-semibold k-text-white/80 k-backdrop-blur-sm">
              <BuildingIcon className="k-w-3.5 k-h-3.5" />
              <span>{organization ? organization.name : "Sin organización activa"}</span>
            </span>
            <h1 className="k-mt-3 k-text-3xl sm:k-text-4xl k-font-extrabold k-tracking-tight k-text-white">
              Bienvenido,{" "}
              <span className="k-bg-gradient-to-r k-from-[#c9bdff] k-to-[#8f7cff] k-bg-clip-text k-text-transparent">
                {user?.fullName ?? user?.email ?? "Usuario"}
              </span>
            </h1>
            <p className="k-mt-1.5 k-text-sm sm:k-text-base k-text-white/70 k-max-w-2xl">
              {organization
                ? `Estás administrando el ecosistema de seguridad en ${organization.name}.`
                : "Selecciona una organización en el menú superior para comenzar."}
            </p>
          </div>

          <div className="k-flex k-flex-wrap k-gap-3 k-shrink-0">
            <div className="k-flex k-items-center k-gap-2 k-rounded-xl k-border k-border-white/10 k-bg-white/5 k-px-4 k-py-2.5 k-backdrop-blur-sm">
              <KeyIcon className="k-w-4 k-h-4 k-text-indigo-300" />
              <span className="k-text-xs k-text-white/80">
                <strong className="k-text-white k-text-sm k-font-bold">{roles.length}</strong> roles activos
              </span>
            </div>
            <div className="k-flex k-items-center k-gap-2 k-rounded-xl k-border k-border-white/10 k-bg-white/5 k-px-4 k-py-2.5 k-backdrop-blur-sm">
              <ShieldCheckIcon className="k-w-4 k-h-4 k-text-emerald-300" />
              <span className="k-text-xs k-text-white/80">
                <strong className="k-text-white k-text-sm k-font-bold">{permissions.length}</strong> permisos
              </span>
            </div>
          </div>
        </div>
        <div className="k-absolute -k-right-10 -k-top-10 k-w-64 k-h-64 k-rounded-full k-bg-white/5 k-blur-2xl k-pointer-events-none" />
      </div>

      {/* --- STATS SUMMARY --- */}
      <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 k-gap-5">
        <Card className="k-p-5 k-flex k-flex-col k-justify-between k-gap-4">
          <div className="k-flex k-items-start k-justify-between k-gap-3">
            <div>
              <div className="k-flex k-items-center k-gap-2 k-text-xs k-font-semibold k-text-muted-foreground k-uppercase k-tracking-wider">
                <KeyIcon className="k-w-4 k-h-4 k-text-primary" />
                <span>Mis Roles Activos</span>
              </div>
              <h2 className="k-text-lg k-font-bold k-mt-1">Roles en {organization?.name ?? "esta org"}</h2>
            </div>
            <Badge variant="primary">{roles.length} asignados</Badge>
          </div>

          <div className="k-flex k-flex-wrap k-gap-1.5 k-p-3 k-rounded-xl k-bg-muted/40 k-min-h-[3rem] k-items-center">
            {roles.length === 0 ? (
              <span className="k-text-xs k-text-muted-foreground">No tienes roles asignados en esta organización.</span>
            ) : (
              roles.map((role) => (
                <Badge key={role} variant="neutral">
                  {role}
                </Badge>
              ))
            )}
          </div>

          <div className="k-pt-2 k-border-t k-border-border/60 k-flex k-justify-end">
            <Link
              href="/roles"
              className="k-inline-flex k-items-center k-gap-1.5 k-text-xs k-font-semibold k-text-primary hover:k-underline"
            >
              <span>Gestionar matriz de roles</span>
              <ArrowRightIcon className="k-w-3.5 k-h-3.5" />
            </Link>
          </div>
        </Card>

        <Card className="k-p-5 k-flex k-flex-col k-justify-between k-gap-4">
          <div className="k-flex k-items-start k-justify-between k-gap-3">
            <div>
              <div className="k-flex k-items-center k-gap-2 k-text-xs k-font-semibold k-text-muted-foreground k-uppercase k-tracking-wider">
                <ShieldCheckIcon className="k-w-4 k-h-4 k-text-emerald-600 dark:k-text-emerald-400" />
                <span>Mis Permisos Efectivos</span>
              </div>
              <h2 className="k-text-lg k-font-bold k-mt-1">Alcance de Autorización</h2>
            </div>
            <Badge variant="success">{permissions.length} permisos</Badge>
          </div>

          <div className="k-p-3 k-rounded-xl k-bg-muted/40 k-text-xs k-text-muted-foreground">
            Tienes <strong className="k-text-foreground">{permissions.length} permisos activos</strong> otorgados por tus roles
            en <strong>{organization?.name ?? "esta organización"}</strong>.
          </div>

          <div className="k-pt-2 k-border-t k-border-border/60 k-flex k-justify-end">
            <Link
              href="/permissions"
              className="k-inline-flex k-items-center k-gap-1.5 k-text-xs k-font-semibold k-text-primary hover:k-underline"
            >
              <span>Ver catálogo de permisos</span>
              <ArrowRightIcon className="k-w-3.5 k-h-3.5" />
            </Link>
          </div>
        </Card>
      </div>

      {/* --- QUICK ACCESS GRID --- */}
      <div>
        <h2 className="k-text-lg k-font-bold k-mb-3 k-tracking-tight">Accesos Rápidos al Sistema</h2>
        <div className="k-grid k-grid-cols-1 sm:k-grid-cols-2 lg:k-grid-cols-3 k-gap-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="k-group">
                <Card className="k-p-4 k-h-full k-flex k-flex-col k-justify-between k-gap-3 hover:k-border-primary/40 hover:k-shadow-md k-transition-all k-duration-200">
                  <div className="k-flex k-items-center k-gap-3">
                    <div className={`k-w-10 k-h-10 k-rounded-xl k-flex k-items-center k-justify-center ${item.color}`}>
                      <Icon className="k-w-5 k-h-5" />
                    </div>
                    <div>
                      <h3 className="k-font-bold k-text-sm group-hover:k-text-primary k-transition-colors">{item.title}</h3>
                    </div>
                  </div>
                  <p className="k-text-xs k-text-muted-foreground">{item.description}</p>
                  <div className="k-flex k-items-center k-gap-1 k-text-xs k-font-semibold k-text-primary group-hover:k-translate-x-0.5 k-transition-transform">
                    <span>Ir a {item.title}</span>
                    <ArrowRightIcon className="k-w-3.5 k-h-3.5" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
