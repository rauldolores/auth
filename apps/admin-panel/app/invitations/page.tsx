"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card, ConfirmDialog, Dialog } from "@kontrolia/ui";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface RoleOption {
  id: string;
  name: string;
  application: { name: string } | null;
}

interface InvitationRow {
  id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  role: { name: string } | null;
}

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;
const INVITATIONS_PAGE_SIZE = 50;

function invitationLink(token: string): string {
  return `${AUTH_SERVER_URL}/invitations/accept?token=${token}`;
}

/** Matches the DB's own token shape (24 random bytes, hex-encoded) */
function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getInitials(email: string): string {
  const namePart = email.split("@")[0] ?? "";
  const parts = namePart.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const first = parts[0][0] ?? "";
    const second = parts[1][0] ?? "";
    return (first + second).toUpperCase();
  }
  return namePart.slice(0, 2).toUpperCase();
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
function MailIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

function CheckCircleIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertCircleIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function PlusIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v16m7.5-8.5h-15" />
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

function RefreshIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function TrashIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

export default function InvitationsPage() {
  const { organization } = useAuth();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedBannerLink, setCopiedBannerLink] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<InvitationRow | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Filter & View states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "expired">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  function triggerSuccessNotice(msg: string) {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 4000);
  }

  async function loadRoles(orgId: string) {
    const supabase = createKontroliaSchemaClient();
    const { data: roleRows } = await supabase
      .from("roles")
      .select("id, name, application:applications(name)")
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .order("name")
      .returns<RoleOption[]>();
    setRoles(roleRows ?? []);
    if (roleRows?.length && !roleId) setRoleId(roleRows[0]!.id);
  }

  async function loadInvitations(orgId: string, offset = 0, append = false) {
    const supabase = createKontroliaSchemaClient();
    const { data: invitationRows } = await supabase
      .from("invitations")
      .select("id, email, token, created_at, expires_at, accepted_at, role:roles(name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + INVITATIONS_PAGE_SIZE - 1)
      .returns<InvitationRow[]>();
    const page = invitationRows ?? [];
    setInvitations((current) => (append ? [...(current ?? []), ...page] : page));
    setHasMore(page.length === INVITATIONS_PAGE_SIZE);
  }

  async function loadData(orgId: string) {
    await Promise.all([loadRoles(orgId), loadInvitations(orgId)]);
  }

  async function handleLoadMore() {
    if (!organization) return;
    setLoadingMore(true);
    await loadInvitations(organization.id, (invitations ?? []).length, true);
    setLoadingMore(false);
  }

  useEffect(() => {
    if (organization) void loadData(organization.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!organization || !email.trim()) return;
    setError(null);
    setLastInviteLink(null);
    setIsSubmitting(true);
    try {
      const supabase = createKontroliaSchemaClient();
      const { data, error: insertError } = await supabase
        .from("invitations")
        .insert({ organization_id: organization.id, email: email.trim(), role_id: roleId || null })
        .select("token")
        .single();
      if (insertError) throw insertError;

      const link = invitationLink(data.token);
      setLastInviteLink(link);
      triggerSuccessNotice(`Invitación creada para ${email.trim()}.`);
      setEmail("");
      setShowInviteModal(false);
      await loadData(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la invitación.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyLink(row: InvitationRow) {
    await navigator.clipboard.writeText(invitationLink(row.token));
    setCopiedId(row.id);
    setTimeout(() => setCopiedId((current) => (current === row.id ? null : current)), 2000);
  }

  async function handleRevoke(row: InvitationRow) {
    if (!organization) return;
    setError(null);
    setPendingId(row.id);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: deleteError } = await supabase.from("invitations").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
      setRevokeTarget(null);
      triggerSuccessNotice(`Invitación a ${row.email} revocada.`);
      await loadData(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revocar la invitación.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleResend(row: InvitationRow) {
    if (!organization) return;
    setError(null);
    setPendingId(row.id);
    try {
      const supabase = createKontroliaSchemaClient();
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const newToken = randomToken();
      const { error: updateError } = await supabase
        .from("invitations")
        .update({ expires_at: newExpiry, token: newToken })
        .eq("id", row.id);
      if (updateError) throw updateError;
      setLastInviteLink(invitationLink(newToken));
      triggerSuccessNotice(`Invitación reenviada a ${row.email}.`);
      await loadData(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reenviar la invitación.");
    } finally {
      setPendingId(null);
    }
  }

  function invitationStatus(row: InvitationRow): { label: string; variant: "success" | "danger" | "warning" } {
    if (row.accepted_at) return { label: "Aceptada", variant: "success" };
    if (new Date(row.expires_at) < new Date()) return { label: "Expirada", variant: "danger" };
    return { label: "Pendiente", variant: "warning" };
  }

  if (!organization) {
    return (
      <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center k-my-8">
        <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-primary/10 k-flex k-items-center k-justify-center k-text-primary k-mb-4">
          <MailIcon className="k-w-8 k-h-8" />
        </div>
        <h3 className="k-text-lg k-font-semibold">Selecciona una Organización</h3>
        <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
          Para enviar invitaciones y administrar accesos pendientes, selecciona un espacio de trabajo activo.
        </p>
      </Card>
    );
  }

  // Filter invitations
  const filteredInvitations = (invitations ?? []).filter((row) => {
    const query = searchQuery.toLowerCase().trim();
    const roleName = row.role?.name?.toLowerCase() ?? "";
    const matchesQuery = !query || row.email.toLowerCase().includes(query) || roleName.includes(query);

    const status = invitationStatus(row);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" && status.label === "Pendiente") ||
      (statusFilter === "accepted" && status.label === "Aceptada") ||
      (statusFilter === "expired" && status.label === "Expirada");

    return matchesQuery && matchesStatus;
  });

  const totalInvitesCount = invitations?.length ?? 0;
  const pendingCount = invitations?.filter((i) => invitationStatus(i).label === "Pendiente").length ?? 0;
  const acceptedCount = invitations?.filter((i) => invitationStatus(i).label === "Aceptada").length ?? 0;
  const expiredCount = invitations?.filter((i) => invitationStatus(i).label === "Expirada").length ?? 0;

  return (
    <div className="k-flex k-flex-col k-gap-6 k-pb-12">
      {/* --- HERO BANNER --- */}
      <div className="k-relative k-overflow-hidden k-rounded-2xl k-bg-[linear-gradient(135deg,#1b1030,#2b1a52_45%,#4c2a8c)] k-p-6 sm:k-p-8 k-shadow-md k-text-white">
        <div className="k-relative k-z-10 k-flex k-flex-col md:k-flex-row md:k-items-center md:k-justify-between k-gap-4">
          <div>
            <span className="k-inline-flex k-items-center k-gap-2 k-rounded-full k-bg-white/10 k-px-3.5 k-py-1 k-text-xs k-font-semibold k-text-white/80 k-backdrop-blur-sm">
              <MailIcon className="k-w-3.5 k-h-3.5" />
              <span>Gestión de Accesos</span>
            </span>
            <h1 className="k-mt-3 k-text-3xl sm:k-text-4xl k-font-extrabold k-tracking-tight k-text-white">
              Invitaciones
            </h1>
            <p className="k-mt-1.5 k-text-sm sm:k-text-base k-text-white/70 k-max-w-2xl">
              Invita a nuevos miembros a unirse a{" "}
              <strong className="k-text-white k-font-semibold">{organization.name}</strong>.
            </p>
          </div>

          <div className="k-shrink-0">
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="k-inline-flex k-items-center k-gap-2 k-rounded-xl k-bg-white k-px-4 k-py-2.5 k-text-sm k-font-semibold k-text-slate-900 k-shadow-lg hover:k-bg-slate-100 k-transition-all active:k-scale-[0.98]"
            >
              <PlusIcon />
              <span>Enviar Invitación</span>
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

      {successNotice && (
        <div className="k-flex k-items-center k-gap-3 k-rounded-xl k-border k-border-emerald-500/30 k-bg-emerald-500/10 k-p-4 k-text-sm k-text-emerald-700 dark:k-text-emerald-300">
          <CheckIcon className="k-w-5 k-h-5 k-text-emerald-600 k-shrink-0" />
          <p className="k-flex-1 k-font-medium">{successNotice}</p>
          <button type="button" onClick={() => setSuccessNotice(null)} className="k-text-emerald-600 hover:k-opacity-70">
            <XIcon />
          </button>
        </div>
      )}

      {/* --- GENERATED LINK BANNER --- */}
      {lastInviteLink && (
        <Card className="k-flex k-flex-col sm:k-flex-row sm:k-items-center sm:k-justify-between k-gap-4 k-border-emerald-500/40 k-bg-emerald-500/10 k-p-4">
          <div className="k-min-w-0 k-flex-1">
            <div className="k-flex k-items-center k-gap-2 k-text-emerald-700 dark:k-text-emerald-300 k-font-semibold k-text-sm">
              <CheckCircleIcon className="k-w-4 k-h-4" />
              <span>Enlace de invitación generado exitosamente</span>
            </div>
            <p className="k-text-xs k-text-muted-foreground k-mt-0.5">
              Comparte este enlace con el usuario invitado para que complete su registro o inicio de sesión.
            </p>
            <div className="k-mt-2 k-rounded-lg k-bg-background/80 k-border k-border-emerald-500/30 k-px-3 k-py-2 k-font-mono k-text-xs k-text-foreground k-truncate select-all">
              {lastInviteLink}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(lastInviteLink);
              setCopiedBannerLink(true);
              setTimeout(() => setCopiedBannerLink(false), 2000);
            }}
            className="k-shrink-0 k-inline-flex k-items-center k-justify-center k-gap-2 k-rounded-lg k-bg-emerald-600 k-px-4 k-py-2 k-text-sm k-font-medium k-text-white hover:k-bg-emerald-700 k-transition-all"
          >
            {copiedBannerLink ? (
              <>
                <CheckIcon />
                <span>¡Copiado!</span>
              </>
            ) : (
              <>
                <CopyIcon />
                <span>Copiar Enlace</span>
              </>
            )}
          </button>
        </Card>
      )}

      {/* --- METRICS STATS BAR --- */}
      <div className="k-grid k-grid-cols-1 sm:k-grid-cols-4 k-gap-4">
        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-primary/10 k-text-primary">
            <MailIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{invitations === null ? "—" : totalInvitesCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Total Invitaciones</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-amber-500/10 k-text-amber-600 dark:k-text-amber-400">
            <ClockIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{invitations === null ? "—" : pendingCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Pendientes</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-emerald-500/10 k-text-emerald-600 dark:k-text-emerald-400">
            <CheckCircleIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{invitations === null ? "—" : acceptedCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Aceptadas</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-rose-500/10 k-text-rose-600 dark:k-text-rose-400">
            <AlertCircleIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{invitations === null ? "—" : expiredCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Expiradas</p>
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
            placeholder="Buscar por correo o rol asignado..."
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
          {/* Status Filter Tabs */}
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
              Todas ({totalInvitesCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                statusFilter === "pending"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Pendientes ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("accepted")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                statusFilter === "accepted"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Aceptadas ({acceptedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("expired")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                statusFilter === "expired"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Expiradas ({expiredCount})
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

      {/* --- CONTENT AREA --- */}
      {invitations === null ? (
        /* LOADING SKELETON */
        <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 lg:k-grid-cols-3 k-gap-5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="k-p-5 k-flex k-flex-col k-gap-4 k-animate-pulse">
              <div className="k-flex k-items-center k-gap-3">
                <div className="k-w-10 k-h-10 k-rounded-xl k-bg-muted" />
                <div className="k-flex-1 k-flex k-flex-col k-gap-1.5">
                  <div className="k-h-4 k-w-3/4 k-bg-muted k-rounded" />
                  <div className="k-h-3 k-w-1/3 k-bg-muted k-rounded" />
                </div>
              </div>
              <div className="k-h-8 k-w-full k-bg-muted/60 k-rounded-md" />
            </Card>
          ))}
        </div>
      ) : filteredInvitations.length === 0 ? (
        /* EMPTY STATE */
        <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center">
          <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-muted k-flex k-items-center k-justify-center k-text-muted-foreground k-mb-4">
            <MailIcon className="k-w-8 k-h-8" />
          </div>
          <h3 className="k-text-lg k-font-semibold">
            {searchQuery || statusFilter !== "all" ? "No se encontraron invitaciones" : "Sin invitaciones registradas"}
          </h3>
          <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
            {searchQuery || statusFilter !== "all"
              ? "Prueba cambiando el término de búsqueda o restableciendo los filtros."
              : "Envía una invitación para sumar nuevos miembros a este espacio de trabajo."}
          </p>

          <div className="k-mt-6">
            {searchQuery || statusFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="k-rounded-lg k-border k-border-border k-bg-background k-px-4 k-py-2 k-text-sm k-font-medium hover:k-bg-muted k-transition-all"
              >
                Restablecer Filtros
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground hover:k-opacity-90 k-transition-all"
              >
                <PlusIcon />
                <span>Enviar Invitación</span>
              </button>
            )}
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 lg:k-grid-cols-3 k-gap-5">
          {filteredInvitations.map((row) => {
            const status = invitationStatus(row);
            const isPending = status.label === "Pendiente";
            const isExpired = status.label === "Expirada";
            const isPendingAction = pendingId === row.id;

            return (
              <Card
                key={row.id}
                className="k-p-5 k-flex k-flex-col k-justify-between k-gap-4 hover:k-border-primary/40 hover:k-shadow-md k-transition-all k-duration-200"
              >
                {/* Header: Avatar, Email, Status Badge */}
                <div className="k-flex k-items-start k-justify-between k-gap-3">
                  <div className="k-flex k-items-center k-gap-3 k-min-w-0">
                    <div
                      className={`k-w-10 k-h-10 k-rounded-xl k-flex k-items-center k-justify-center k-font-bold k-text-sm k-shrink-0 k-shadow-sm ${getAvatarGradient(
                        row.id
                      )}`}
                    >
                      {getInitials(row.email)}
                    </div>
                    <div className="k-min-w-0">
                      <h3 className="k-font-semibold k-text-sm k-truncate" title={row.email}>
                        {row.email}
                      </h3>
                      <p className="k-text-xs k-text-muted-foreground k-mt-0.5">
                        Rol: <strong className="k-text-foreground">{row.role?.name ?? "—"}</strong>
                      </p>
                    </div>
                  </div>

                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>

                {/* Info Date Box */}
                <div className="k-flex k-items-center k-justify-between k-rounded-lg k-bg-muted/40 k-p-3 k-text-xs k-text-muted-foreground">
                  <div className="k-flex k-items-center k-gap-1.5">
                    <ClockIcon className="k-w-3.5 k-h-3.5" />
                    <span>Enviada: {new Date(row.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
                  </div>

                  {isPending && (
                    <span>Expira: {new Date(row.expires_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="k-flex k-items-center k-justify-end k-gap-2 k-pt-2 k-border-t k-border-border/60">
                  {(isPending || isExpired) && (
                    <button
                      type="button"
                      onClick={() => void handleCopyLink(row)}
                      className="k-inline-flex k-items-center k-gap-1.5 k-px-2.5 k-py-1 k-rounded-md k-text-xs k-font-medium k-text-foreground hover:k-bg-muted k-transition-all"
                    >
                      {copiedId === row.id ? (
                        <span className="k-inline-flex k-items-center k-text-emerald-600 k-font-semibold">
                          <CheckIcon className="k-w-3.5 k-h-3.5 k-mr-0.5" /> Copiado
                        </span>
                      ) : (
                        <>
                          <CopyIcon />
                          <span>Copiar enlace</span>
                        </>
                      )}
                    </button>
                  )}

                  {isExpired && (
                    <button
                      type="button"
                      disabled={isPendingAction}
                      onClick={() => void handleResend(row)}
                      className="k-inline-flex k-items-center k-gap-1.5 k-px-2.5 k-py-1 k-rounded-md k-text-xs k-font-medium k-text-primary hover:k-bg-primary/10 k-transition-all disabled:k-opacity-50"
                    >
                      {isPendingAction ? <SpinnerIcon /> : <RefreshIcon />}
                      <span>Reenviar</span>
                    </button>
                  )}

                  {(isPending || isExpired) && (
                    <button
                      type="button"
                      disabled={isPendingAction}
                      onClick={() => setRevokeTarget(row)}
                      className="k-inline-flex k-items-center k-gap-1.5 k-px-2.5 k-py-1 k-rounded-md k-text-xs k-font-medium k-text-destructive hover:k-bg-destructive/10 k-transition-all disabled:k-opacity-50"
                    >
                      <TrashIcon />
                      <span>Revocar</span>
                    </button>
                  )}
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
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Correo Invitado</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Rol Asignado</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Estado</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Enviada</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold k-text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="k-divide-y k-divide-border">
                {filteredInvitations.map((row) => {
                  const status = invitationStatus(row);
                  const isPending = status.label === "Pendiente";
                  const isExpired = status.label === "Expirada";
                  const isPendingAction = pendingId === row.id;

                  return (
                    <tr key={row.id} className="hover:k-bg-muted/30 k-transition-colors">
                      {/* Email & Avatar */}
                      <td className="k-px-5 k-py-3.5">
                        <div className="k-flex k-items-center k-gap-3">
                          <div
                            className={`k-w-8 k-h-8 k-rounded-lg k-flex k-items-center k-justify-center k-font-bold k-text-xs k-shrink-0 ${getAvatarGradient(
                              row.id
                            )}`}
                          >
                            {getInitials(row.email)}
                          </div>
                          <span className="k-font-semibold k-text-foreground">{row.email}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="k-px-5 k-py-3.5 k-text-xs k-text-muted-foreground">
                        {row.role?.name ?? "—"}
                      </td>

                      {/* Status */}
                      <td className="k-px-5 k-py-3.5">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>

                      {/* Date */}
                      <td className="k-px-5 k-py-3.5 k-text-xs k-text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                      </td>

                      {/* Actions */}
                      <td className="k-px-5 k-py-3.5 k-text-right k-whitespace-nowrap">
                        <div className="k-inline-flex k-items-center k-gap-3">
                          {(isPending || isExpired) && (
                            <button
                              type="button"
                              onClick={() => void handleCopyLink(row)}
                              className="k-text-xs k-font-medium k-text-muted-foreground hover:k-text-foreground hover:k-underline"
                            >
                              {copiedId === row.id ? "¡Copiado!" : "Copiar enlace"}
                            </button>
                          )}

                          {isExpired && (
                            <button
                              type="button"
                              disabled={isPendingAction}
                              onClick={() => void handleResend(row)}
                              className="k-text-xs k-font-medium k-text-primary hover:k-underline disabled:k-opacity-50"
                            >
                              Reenviar
                            </button>
                          )}

                          {(isPending || isExpired) && (
                            <button
                              type="button"
                              disabled={isPendingAction}
                              onClick={() => setRevokeTarget(row)}
                              className="k-text-xs k-font-medium k-text-destructive hover:k-underline disabled:k-opacity-50"
                            >
                              Revocar
                            </button>
                          )}
                        </div>
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
              <span>Cargar más invitaciones</span>
            )}
          </button>
        </div>
      )}

      {/* --- CREATE INVITATION DIALOG --- */}
      <Dialog open={showInviteModal} onOpenChange={(val) => !val && setShowInviteModal(false)} title="Enviar Nueva Invitación">
        <form onSubmit={handleSubmit} className="k-flex k-flex-col k-gap-4 k-pt-1">
          <div className="k-flex k-flex-col k-gap-1.5">
            <label htmlFor="modal-invite-email" className="k-text-sm k-font-medium">
              Correo electrónico del invitado
            </label>
            <input
              id="modal-invite-email"
              type="email"
              required
              autoFocus
              placeholder="ejemplo@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2.5 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary"
            />
          </div>

          <div className="k-flex k-flex-col k-gap-1.5">
            <label htmlFor="modal-invite-role" className="k-text-sm k-font-medium">
              Rol a asignar
            </label>
            <select
              id="modal-invite-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2.5 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.application ? `${role.name} (${role.application.name})` : role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="k-flex k-items-center k-justify-end k-gap-3 k-pt-2">
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="k-rounded-lg k-px-4 k-py-2 k-text-sm k-font-medium k-text-muted-foreground hover:k-bg-muted k-transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground hover:k-opacity-90 disabled:k-opacity-50 k-transition-all"
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <MailIcon className="k-w-4 k-h-4" />
                  <span>Enviar Invitación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Dialog>

      {/* --- CONFIRM REVOKE DIALOG --- */}
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revocar invitación"
        description={revokeTarget ? `¿Revocar la invitación a ${revokeTarget.email}? El enlace de acceso dejará de funcionar de inmediato.` : ""}
        confirmLabel="Revocar Invitación"
        destructive
        onConfirm={async () => {
          if (revokeTarget) await handleRevoke(revokeTarget);
        }}
      />
    </div>
  );
}

