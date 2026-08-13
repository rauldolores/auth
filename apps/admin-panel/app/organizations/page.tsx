"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card, Dialog } from "@kontrolia/ui";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  isOwner: boolean;
  isAdmin: boolean;
}

interface MembershipRow {
  status: string;
  organization: { id: string; name: string; slug: string; created_at: string } | null;
  membership_roles: { role: { slug: string } | null }[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

// --- Inline SVG Icons for UI polish ---
function BuildingIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-6 0h6M9 7h1m-1 4h1m4-4h1m-1 4h1" />
    </svg>
  );
}

function CrownIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 16l-1-8 4 2 4-4 4 2 4-2-1 8H5zm0 0v2a1 1 0 001 1h12a1 1 0 001-1v-2H5z" />
    </svg>
  );
}

function ShieldIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function UserIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function PlusIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v16m7.5-8.5h-15" />
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

function EditIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

function CalendarIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

export default function OrganizationsPage() {
  const { user, refresh } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // View, search & filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "owner" | "admin">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  // Dialog & Action states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationRow | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingOrg, setDeletingOrg] = useState<OrganizationRow | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [copiedSlugId, setCopiedSlugId] = useState<string | null>(null);

  async function loadOrganizations() {
    if (!user) return;
    const supabase = createKontroliaSchemaClient();
    const { data, error: fetchError } = await supabase
      .from("memberships")
      .select("status, organization:organizations(id, name, slug, created_at), membership_roles(role:roles(slug))")
      .eq("user_id", user.id)
      .eq("status", "active")
      .returns<MembershipRow[]>();

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setError(null);

    const rows = (data ?? [])
      .filter((row): row is MembershipRow & { organization: NonNullable<MembershipRow["organization"]> } => row.organization !== null)
      .map((row) => {
        const slugs = row.membership_roles.map((mr) => mr.role?.slug).filter(Boolean);
        return {
          id: row.organization.id,
          name: row.organization.name,
          slug: row.organization.slug,
          created_at: row.organization.created_at,
          isOwner: slugs.includes("owner"),
          isAdmin: slugs.includes("owner") || slugs.includes("admin"),
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setOrganizations(rows);
  }

  useEffect(() => {
    void loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function triggerSuccessNotice(msg: string) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  async function handleCreate(name: string) {
    setError(null);
    setPendingId("__create__");
    try {
      const supabase = createKontroliaSchemaClient();
      const slug = slugify(name);

      const { error: insertError } = await supabase.from("organizations").insert({ name, slug });
      if (insertError) throw insertError;

      await refresh();
      setShowCreateModal(false);
      triggerSuccessNotice(`Organización "${name}" creada correctamente.`);
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la organización.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleRename(org: OrganizationRow) {
    if (!editName.trim()) return;
    setError(null);
    setPendingId(org.id);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ name: editName.trim() })
        .eq("id", org.id);
      if (updateError) throw updateError;

      await refresh();
      setEditingOrg(null);
      triggerSuccessNotice(`Organización renombrada a "${editName.trim()}".`);
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renombrar la organización.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(org: OrganizationRow) {
    setError(null);
    setPendingId(org.id);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: deleteError, count } = await supabase
        .from("organizations")
        .delete({ count: "exact" })
        .eq("id", org.id);
      if (deleteError) throw deleteError;
      if (!count) throw new Error("No tienes permiso para eliminar esta organización (solo el Owner puede), o ya no existe.");

      await refresh();
      setDeletingOrg(null);
      setConfirmDeleteText("");
      triggerSuccessNotice(`Organización "${org.name}" eliminada.`);
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la organización.");
    } finally {
      setPendingId(null);
    }
  }

  function handleCopySlug(id: string, slug: string) {
    void navigator.clipboard.writeText(slug);
    setCopiedSlugId(id);
    setTimeout(() => setCopiedSlugId(null), 2000);
  }

  // Derived counts and metrics
  const totalOrgs = organizations?.length ?? 0;
  const ownerOrgs = organizations?.filter((o) => o.isOwner).length ?? 0;
  const adminOrgs = organizations?.filter((o) => o.isAdmin).length ?? 0;

  // Filtered organizations list
  const filteredOrganizations = (organizations ?? []).filter((org) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || org.name.toLowerCase().includes(query) || org.slug.toLowerCase().includes(query);
    const matchesRole =
      filterRole === "all" ||
      (filterRole === "owner" && org.isOwner) ||
      (filterRole === "admin" && org.isAdmin);

    return matchesQuery && matchesRole;
  });

  return (
    <div className="k-flex k-flex-col k-gap-6 k-pb-12">
      {/* --- HERO BANNER --- */}
      <div className="k-relative k-overflow-hidden k-rounded-2xl k-bg-[linear-gradient(135deg,#1b1030,#2b1a52_45%,#4c2a8c)] k-p-6 sm:k-p-8 k-shadow-md k-text-white">
        <div className="k-relative k-z-10 k-flex k-flex-col md:k-flex-row md:k-items-center md:k-justify-between k-gap-4">
          <div>
            <span className="k-inline-flex k-items-center k-gap-2 k-rounded-full k-bg-white/10 k-px-3.5 k-py-1 k-text-xs k-font-semibold k-text-white/80 k-backdrop-blur-sm">
              <BuildingIcon className="k-w-3.5 k-h-3.5" />
              <span>Gestión de Espacios</span>
            </span>
            <h1 className="k-mt-3 k-text-3xl sm:k-text-4xl k-font-extrabold k-tracking-tight k-text-white">
              Organizaciones
            </h1>
            <p className="k-mt-1.5 k-text-sm sm:k-text-base k-text-white/70 k-max-w-2xl">
              Administra los tenantes y espacios de trabajo a los que perteneces.
            </p>
          </div>
          <div className="k-shrink-0">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="k-inline-flex k-items-center k-gap-2 k-rounded-xl k-bg-white k-px-4 k-py-2.5 k-text-sm k-font-semibold k-text-slate-900 k-shadow-lg hover:k-bg-slate-100 k-transition-all active:k-scale-[0.98]"
            >
              <PlusIcon />
              <span>Nueva Organización</span>
            </button>
          </div>
        </div>
        <div className="k-absolute -k-right-10 -k-top-10 k-w-64 k-h-64 k-rounded-full k-bg-white/5 k-blur-2xl k-pointer-events-none" />
      </div>

      {/* --- NOTIFICATIONS / ALERTS --- */}
      {error && (
        <div className="k-flex k-items-start k-gap-3 k-rounded-xl k-border k-border-destructive/30 k-bg-destructive/10 k-p-4 k-text-sm k-text-destructive">
          <AlertTriangleIcon className="k-w-5 k-h-5 k-shrink-0 k-mt-0.5" />
          <div className="k-flex-1">
            <p className="k-font-semibold">Error</p>
            <p className="k-mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="k-text-destructive hover:k-opacity-70">
            <XIcon />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="k-flex k-items-center k-gap-3 k-rounded-xl k-border k-border-emerald-500/30 k-bg-emerald-500/10 k-p-4 k-text-sm k-text-emerald-700 dark:k-text-emerald-300">
          <CheckIcon className="k-w-5 k-h-5 k-text-emerald-600 k-shrink-0" />
          <p className="k-flex-1 k-font-medium">{successMessage}</p>
          <button type="button" onClick={() => setSuccessMessage(null)} className="k-text-emerald-600 hover:k-opacity-70">
            <XIcon />
          </button>
        </div>
      )}

      {/* --- METRICS STATS BAR --- */}
      <div className="k-grid k-grid-cols-1 sm:k-grid-cols-3 k-gap-4">
        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-primary/10 k-text-primary">
            <BuildingIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{organizations === null ? "—" : totalOrgs}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Total Organizaciones</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-amber-500/10 k-text-amber-600 dark:k-text-amber-400">
            <CrownIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{organizations === null ? "—" : ownerOrgs}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Propietario (Owner)</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-blue-500/10 k-text-blue-600 dark:k-text-blue-400">
            <ShieldIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{organizations === null ? "—" : adminOrgs}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Como Administrador</p>
          </div>
        </Card>
      </div>

      {/* --- CONTROL TOOLBAR (Search, Filters, View toggle) --- */}
      <div className="k-flex k-flex-col sm:k-flex-row sm:k-items-center sm:k-justify-between k-gap-3 k-bg-card k-p-3 k-rounded-xl k-border k-border-border">
        {/* Search Input */}
        <div className="k-relative k-flex-1">
          <SearchIcon className="k-absolute k-left-3 k-top-1/2 -k-translate-y-1/2 k-text-muted-foreground k-w-4 k-h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o slug..."
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
          {/* Role Filter Tabs */}
          <div className="k-inline-flex k-items-center k-rounded-lg k-bg-muted k-p-1 k-text-xs k-font-medium">
            <button
              type="button"
              onClick={() => setFilterRole("all")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                filterRole === "all"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Todas ({totalOrgs})
            </button>
            <button
              type="button"
              onClick={() => setFilterRole("owner")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                filterRole === "owner"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Propietario ({ownerOrgs})
            </button>
            <button
              type="button"
              onClick={() => setFilterRole("admin")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                filterRole === "admin"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Admin ({adminOrgs})
            </button>
          </div>

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

      {/* --- CONTENT AREA (Grid, Table, Skeleton, or Empty State) --- */}
      {organizations === null ? (
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
              <div className="k-h-8 k-w-full k-bg-muted/60 k-rounded-md" />
              <div className="k-flex k-justify-between k-items-center k-pt-2 k-border-t k-border-border/60">
                <div className="k-h-3 k-w-20 k-bg-muted k-rounded" />
                <div className="k-h-7 k-w-16 k-bg-muted k-rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredOrganizations.length === 0 ? (
        /* EMPTY STATE */
        <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center">
          <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-muted k-flex k-items-center k-justify-center k-text-muted-foreground k-mb-4">
            <BuildingIcon className="k-w-8 k-h-8" />
          </div>
          <h3 className="k-text-lg k-font-semibold">
            {searchQuery || filterRole !== "all" ? "No se encontraron resultados" : "Sin organizaciones todavía"}
          </h3>
          <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
            {searchQuery || filterRole !== "all"
              ? "Prueba cambiando la búsqueda o restableciendo los filtros para ver otras organizaciones."
              : "Aún no perteneces a ninguna organización. Crea la primera para comenzar a administrar el ecosistema."}
          </p>

          <div className="k-mt-6 k-flex k-items-center k-gap-3">
            {searchQuery || filterRole !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterRole("all");
                }}
                className="k-rounded-lg k-border k-border-border k-bg-background k-px-4 k-py-2 k-text-sm k-font-medium hover:k-bg-muted k-transition-all"
              >
                Restablecer Filtros
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground k-shadow-sm hover:k-opacity-90 k-transition-all"
              >
                <PlusIcon />
                <span>Crear Organización</span>
              </button>
            )}
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 lg:k-grid-cols-3 k-gap-5">
          {filteredOrganizations.map((org) => (
            <Card
              key={org.id}
              className="k-p-5 k-flex k-flex-col k-justify-between k-gap-4 hover:k-border-primary/40 hover:k-shadow-md k-transition-all k-duration-200"
            >
              {/* Card Header: Avatar, Name, Role Badge */}
              <div className="k-flex k-items-start k-justify-between k-gap-3">
                <div className="k-flex k-items-center k-gap-3 k-min-w-0">
                  <div
                    className={`k-w-11 k-h-11 k-rounded-xl k-flex k-items-center k-justify-center k-font-bold k-text-sm k-shrink-0 k-shadow-sm ${getAvatarGradient(
                      org.id
                    )}`}
                  >
                    {getInitials(org.name)}
                  </div>
                  <div className="k-min-w-0">
                    <h3 className="k-font-semibold k-text-base k-truncate" title={org.name}>
                      {org.name}
                    </h3>
                    <div className="k-flex k-items-center k-gap-1.5 k-mt-0.5">
                      {org.isOwner ? (
                        <Badge variant="primary">
                          <CrownIcon className="k-w-3 k-h-3 k-mr-1" />
                          Owner
                        </Badge>
                      ) : org.isAdmin ? (
                        <Badge variant="neutral">
                          <ShieldIcon className="k-w-3 k-h-3 k-mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="neutral">
                          <UserIcon className="k-w-3 k-h-3 k-mr-1" />
                          Miembro
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Slug & Metadata Tag */}
              <div className="k-flex k-items-center k-justify-between k-rounded-lg k-bg-muted/60 k-px-3 k-py-2 k-text-xs">
                <div className="k-flex k-items-center k-gap-1.5 k-min-w-0">
                  <span className="k-text-muted-foreground k-font-medium">Slug:</span>
                  <code className="k-font-mono k-font-semibold k-truncate">{org.slug}</code>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopySlug(org.id, org.slug)}
                  title="Copiar slug"
                  className="k-inline-flex k-items-center k-gap-1 k-text-muted-foreground hover:k-text-foreground k-ml-2 k-shrink-0"
                >
                  {copiedSlugId === org.id ? (
                    <span className="k-inline-flex k-items-center k-text-emerald-600 k-font-medium">
                      <CheckIcon className="k-mr-0.5" /> Copiado
                    </span>
                  ) : (
                    <CopyIcon />
                  )}
                </button>
              </div>

              {/* Card Footer: Creation Date & Actions */}
              <div className="k-flex k-items-center k-justify-between k-pt-3 k-border-t k-border-border/60 k-text-xs k-text-muted-foreground">
                <div className="k-flex k-items-center k-gap-1.5">
                  <CalendarIcon />
                  <span>{new Date(org.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>

                <div className="k-flex k-items-center k-gap-2">
                  {org.isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOrg(org);
                        setEditName(org.name);
                      }}
                      className="k-inline-flex k-items-center k-gap-1 k-px-2.5 k-py-1 k-rounded-md k-font-medium k-text-foreground hover:k-bg-muted k-transition-all"
                    >
                      <EditIcon className="k-w-3.5 k-h-3.5" />
                      <span>Editar</span>
                    </button>
                  )}

                  {org.isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingOrg(org);
                        setConfirmDeleteText("");
                      }}
                      className="k-inline-flex k-items-center k-gap-1 k-px-2.5 k-py-1 k-rounded-md k-font-medium k-text-destructive hover:k-bg-destructive/10 k-transition-all"
                    >
                      <TrashIcon className="k-w-3.5 k-h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
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
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Organización</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Slug</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Rol</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Creada</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold k-text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="k-divide-y k-divide-border">
                {filteredOrganizations.map((org) => (
                  <tr key={org.id} className="hover:k-bg-muted/30 k-transition-colors">
                    {/* Name & Avatar */}
                    <td className="k-px-5 k-py-3.5">
                      <div className="k-flex k-items-center k-gap-3">
                        <div
                          className={`k-w-9 k-h-9 k-rounded-lg k-flex k-items-center k-justify-center k-font-bold k-text-xs k-shrink-0 ${getAvatarGradient(
                            org.id
                          )}`}
                        >
                          {getInitials(org.name)}
                        </div>
                        <span className="k-font-semibold k-text-foreground">{org.name}</span>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="k-px-5 k-py-3.5">
                      <div className="k-inline-flex k-items-center k-gap-1.5 k-rounded-md k-bg-muted k-px-2.5 k-py-1 k-text-xs k-font-mono">
                        <span>{org.slug}</span>
                        <button
                          type="button"
                          onClick={() => handleCopySlug(org.id, org.slug)}
                          className="k-text-muted-foreground hover:k-text-foreground"
                          title="Copiar"
                        >
                          {copiedSlugId === org.id ? <CheckIcon className="k-text-emerald-600" /> : <CopyIcon />}
                        </button>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="k-px-5 k-py-3.5">
                      {org.isOwner ? (
                        <Badge variant="primary">Owner</Badge>
                      ) : org.isAdmin ? (
                        <Badge variant="neutral">Admin</Badge>
                      ) : (
                        <Badge variant="neutral">Miembro</Badge>
                      )}
                    </td>

                    {/* Date */}
                    <td className="k-px-5 k-py-3.5 k-text-muted-foreground k-text-xs">
                      {new Date(org.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    </td>

                    {/* Actions */}
                    <td className="k-px-5 k-py-3.5 k-text-right k-whitespace-nowrap">
                      <div className="k-inline-flex k-items-center k-gap-2">
                        {org.isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOrg(org);
                              setEditName(org.name);
                            }}
                            className="k-text-xs k-font-medium k-text-muted-foreground hover:k-text-foreground hover:k-underline"
                          >
                            Editar
                          </button>
                        )}
                        {org.isOwner && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingOrg(org);
                              setConfirmDeleteText("");
                            }}
                            className="k-text-xs k-font-medium k-text-destructive hover:k-underline"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* --- CREATE ORGANIZATION MODAL --- */}
      <CreateOrganizationDialog
        open={showCreateModal}
        isSubmitting={pendingId === "__create__"}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
      />

      {/* --- RENAME ORGANIZATION MODAL --- */}
      <RenameOrganizationDialog
        editingOrg={editingOrg}
        editName={editName}
        setEditName={setEditName}
        isSubmitting={pendingId === editingOrg?.id}
        onClose={() => setEditingOrg(null)}
        onSubmit={() => editingOrg && void handleRename(editingOrg)}
      />

      {/* --- DELETE ORGANIZATION DIALOG --- */}
      <Dialog
        open={deletingOrg !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingOrg(null);
            setConfirmDeleteText("");
          }
        }}
        title="Eliminar organización"
      >
        {deletingOrg && (
          <div className="k-flex k-flex-col k-gap-4 k-pt-1">
            <div className="k-flex k-items-start k-gap-3 k-rounded-xl k-border k-border-destructive/30 k-bg-destructive/10 k-p-4 k-text-sm k-text-destructive">
              <AlertTriangleIcon className="k-w-5 k-h-5 k-shrink-0 k-mt-0.5" />
              <div>
                <p className="k-font-semibold">¡Atención! Esta acción es permanente e irreversible.</p>
                <p className="k-mt-1 k-text-xs k-opacity-90">
                  Se eliminará definitivamente la organización <strong>{deletingOrg.name}</strong>, incluyendo todos sus miembros, roles, invitaciones e historial de auditoría.
                </p>
              </div>
            </div>

            <div className="k-flex k-flex-col k-gap-2">
              <label htmlFor="k-org-delete-confirm" className="k-text-sm k-text-muted-foreground">
                Para confirmar la eliminación, escribe <strong>{deletingOrg.name}</strong> a continuación:
              </label>
              <input
                id="k-org-delete-confirm"
                type="text"
                autoFocus
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder={deletingOrg.name}
                className="k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2.5 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-destructive/30 focus:k-border-destructive"
              />
            </div>

            <div className="k-flex k-items-center k-justify-end k-gap-3 k-pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingOrg(null);
                  setConfirmDeleteText("");
                }}
                className="k-rounded-lg k-px-4 k-py-2 k-text-sm k-font-medium k-text-muted-foreground hover:k-bg-muted k-transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirmDeleteText !== deletingOrg.name || pendingId === deletingOrg.id}
                onClick={() => void handleDelete(deletingOrg)}
                className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-destructive k-px-4 k-py-2 k-text-sm k-font-medium k-text-destructive-foreground hover:k-opacity-90 disabled:k-opacity-50 k-transition-all"
              >
                {pendingId === deletingOrg.id ? (
                  <>
                    <SpinnerIcon />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <TrashIcon />
                    <span>Eliminar definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

{/* --- SUB-COMPONENT: CREATE DIALOG --- */}
function CreateOrganizationDialog({
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const previewSlug = slugify(name);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()} title="Crear nueva organización">
      <form onSubmit={handleSubmit} className="k-flex k-flex-col k-gap-4 k-pt-1">
        <div className="k-flex k-flex-col k-gap-1.5">
          <label htmlFor="create-org-name" className="k-text-sm k-font-medium">
            Nombre de la organización
          </label>
          <input
            id="create-org-name"
            type="text"
            required
            autoFocus
            placeholder="ej. Acuña & Asociados"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2.5 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary"
          />
        </div>

        {/* Live Slug Preview */}
        {name.trim() && (
          <div className="k-rounded-lg k-border k-border-border/80 k-bg-muted/50 k-p-3 k-text-xs">
            <p className="k-text-muted-foreground k-font-medium">Identificador único (Slug):</p>
            <p className="k-font-mono k-font-semibold k-text-primary k-mt-0.5">{previewSlug || "—"}</p>
          </div>
        )}

        <div className="k-rounded-lg k-bg-primary/5 k-border k-border-primary/10 k-p-3 k-text-xs k-text-muted-foreground">
          💡 Como creador de la organización, se te asignará automáticamente el rol de <strong>Owner (Propietario)</strong>.
        </div>

        <div className="k-flex k-items-center k-justify-end k-gap-3 k-pt-2">
          <button
            type="button"
            onClick={onClose}
            className="k-rounded-lg k-px-4 k-py-2 k-text-sm k-font-medium k-text-muted-foreground hover:k-bg-muted k-transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground hover:k-opacity-90 disabled:k-opacity-50 k-transition-all"
          >
            {isSubmitting ? (
              <>
                <SpinnerIcon />
                <span>Creando...</span>
              </>
            ) : (
              <>
                <PlusIcon />
                <span>Crear organización</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

{/* --- SUB-COMPONENT: RENAME DIALOG --- */}
function RenameOrganizationDialog({
  editingOrg,
  editName,
  setEditName,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  editingOrg: OrganizationRow | null;
  editName: string;
  setEditName: (val: string) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    onSubmit();
  }

  return (
    <Dialog open={editingOrg !== null} onOpenChange={(val) => !val && onClose()} title="Editar organización">
      {editingOrg && (
        <form onSubmit={handleSubmit} className="k-flex k-flex-col k-gap-4 k-pt-1">
          <div className="k-flex k-flex-col k-gap-1.5">
            <label htmlFor="rename-org-input" className="k-text-sm k-font-medium">
              Nombre de la organización
            </label>
            <input
              id="rename-org-input"
              type="text"
              required
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2.5 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary"
            />
          </div>

          <div className="k-rounded-lg k-border k-border-border/80 k-bg-muted/50 k-p-3 k-text-xs">
            <span className="k-text-muted-foreground">Slug actual: </span>
            <code className="k-font-mono k-font-semibold">{editingOrg.slug}</code>
          </div>

          <div className="k-flex k-items-center k-justify-end k-gap-3 k-pt-2">
            <button
              type="button"
              onClick={onClose}
              className="k-rounded-lg k-px-4 k-py-2 k-text-sm k-font-medium k-text-muted-foreground hover:k-bg-muted k-transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!editName.trim() || editName.trim() === editingOrg.name || isSubmitting}
              className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground hover:k-opacity-90 disabled:k-opacity-50 k-transition-all"
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar cambios</span>
              )}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

