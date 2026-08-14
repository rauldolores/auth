"use client";

import { Badge, Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface PermissionRow {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
  application: { id: string; name: string } | null;
}

interface ApplicationGroup {
  id: string;
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
function ShieldCheckIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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

function KeyIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
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

function CopyIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function LayoutGridIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ListIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
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

function getActionColor(action: string): "neutral" | "primary" | "success" | "warning" {
  const act = action.toLowerCase();
  if (act.includes("create") || act.includes("write") || act.includes("post")) return "primary";
  if (act.includes("delete") || act.includes("remove")) return "warning";
  if (act.includes("read") || act.includes("view") || act.includes("get")) return "success";
  return "neutral";
}

const PERMISSIONS_PAGE_SIZE = 50;

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<PermissionRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showInfoBanner, setShowInfoBanner] = useState(true);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAppId, setSelectedAppId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  const groups: ApplicationGroup[] | null = (() => {
    if (permissions === null) return null;
    const byApplication = new Map<string, ApplicationGroup>();
    for (const permission of permissions) {
      const app = permission.application;
      if (!app) continue;
      const group = byApplication.get(app.id) ?? { id: app.id, name: app.name, permissions: [] };
      group.permissions.push(permission);
      byApplication.set(app.id, group);
    }
    return [...byApplication.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  async function loadPage(offset: number, append: boolean) {
    const supabase = createKontroliaSchemaClient();
    const { data } = await supabase
      .from("permissions")
      .select("id, key, resource, action, description, application:applications(id, name)")
      .order("key")
      .range(offset, offset + PERMISSIONS_PAGE_SIZE - 1)
      .returns<PermissionRow[]>();
    const page = data ?? [];
    setPermissions((current) => (append ? [...(current ?? []), ...page] : page));
    setHasMore(page.length === PERMISSIONS_PAGE_SIZE);
  }

  useEffect(() => {
    void loadPage(0, false);
  }, []);

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadPage((permissions ?? []).length, true);
    setLoadingMore(false);
  }

  function handleCopyKey(key: string) {
    void navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  // Filter permissions
  const totalPermissionsCount = permissions?.length ?? 0;
  const totalAppsCount = groups?.length ?? 0;

  return (
    <div className="k-flex k-flex-col k-gap-6 k-pb-12">
      {/* --- HERO BANNER --- */}
      <div className="k-relative k-overflow-hidden k-rounded-2xl k-bg-[linear-gradient(135deg,#1b1030,#2b1a52_45%,#4c2a8c)] k-p-6 sm:k-p-8 k-shadow-md k-text-white">
        <div className="k-relative k-z-10 k-flex k-flex-col md:k-flex-row md:k-items-center md:k-justify-between k-gap-4">
          <div>
            <span className="k-inline-flex k-items-center k-gap-2 k-rounded-full k-bg-white/10 k-px-3.5 k-py-1 k-text-xs k-font-semibold k-text-white/80 k-backdrop-blur-sm">
              <ShieldCheckIcon className="k-w-3.5 k-h-3.5" />
              <span>Gobernanza de Seguridad</span>
            </span>
            <h1 className="k-mt-3 k-text-3xl sm:k-text-4xl k-font-extrabold k-tracking-tight k-text-white">
              Permisos
            </h1>
            <p className="k-mt-1.5 k-text-sm sm:k-text-base k-text-white/70 k-max-w-2xl">
              Catálogo unificado de permisos e intenciones declarados por cada aplicación.
            </p>
          </div>
        </div>
        <div className="k-absolute -k-right-10 -k-top-10 k-w-64 k-h-64 k-rounded-full k-bg-white/5 k-blur-2xl k-pointer-events-none" />
      </div>

      {/* --- INFO EXPLANATION BANNER --- */}
      {showInfoBanner && (
        <div className="k-relative k-rounded-xl k-border k-border-primary/20 k-bg-primary/5 k-p-4 k-text-sm k-flex k-items-start k-gap-3.5">
          <InfoIcon className="k-w-5 k-h-5 k-text-primary k-shrink-0 k-mt-0.5" />
          <div className="k-flex-1 k-pr-6">
            <p className="k-font-semibold k-text-foreground">Sincronización Automática en CI/CD</p>
            <p className="k-text-xs k-text-muted-foreground k-mt-1 k-leading-relaxed">
              Los permisos no se crean manualmente. Se registran y actualizan automáticamente cuando cada aplicación (Facturación, CRM, etc.) despliega sus cambios utilizando su clave de sincronización de API.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInfoBanner(false)}
            className="k-absolute k-top-3.5 k-right-3.5 k-text-muted-foreground hover:k-text-foreground"
          >
            <XIcon className="k-w-4 k-h-4" />
          </button>
        </div>
      )}

      {/* --- METRICS STATS BAR --- */}
      <div className="k-grid k-grid-cols-1 sm:k-grid-cols-2 k-gap-4">
        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-primary/10 k-text-primary">
            <KeyIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{permissions === null ? "—" : totalPermissionsCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Permisos Registrados</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-amber-500/10 k-text-amber-600 dark:k-text-amber-400">
            <AppIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{permissions === null ? "—" : totalAppsCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Aplicaciones Emisoras</p>
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
            placeholder="Buscar por clave, recurso o acción..."
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

        <div className="k-flex k-items-center k-gap-2">
          {/* Application Selector */}
          {groups && groups.length > 0 && (
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="k-rounded-lg k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-xs k-font-medium focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20"
            >
              <option value="all">Todas las aplicaciones ({totalAppsCount})</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.permissions.length})
                </option>
              ))}
            </select>
          )}

          {/* Grid/Table View Switcher */}
          <div className="k-inline-flex k-items-center k-rounded-lg k-bg-muted k-p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Vista de cuadrícula"
              className={`k-p-1.5 k-rounded-md k-transition-all ${
                viewMode === "grid" ? "k-bg-background k-text-foreground k-shadow-sm" : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              <LayoutGridIcon />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Vista de lista"
              className={`k-p-1.5 k-rounded-md k-transition-all ${
                viewMode === "table" ? "k-bg-background k-text-foreground k-shadow-sm" : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              <ListIcon />
            </button>
          </div>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      {groups === null ? (
        /* LOADING SKELETON */
        <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 lg:k-grid-cols-3 k-gap-5">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="k-p-5 k-flex k-flex-col k-gap-4 k-animate-pulse">
              <div className="k-flex k-items-center k-gap-3">
                <div className="k-w-10 k-h-10 k-rounded-xl k-bg-muted" />
                <div className="k-flex-1 k-flex k-flex-col k-gap-1.5">
                  <div className="k-h-4 k-w-2/3 k-bg-muted k-rounded" />
                  <div className="k-h-3 k-w-1/3 k-bg-muted k-rounded" />
                </div>
              </div>
              <div className="k-h-12 k-w-full k-bg-muted/60 k-rounded-md" />
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        /* EMPTY STATE */
        <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center">
          <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-muted k-flex k-items-center k-justify-center k-text-muted-foreground k-mb-4">
            <ShieldCheckIcon className="k-w-8 k-h-8" />
          </div>
          <h3 className="k-text-lg k-font-semibold">Sin permisos registrados todavía</h3>
          <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
            Los permisos se declaran e importan automáticamente desde el pipeline de despliegue (CI/CD) de cada aplicación del ecosistema.
          </p>
        </Card>
      ) : (
        <div className="k-flex k-flex-col k-gap-8">
          {groups
            .filter((group) => selectedAppId === "all" || group.id === selectedAppId)
            .map((group) => {
              const query = searchQuery.toLowerCase().trim();
              const filteredPermissions = group.permissions.filter(
                (p) =>
                  !query ||
                  p.key.toLowerCase().includes(query) ||
                  p.resource.toLowerCase().includes(query) ||
                  p.action.toLowerCase().includes(query) ||
                  (p.description && p.description.toLowerCase().includes(query))
              );

              if (searchQuery && filteredPermissions.length === 0) return null;

              return (
                <div key={group.id} className="k-flex k-flex-col k-gap-3">
                  <div className="k-flex k-items-center k-justify-between">
                    <h2 className="k-text-base k-font-semibold k-flex k-items-center k-gap-2">
                      <div
                        className={`k-w-7 k-h-7 k-rounded-lg k-flex k-items-center k-justify-center k-font-bold k-text-xs ${getAvatarGradient(
                          group.id
                        )}`}
                      >
                        {getInitials(group.name)}
                      </div>
                      <span>{group.name}</span>
                      <span className="k-text-xs k-font-normal k-text-muted-foreground">
                        ({filteredPermissions.length} de {group.permissions.length} permisos)
                      </span>
                    </h2>
                  </div>

                  {filteredPermissions.length === 0 ? (
                    <Card className="k-p-6 k-text-center k-text-sm k-text-muted-foreground">
                      No se encontraron permisos en esta aplicación con el filtro de búsqueda.
                    </Card>
                  ) : viewMode === "grid" ? (
                    /* GRID VIEW */
                    <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 lg:k-grid-cols-3 k-gap-4">
                      {filteredPermissions.map((permission) => (
                        <Card
                          key={permission.id}
                          className="k-p-4 k-flex k-flex-col k-justify-between k-gap-3 hover:k-border-primary/40 hover:k-shadow-md k-transition-all k-duration-200"
                        >
                          {/* Key & Copy */}
                          <div className="k-flex k-items-start k-justify-between k-gap-2">
                            <div className="k-min-w-0 k-flex-1">
                              <code className="k-text-xs k-font-mono k-font-bold k-text-primary k-break-all select-all">
                                {permission.key}
                              </code>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyKey(permission.key)}
                              className="k-text-muted-foreground hover:k-text-foreground k-shrink-0 k-p-1 hover:k-bg-muted k-rounded-md"
                              title="Copiar clave de permiso"
                            >
                              {copiedKey === permission.key ? (
                                <CheckIcon className="k-w-3.5 k-h-3.5 k-text-emerald-600" />
                              ) : (
                                <CopyIcon />
                              )}
                            </button>
                          </div>

                          {/* Description */}
                          <p className="k-text-xs k-text-muted-foreground k-line-clamp-2">
                            {permission.description ?? "Sin descripción provista por el servicio."}
                          </p>

                          {/* Tags: Resource & Action */}
                          <div className="k-flex k-items-center k-justify-between k-pt-2 k-border-t k-border-border/60 k-text-xs">
                            <div className="k-flex k-items-center k-gap-1.5">
                              <span className="k-text-muted-foreground k-font-medium">Recurso:</span>
                              <span className="k-font-semibold">{permission.resource}</span>
                            </div>

                            <Badge variant={getActionColor(permission.action)}>
                              {permission.action}
                            </Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    /* TABLE VIEW */
                    <Card className="k-p-0 k-overflow-hidden">
                      <div className="k-overflow-x-auto">
                        <table className="k-w-full k-text-sm">
                          <thead>
                            <tr className="k-border-b k-border-border k-bg-muted/40 k-text-left k-text-xs k-uppercase k-tracking-wider k-text-muted-foreground">
                              <th className="k-px-5 k-py-3.5 k-font-semibold">Clave de Permiso</th>
                              <th className="k-px-5 k-py-3.5 k-font-semibold">Recurso</th>
                              <th className="k-px-5 k-py-3.5 k-font-semibold">Acción</th>
                              <th className="k-px-5 k-py-3.5 k-font-semibold">Descripción</th>
                              <th className="k-px-5 k-py-3.5 k-font-semibold k-text-right">Copiar</th>
                            </tr>
                          </thead>
                          <tbody className="k-divide-y k-divide-border">
                            {filteredPermissions.map((permission) => (
                              <tr key={permission.id} className="hover:k-bg-muted/30 k-transition-colors">
                                <td className="k-px-5 k-py-3.5">
                                  <code className="k-font-mono k-text-xs k-font-semibold k-text-primary">
                                    {permission.key}
                                  </code>
                                </td>
                                <td className="k-px-5 k-py-3.5 k-text-xs k-font-medium">{permission.resource}</td>
                                <td className="k-px-5 k-py-3.5">
                                  <Badge variant={getActionColor(permission.action)}>
                                    {permission.action}
                                  </Badge>
                                </td>
                                <td className="k-px-5 k-py-3.5 k-text-xs k-text-muted-foreground">
                                  {permission.description ?? "—"}
                                </td>
                                <td className="k-px-5 k-py-3.5 k-text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyKey(permission.key)}
                                    className="k-inline-flex k-items-center k-gap-1 k-text-xs k-text-muted-foreground hover:k-text-foreground"
                                  >
                                    {copiedKey === permission.key ? (
                                      <span className="k-text-emerald-600 k-font-semibold">¡Copiado!</span>
                                    ) : (
                                      <CopyIcon />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
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

