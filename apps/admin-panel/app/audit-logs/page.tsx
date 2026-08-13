"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  "organization.created": "Organización creada",
  "membership.created": "Miembro agregado",
  "membership.removed": "Miembro eliminado",
  "membership.status_changed": "Estado de miembro cambiado",
  "invitation.created": "Invitación enviada",
  "invitation.accepted": "Invitación aceptada",
  "invitation.revoked": "Invitación revocada",
  "invitation.resent": "Invitación reenviada",
  "role.assigned": "Rol asignado",
  "role.unassigned": "Rol removido",
  "device.revoked": "Sesión revocada",
};

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

function ClockIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UserIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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

function AlertTriangleIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

function getActionBadgeVariant(action: string): "neutral" | "primary" | "success" | "warning" {
  if (action.includes("created") || action.includes("accepted")) return "success";
  if (action.includes("removed") || action.includes("revoked")) return "warning";
  if (action.includes("assigned") || action.includes("status_changed")) return "primary";
  return "neutral";
}

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const { organization } = useAuth();
  const [logs, setLogs] = useState<AuditLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState("");
  const [actionCategory, setActionCategory] = useState<"all" | "org" | "member" | "invite" | "role">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  async function loadPage(offset: number) {
    if (!organization) return;
    const supabase = createKontroliaSchemaClient();
    const { data, error: fetchError } = await supabase
      .from("audit_logs")
      .select("id, actor_user_id, action, target_type, target_id, metadata, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
      .returns<AuditLogRow[]>();

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setError(null);
    const page = data ?? [];
    setLogs((current) => (offset === 0 ? page : [...(current ?? []), ...page]));
    setHasMore(page.length === PAGE_SIZE);
  }

  useEffect(() => {
    setLogs(null);
    void loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadPage((logs ?? []).length);
    setLoadingMore(false);
  }

  if (!organization) {
    return (
      <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center k-my-8">
        <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-primary/10 k-flex k-items-center k-justify-center k-text-primary k-mb-4">
          <ShieldCheckIcon className="k-w-8 k-h-8" />
        </div>
        <h3 className="k-text-lg k-font-semibold">Selecciona una Organización</h3>
        <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
          Para inspeccionar la bitácora de auditoría y eventos de seguridad, selecciona un espacio activo.
        </p>
      </Card>
    );
  }

  // Filter logs
  const filteredLogs = (logs ?? []).filter((log) => {
    const query = searchQuery.toLowerCase().trim();
    const actionText = (ACTION_LABELS[log.action] ?? log.action).toLowerCase();
    const actorText = (log.actor_user_id ?? "sistema").toLowerCase();
    const metadataText = JSON.stringify(log.metadata).toLowerCase();

    const matchesQuery =
      !query || actionText.includes(query) || actorText.includes(query) || metadataText.includes(query);

    const matchesCategory =
      actionCategory === "all" ||
      (actionCategory === "org" && log.action.startsWith("organization")) ||
      (actionCategory === "member" && log.action.startsWith("membership")) ||
      (actionCategory === "invite" && log.action.startsWith("invitation")) ||
      (actionCategory === "role" && log.action.startsWith("role"));

    return matchesQuery && matchesCategory;
  });

  const totalLogsCount = logs?.length ?? 0;

  return (
    <div className="k-flex k-flex-col k-gap-6 k-pb-12">
      {/* --- HERO BANNER --- */}
      <div className="k-relative k-overflow-hidden k-rounded-2xl k-bg-[linear-gradient(135deg,#1b1030,#2b1a52_45%,#4c2a8c)] k-p-6 sm:k-p-8 k-shadow-md k-text-white">
        <div className="k-relative k-z-10 k-flex k-flex-col md:k-flex-row md:k-items-center md:k-justify-between k-gap-4">
          <div>
            <span className="k-inline-flex k-items-center k-gap-2 k-rounded-full k-bg-white/10 k-px-3.5 k-py-1 k-text-xs k-font-semibold k-text-white/80 k-backdrop-blur-sm">
              <ClockIcon className="k-w-3.5 k-h-3.5" />
              <span>Seguridad y Trazabilidad</span>
            </span>
            <h1 className="k-mt-3 k-text-3xl sm:k-text-4xl k-font-extrabold k-tracking-tight k-text-white">
              Audit Log
            </h1>
            <p className="k-mt-1.5 k-text-sm sm:k-text-base k-text-white/70 k-max-w-2xl">
              Historial completo de eventos de seguridad, auditoría y cambios en{" "}
              <strong className="k-text-white k-font-semibold">{organization.name}</strong>.
            </p>
          </div>
        </div>
        <div className="k-absolute -k-right-10 -k-top-10 k-w-64 k-h-64 k-rounded-full k-bg-white/5 k-blur-2xl k-pointer-events-none" />
      </div>

      {/* --- NOTIFICATIONS / ALERTS --- */}
      {error && (
        <div className="k-flex k-items-start k-gap-3 k-rounded-xl k-border k-border-destructive/30 k-bg-destructive/10 k-p-4 k-text-sm k-text-destructive">
          <AlertTriangleIcon className="k-w-5 k-h-5 k-shrink-0 k-mt-0.5" />
          <div className="k-flex-1">
            <p className="k-font-semibold">Error al cargar audit logs</p>
            <p className="k-mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="k-text-destructive hover:k-opacity-70">
            <XIcon />
          </button>
        </div>
      )}

      {/* --- METRICS STATS BAR --- */}
      <div className="k-grid k-grid-cols-1 sm:k-grid-cols-3 k-gap-4">
        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-primary/10 k-text-primary">
            <ClockIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{logs === null ? "—" : totalLogsCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Eventos Registrados</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-emerald-500/10 k-text-emerald-600 dark:k-text-emerald-400">
            <ShieldCheckIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">100%</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Trazabilidad Inmutable</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-amber-500/10 k-text-amber-600 dark:k-text-amber-400">
            <UserIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">
              {logs === null ? "—" : new Set(logs.map((l) => l.actor_user_id).filter(Boolean)).size}
            </p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Actores Distintos</p>
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
            placeholder="Buscar por acción, usuario o detalles..."
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
          {/* Category Tabs */}
          <div className="k-inline-flex k-items-center k-rounded-lg k-bg-muted k-p-1 k-text-xs k-font-medium">
            <button
              type="button"
              onClick={() => setActionCategory("all")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                actionCategory === "all"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setActionCategory("member")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                actionCategory === "member"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Miembros
            </button>
            <button
              type="button"
              onClick={() => setActionCategory("invite")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                actionCategory === "invite"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Invitaciones
            </button>
            <button
              type="button"
              onClick={() => setActionCategory("role")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                actionCategory === "role"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Roles
            </button>
          </div>

          {/* Grid/Table View Switcher */}
          <div className="k-inline-flex k-items-center k-rounded-lg k-bg-muted k-p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Vista de tarjetas"
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
      {logs === null ? (
        /* LOADING SKELETON */
        <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 lg:k-grid-cols-3 k-gap-5">
          {[1, 2, 3].map((i) => (
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
      ) : filteredLogs.length === 0 ? (
        /* EMPTY STATE */
        <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center">
          <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-muted k-flex k-items-center k-justify-center k-text-muted-foreground k-mb-4">
            <ClockIcon className="k-w-8 k-h-8" />
          </div>
          <h3 className="k-text-lg k-font-semibold">
            {searchQuery || actionCategory !== "all" ? "No se encontraron eventos" : "Sin actividad registrada todavía"}
          </h3>
          <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
            {searchQuery || actionCategory !== "all"
              ? "Prueba cambiando la búsqueda o restableciendo los filtros."
              : "Las acciones administrativas y eventos de seguridad se irán registrando automáticamente aquí."}
          </p>
        </Card>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 lg:k-grid-cols-3 k-gap-5">
          {filteredLogs.map((log) => {
            const actorName = log.actor_user_id ?? "sistema";
            const metadataEntries = Object.entries(log.metadata);

            return (
              <Card
                key={log.id}
                className="k-p-5 k-flex k-flex-col k-justify-between k-gap-4 hover:k-border-primary/40 hover:k-shadow-md k-transition-all k-duration-200"
              >
                {/* Header: Action Badge & Date */}
                <div className="k-flex k-items-start k-justify-between k-gap-3">
                  <Badge variant={getActionBadgeVariant(log.action)}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </Badge>

                  <span className="k-text-[11px] k-text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Metadata Details Box */}
                <div className="k-flex k-flex-col k-gap-1.5 k-rounded-lg k-bg-muted/50 k-p-3 k-text-xs k-font-mono">
                  {metadataEntries.length === 0 ? (
                    <span className="k-text-muted-foreground k-font-sans">Sin metadatos adicionales</span>
                  ) : (
                    metadataEntries.map(([key, val]) => (
                      <div key={key} className="k-flex k-items-center k-justify-between k-gap-2 k-truncate">
                        <span className="k-text-muted-foreground k-font-sans">{key}:</span>
                        <span className="k-font-semibold k-text-foreground k-truncate">{String(val)}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer: Actor info */}
                <div className="k-flex k-items-center k-gap-2.5 k-pt-2 k-border-t k-border-border/60 k-text-xs">
                  <div
                    className={`k-w-7 k-h-7 k-rounded-lg k-flex k-items-center k-justify-center k-font-bold k-text-[11px] k-shrink-0 ${getAvatarGradient(
                      actorName
                    )}`}
                  >
                    {getInitials(actorName)}
                  </div>
                  <div className="k-min-w-0 k-flex-1">
                    <p className="k-text-muted-foreground k-text-[10px] k-uppercase k-tracking-wider">Actor</p>
                    <p className="k-font-mono k-text-xs k-text-foreground k-truncate" title={actorName}>
                      {actorName}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card className="k-p-0 k-overflow-hidden">
          <div className="k-overflow-x-auto">
            <table className="k-w-full k-text-sm">
              <thead>
                <tr className="k-border-b k-border-border k-bg-muted/40 k-text-left k-text-xs k-uppercase k-tracking-wider k-text-muted-foreground">
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Acción</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Detalle (Metadatos)</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Actor</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold k-text-right">Fecha y Hora</th>
                </tr>
              </thead>
              <tbody className="k-divide-y k-divide-border">
                {filteredLogs.map((log) => {
                  const actorName = log.actor_user_id ?? "sistema";
                  return (
                    <tr key={log.id} className="hover:k-bg-muted/30 k-transition-colors">
                      {/* Action */}
                      <td className="k-px-5 k-py-3.5">
                        <div className="k-flex k-items-center k-gap-2">
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {ACTION_LABELS[log.action] ?? log.action}
                          </Badge>
                        </div>
                      </td>

                      {/* Metadata */}
                      <td className="k-px-5 k-py-3.5">
                        <div className="k-flex k-flex-wrap k-gap-1.5 k-text-xs k-font-mono">
                          {Object.entries(log.metadata).map(([key, value]) => (
                            <span
                              key={key}
                              className="k-inline-flex k-items-center k-gap-1 k-rounded k-bg-muted k-px-2 k-py-0.5"
                            >
                              <span className="k-text-muted-foreground">{key}:</span>
                              <span className="k-font-semibold">{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="k-px-5 k-py-3.5">
                        <div className="k-flex k-items-center k-gap-2">
                          <div
                            className={`k-w-6 k-h-6 k-rounded-md k-flex k-items-center k-justify-center k-font-bold k-text-[10px] k-shrink-0 ${getAvatarGradient(
                              actorName
                            )}`}
                          >
                            {getInitials(actorName)}
                          </div>
                          <span className="k-font-mono k-text-xs k-text-muted-foreground">{actorName}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="k-px-5 k-py-3.5 k-text-right k-text-xs k-text-muted-foreground k-whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
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
              <span>Cargar más eventos</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

