"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface RoleDetail {
  id: string;
  name: string;
  slug: string;
  is_system_role: boolean;
  grants_all_permissions: boolean;
  organization_id: string | null;
  application_id: string | null;
}

interface PermissionRow {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
  application_id: string;
  application: { name: string } | null;
}

interface ApplicationGroup {
  name: string;
  permissions: PermissionRow[];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const first = parts[0][0] ?? "";
    const second = parts[1][0] ?? "";
    return (first + second).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const GRADIENTS = [
  "k-bg-gradient-to-br k-from-indigo-600 k-to-violet-700 k-text-white",
  "k-bg-gradient-to-br k-from-blue-600 k-to-cyan-600 k-text-white",
  "k-bg-gradient-to-br k-from-emerald-600 k-to-teal-700 k-text-white",
  "k-bg-gradient-to-br k-from-purple-600 k-to-pink-600 k-text-white",
  "k-bg-gradient-to-br k-from-amber-500 k-to-orange-600 k-text-white",
  "k-bg-gradient-to-br k-from-rose-600 k-to-red-700 k-text-white",
];

function getAvatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index] ?? "k-bg-gradient-to-br k-from-indigo-600 k-to-violet-700 k-text-white";
}

// --- Inline SVG Icons ---
function ArrowLeftIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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

function LockIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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

function XIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function InfoIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SpinnerIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={`k-animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="k-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="k-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

const PERMISSIONS_PAGE_SIZE = 50;

export default function RoleDetailPage() {
  const params = useParams<{ roleId: string }>();
  const roleId = params.roleId;
  const { organization } = useAuth();

  const [role, setRole] = useState<RoleDetail | null | undefined>(undefined);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [appIds, setAppIds] = useState<string[]>([]);
  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "granted" | "denied">("all");

  function triggerSuccessNotice(msg: string) {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 3000);
  }

  const groups: ApplicationGroup[] = (() => {
    const byApplication = new Map<string, ApplicationGroup>();
    for (const permission of permissions) {
      const appName = permission.application?.name ?? "—";
      const group = byApplication.get(permission.application_id) ?? { name: appName, permissions: [] };
      group.permissions.push(permission);
      byApplication.set(permission.application_id, group);
    }
    return [...byApplication.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  async function loadPermissions(ids: string[], offset: number, append: boolean) {
    if (ids.length === 0) {
      setPermissions([]);
      setHasMore(false);
      return;
    }
    const supabase = createKontroliaSchemaClient();
    const { data: permissionRows } = await supabase
      .from("permissions")
      .select("id, key, resource, action, description, application_id, application:applications(name)")
      .in("application_id", ids)
      .order("key")
      .range(offset, offset + PERMISSIONS_PAGE_SIZE - 1)
      .returns<PermissionRow[]>();

    const page = permissionRows ?? [];
    setPermissions((current) => (append ? [...current, ...page] : page));
    setHasMore(page.length === PERMISSIONS_PAGE_SIZE);
  }

  async function loadAll(orgId: string) {
    const supabase = createKontroliaSchemaClient();

    const { data: roleRow } = await supabase
      .from("roles")
      .select("id, name, slug, is_system_role, grants_all_permissions, organization_id, application_id")
      .eq("id", roleId)
      .maybeSingle();
    setRole(roleRow ?? null);
    if (!roleRow) return;

    let ids: string[];
    if (roleRow.application_id) {
      ids = [roleRow.application_id];
    } else {
      const { data: appRows } = await supabase
        .from("application_organizations")
        .select("application_id")
        .eq("organization_id", orgId)
        .returns<{ application_id: string }[]>();
      ids = (appRows ?? []).map((row) => row.application_id);
    }
    setAppIds(ids);
    await loadPermissions(ids, 0, false);

    const { data: rolePermissionRows } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId)
      .returns<{ permission_id: string }[]>();
    setGrantedIds(new Set((rolePermissionRows ?? []).map((row) => row.permission_id)));
  }

  useEffect(() => {
    if (organization) void loadAll(organization.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, roleId]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadPermissions(appIds, permissions.length, true);
    setLoadingMore(false);
  }

  const isEditable = role != null && !role.is_system_role && !role.grants_all_permissions;

  async function toggle(permission: PermissionRow, currentlyGranted: boolean) {
    setError(null);
    setPendingId(permission.id);
    try {
      const supabase = createKontroliaSchemaClient();
      if (currentlyGranted) {
        const { error: deleteError } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId)
          .eq("permission_id", permission.id);
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .from("role_permissions")
          .insert({ role_id: roleId, permission_id: permission.id });
        if (insertError) throw insertError;
      }
      setGrantedIds((prev) => {
        const next = new Set(prev);
        if (currentlyGranted) next.delete(permission.id);
        else next.add(permission.id);
        return next;
      });
      triggerSuccessNotice(
        currentlyGranted
          ? `Permiso "${permission.key}" revocado.`
          : `Permiso "${permission.key}" concedido.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el permiso.");
    } finally {
      setPendingId(null);
    }
  }

  if (!organization) {
    return (
      <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center k-my-8">
        <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-primary/10 k-flex k-items-center k-justify-center k-text-primary k-mb-4">
          <KeyIcon className="k-w-8 k-h-8" />
        </div>
        <h3 className="k-text-lg k-font-semibold">Selecciona una Organización</h3>
        <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
          Selecciona una organización activa para gestionar los permisos de este rol.
        </p>
      </Card>
    );
  }

  if (role === undefined) {
    return (
      <div className="k-flex k-flex-col k-gap-5 k-animate-pulse">
        <div className="k-h-6 k-w-24 k-bg-muted k-rounded" />
        <div className="k-h-10 k-w-1/3 k-bg-muted k-rounded-lg" />
        <Card className="k-p-8 k-h-48 k-bg-muted/40 k-rounded-xl">
          <div className="k-h-full k-w-full" />
        </Card>
      </div>
    );
  }

  if (role === null) {
    return (
      <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center k-my-8">
        <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-destructive/10 k-flex k-items-center k-justify-center k-text-destructive k-mb-4">
          <AlertTriangleIcon className="k-w-8 k-h-8" />
        </div>
        <h3 className="k-text-lg k-font-semibold">Rol No Encontrado</h3>
        <p className="k-text-sm k-text-muted-foreground k-mt-1 k-mb-6 k-max-w-md">
          El rol que intentas acceder no existe o no pertenece a tu organización.
        </p>
        <Link
          href="/roles"
          className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground hover:k-opacity-90 k-transition-all"
        >
          <ArrowLeftIcon />
          <span>Volver a Roles</span>
        </Link>
      </Card>
    );
  }

  // Derived counts
  const totalPermissions = permissions.length;
  const grantedCount = permissions.filter((p) =>
    role.grants_all_permissions ? true : grantedIds.has(p.id)
  ).length;
  const deniedCount = totalPermissions - grantedCount;

  return (
    <div className="k-flex k-flex-col k-gap-6 k-pb-12">
      {/* --- HERO BANNER --- */}
      <div className="k-relative k-overflow-hidden k-rounded-2xl k-bg-[linear-gradient(135deg,#1b1030,#2b1a52_45%,#4c2a8c)] k-p-6 sm:k-p-8 k-shadow-md k-text-white">
        <div className="k-relative k-z-10 k-flex k-flex-col k-gap-3">
          <div>
            <Link
              href="/roles"
              className="k-inline-flex k-items-center k-gap-1.5 k-text-xs k-font-medium k-text-white/70 hover:k-text-white k-transition-all k-mb-2"
            >
              <ArrowLeftIcon />
              <span>Volver a la lista de Roles</span>
            </Link>
          </div>

          <div className="k-flex k-flex-col md:k-flex-row md:k-items-center md:k-justify-between k-gap-4">
            <div className="k-flex k-items-center k-gap-3.5">
              <div
                className={`k-w-12 k-h-12 k-rounded-2xl k-flex k-items-center k-justify-center k-font-bold k-text-base k-shrink-0 k-shadow-sm ${getAvatarGradient(
                  role.id
                )}`}
              >
                {getInitials(role.name)}
              </div>
              <div>
                <div className="k-flex k-items-center k-gap-2.5">
                  <h1 className="k-text-3xl k-font-bold k-tracking-tight k-text-white">{role.name}</h1>
                  <Badge variant={role.is_system_role ? "primary" : "neutral"}>
                    {role.is_system_role ? "Rol de Sistema" : "Rol Personalizado"}
                  </Badge>
                </div>
                <p className="k-text-xs k-font-mono k-text-white/70 k-mt-0.5">
                  Slug: <strong className="k-text-white">{role.slug}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="k-absolute -k-right-10 -k-top-10 k-w-64 k-h-64 k-rounded-full k-bg-white/5 k-blur-2xl k-pointer-events-none" />
      </div>

      {/* --- INFO BANNER --- */}
      <div className="k-rounded-xl k-border k-border-primary/20 k-bg-primary/5 k-p-4 k-text-sm k-flex k-items-start k-gap-3.5">
        <InfoIcon className="k-w-5 k-h-5 k-text-primary k-shrink-0 k-mt-0.5" />
        <div className="k-flex-1">
          <p className="k-font-semibold k-text-foreground">Comportamiento del Rol</p>
          <p className="k-text-xs k-text-muted-foreground k-mt-1 k-leading-relaxed">
            {role.grants_all_permissions
              ? "Este rol automático concede todos los permisos de su aplicación asociada y se mantiene actualizado automáticamente al desplegarse nuevos permisos."
              : role.is_system_role
                ? "Los permisos de este rol de sistema están prefijados por la arquitectura del servicio y no se pueden modificar."
                : "Rol personalizado: activa o desactiva individualmente las intenciones y permisos requeridos para este rol."}
          </p>
        </div>
      </div>

      {/* --- NOTIFICATIONS / ALERTS --- */}
      {error && (
        <div className="k-flex k-items-start k-gap-3 k-rounded-xl k-border k-border-destructive/30 k-bg-destructive/10 k-p-4 k-text-sm k-text-destructive">
          <AlertTriangleIcon className="k-w-5 k-h-5 k-shrink-0 k-mt-0.5" />
          <div className="k-flex-1">
            <p className="k-font-semibold">Error de actualización</p>
            <p className="k-mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="k-text-destructive hover:k-opacity-70">
            <XIcon />
          </button>
        </div>
      )}

      {successNotice && (
        <div className="k-flex k-items-center k-gap-3 k-rounded-xl k-border k-border-emerald-500/30 k-bg-emerald-500/10 k-p-4 k-text-sm k-text-emerald-700 dark:k-text-emerald-300">
          <CheckIcon className="k-w-5 k-h-5 k-text-emerald-600 k-shrink-0" />
          <p className="k-flex-1 k-font-medium">{successNotice}</p>
          <button type="button" onClick={() => setSuccessNotice(null)} className="k-text-emerald-600 hover:k-opacity-70">
            <XIcon />
          </button>
        </div>
      )}

      {/* --- METRICS STATS BAR --- */}
      <div className="k-grid k-grid-cols-1 sm:k-grid-cols-3 k-gap-4">
        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-primary/10 k-text-primary">
            <ShieldCheckIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{totalPermissions}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Total Permisos Evaluados</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-emerald-500/10 k-text-emerald-600 dark:k-text-emerald-400">
            <CheckIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{grantedCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Permisos Concedidos</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-muted k-text-muted-foreground">
            <LockIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{deniedCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Permisos Denegados</p>
          </div>
        </Card>
      </div>

      {/* --- CONTROL TOOLBAR --- */}
      <div className="k-flex k-flex-col sm:k-flex-row sm:k-items-center sm:k-justify-between k-gap-3 k-bg-card k-p-3 k-rounded-xl k-border k-border-border">
        {/* Search Input */}
        <div className="k-relative k-flex-1">
          <SearchIcon className="k-absolute k-left-3 k-top-1/2 -k-translate-y-1/2 k-text-muted-foreground k-w-4 k-h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar permiso por clave o descripción..."
            className="k-w-full k-rounded-lg k-border k-border-border k-bg-background k-pl-9 k-pr-8 k-py-2 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary k-transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="k-absolute k-right-2.5 k-top-1/2 -k-translate-y-1/2 k-text-muted-foreground hover:k-text-foreground"
            >
              <XIcon className="k-w-3.5 k-h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="k-inline-flex k-items-center k-rounded-lg k-bg-muted k-p-1 k-text-xs k-font-medium">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
              statusFilter === "all"
                ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                : "k-text-muted-foreground hover:k-text-foreground"
            }`}
          >
            Todos ({totalPermissions})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("granted")}
            className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
              statusFilter === "granted"
                ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                : "k-text-muted-foreground hover:k-text-foreground"
            }`}
          >
            Concedidos ({grantedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("denied")}
            className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
              statusFilter === "denied"
                ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                : "k-text-muted-foreground hover:k-text-foreground"
            }`}
          >
            Denegados ({deniedCount})
          </button>
        </div>
      </div>

      {/* --- CONTENT AREA: PERMISSIONS BY APPLICATION --- */}
      {groups.length === 0 ? (
        <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center">
          <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-muted k-flex k-items-center k-justify-center k-text-muted-foreground k-mb-4">
            <LockIcon className="k-w-8 k-h-8" />
          </div>
          <h3 className="k-text-lg k-font-semibold">Sin permisos evaluables</h3>
          <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
            Esta organización no tiene aplicaciones habilitadas con permisos para asignar en este rol.
          </p>
        </Card>
      ) : (
        <div className="k-flex k-flex-col k-gap-6">
          {groups.map((group) => {
            const query = searchQuery.toLowerCase().trim();
            const groupPermissions = group.permissions.filter((permission) => {
              const matchesQuery =
                !query ||
                permission.key.toLowerCase().includes(query) ||
                (permission.description && permission.description.toLowerCase().includes(query));

              const isGranted = role.grants_all_permissions ? true : grantedIds.has(permission.id);
              const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "granted" && isGranted) ||
                (statusFilter === "denied" && !isGranted);

              return matchesQuery && matchesStatus;
            });

            if (groupPermissions.length === 0) return null;

            return (
              <div key={group.name} className="k-flex k-flex-col k-gap-3">
                <div className="k-flex k-items-center k-justify-between">
                  <h2 className="k-text-base k-font-semibold k-flex k-items-center k-gap-2">
                    <div
                      className={`k-w-7 k-h-7 k-rounded-lg k-flex k-items-center k-justify-center k-font-bold k-text-xs ${getAvatarGradient(
                        group.name
                      )}`}
                    >
                      {getInitials(group.name)}
                    </div>
                    <span>{group.name}</span>
                    <span className="k-text-xs k-font-normal k-text-muted-foreground">
                      ({groupPermissions.length} permisos)
                    </span>
                  </h2>
                </div>

                <Card className="k-p-2 k-divide-y k-divide-border">
                  {groupPermissions.map((permission) => {
                    const isGranted = role.grants_all_permissions ? true : grantedIds.has(permission.id);
                    const isPending = pendingId === permission.id;

                    return (
                      <div
                        key={permission.id}
                        className="k-flex k-flex-col sm:k-flex-row sm:k-items-center sm:k-justify-between k-gap-3 k-p-3.5 hover:k-bg-muted/40 k-rounded-lg k-transition-colors"
                      >
                        <div className="k-flex-1 k-min-w-0">
                          <code className="k-text-xs k-font-mono k-font-semibold k-text-primary select-all">
                            {permission.key}
                          </code>
                          <p className="k-text-xs k-text-muted-foreground k-mt-0.5">
                            {permission.description ?? "Sin descripción adicional."}
                          </p>
                        </div>

                        <div className="k-flex k-items-center k-gap-3 k-shrink-0">
                          <label className="k-inline-flex k-items-center k-gap-2.5 k-cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isGranted}
                              disabled={!isEditable || isPending}
                              onChange={() => void toggle(permission, isGranted)}
                              className="k-h-4 k-w-4 k-rounded k-border-border k-text-primary focus:k-ring-primary/20 disabled:k-opacity-50 k-cursor-pointer"
                            />
                            {isPending ? (
                              <SpinnerIcon className="k-text-primary" />
                            ) : (
                              <Badge variant={isGranted ? "success" : "neutral"}>
                                {isGranted ? "Concedido" : "No concedido"}
                              </Badge>
                            )}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* --- LOAD MORE --- */}
      {hasMore && (
        <div className="k-text-center k-pt-4">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void handleLoadMore()}
            className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-border k-border-border k-bg-background k-px-4 k-py-2 k-text-sm k-font-medium hover:k-bg-muted disabled:k-opacity-60 k-transition-all"
          >
            {loadingMore ? (
              <>
                <SpinnerIcon />
                <span>Cargando...</span>
              </>
            ) : (
              <span>Cargar más permisos</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
