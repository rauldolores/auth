"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card, ConfirmDialog } from "@kontrolia/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface RoleInfo {
  id: string;
  name: string;
  slug: string;
  application_id: string | null;
  application: { name: string } | null;
}

interface MemberRow {
  membershipId: string;
  userId: string;
  email: string;
  status: string;
  createdAt: string;
  roles: RoleInfo[];
}

interface AppRoleGroup {
  applicationId: string;
  applicationName: string;
  roles: { id: string; name: string }[];
}

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

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
function UsersGroupIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function UserCheckIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function UserMinusIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
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

function MailIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

function ShieldIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function ChevronDownIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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

function CheckIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

export default function UsersPage() {
  const router = useRouter();
  const { organization, hasRole, isPlatformAdmin, getToken } = useAuth();
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [appGroups, setAppGroups] = useState<AppRoleGroup[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const canManage = hasRole(["owner", "admin"]);
  const [confirmAction, setConfirmAction] = useState<{ kind: "remove" | "suspend"; member: MemberRow } | null>(null);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [platformAdminIds, setPlatformAdminIds] = useState<Set<string>>(new Set());
  const [searchEmail, setSearchEmail] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // Filters & View mode state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  useEffect(() => {
    void (async () => {
      const isAdmin = await isPlatformAdmin();
      setPlatformAdmin(isAdmin);
      if (isAdmin) await loadPlatformAdminIds();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPlatformAdminIds() {
    const token = await getToken();
    const response = await fetch(`${AUTH_SERVER_URL}/api/platform-admins`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = (await response.json()) as { admins: { userId: string }[] };
    setPlatformAdminIds(new Set(data.admins.map((a) => a.userId)));
  }

  function triggerSuccessNotice(msg: string) {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 4000);
  }

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = searchEmail.trim();
    if (!trimmed) return;
    setSearchError(null);
    setSearching(true);
    try {
      const token = await getToken();
      const response = await fetch(
        `${AUTH_SERVER_URL}/api/platform-admins/user-memberships?email=${encodeURIComponent(trimmed)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await response.json().catch(() => ({}))) as {
        user?: { id: string };
        memberships?: { membershipId: string; organizationId: string }[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "No se pudo buscar el usuario.");

      const inActiveOrg = data.memberships?.find((m) => m.organizationId === organization?.id);
      if (inActiveOrg) router.push(`/users/${inActiveOrg.membershipId}`);
      else router.push(`/users/by-user/${data.user!.id}`);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "No se pudo buscar el usuario.");
    } finally {
      setSearching(false);
    }
  }

  async function loadMembers(orgId: string, offset = 0, append = false) {
    const token = await getToken();
    const response = await fetch(`${AUTH_SERVER_URL}/api/organization-members?organizationId=${orgId}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudieron cargar los usuarios.");
      return;
    }
    setError(null);
    const data = (await response.json()) as { members: MemberRow[]; hasMore: boolean };
    setMembers((current) => (append ? [...(current ?? []), ...data.members] : data.members));
    setHasMore(data.hasMore);
  }

  async function handleLoadMore() {
    if (!organization) return;
    setLoadingMore(true);
    await loadMembers(organization.id, (members ?? []).length, true);
    setLoadingMore(false);
  }

  async function loadAppRoles(orgId: string) {
    const supabase = createKontroliaSchemaClient();
    const { data } = await supabase
      .from("roles")
      .select("id, name, application_id, application:applications(name)")
      .eq("organization_id", orgId)
      .not("application_id", "is", null)
      .returns<{ id: string; name: string; application_id: string; application: { name: string } | null }[]>();

    const byApplication = new Map<string, AppRoleGroup>();
    for (const role of data ?? []) {
      const group = byApplication.get(role.application_id) ?? {
        applicationId: role.application_id,
        applicationName: role.application?.name ?? "—",
        roles: [],
      };
      group.roles.push({ id: role.id, name: role.name });
      byApplication.set(role.application_id, group);
    }
    setAppGroups([...byApplication.values()].sort((a, b) => a.applicationName.localeCompare(b.applicationName)));
  }

  useEffect(() => {
    if (organization) {
      void loadMembers(organization.id);
      void loadAppRoles(organization.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  async function handleRemoveMember(member: MemberRow) {
    if (!organization) return;
    const membershipId = member.membershipId;
    setError(null);
    setPendingId(membershipId);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/organization-members?membershipId=${membershipId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "No se pudo quitar al usuario.");
      }
      triggerSuccessNotice(`Se quitó a ${member.email} de la organización.`);
      await loadMembers(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar al usuario.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleToggleStatus(member: MemberRow) {
    if (!organization) return;
    const nextStatus = member.status === "suspended" ? "active" : "suspended";
    setError(null);
    setPendingId(member.membershipId);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/organization-members?membershipId=${member.membershipId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "No se pudo actualizar el estado del usuario.");
      }
      triggerSuccessNotice(
        nextStatus === "suspended"
          ? `Se suspendió el acceso a ${member.email}.`
          : `Se reactivó el acceso a ${member.email}.`
      );
      await loadMembers(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el estado del usuario.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleAppRoleChange(member: MemberRow, applicationId: string, newRoleId: string) {
    if (!organization) return;
    setError(null);
    setPendingId(member.membershipId);
    try {
      const supabase = createKontroliaSchemaClient();
      const currentRole = member.roles.find((role) => role.application_id === applicationId);

      if (currentRole) {
        const { error: deleteError } = await supabase
          .from("membership_roles")
          .delete()
          .eq("membership_id", member.membershipId)
          .eq("role_id", currentRole.id);
        if (deleteError) throw deleteError;
      }

      if (newRoleId) {
        const { error: insertError } = await supabase
          .from("membership_roles")
          .insert({ membership_id: member.membershipId, role_id: newRoleId });
        if (insertError) throw insertError;
      }

      triggerSuccessNotice(`Rol actualizado para ${member.email}.`);
      await loadMembers(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el acceso.");
    } finally {
      setPendingId(null);
    }
  }

  if (!organization) {
    return (
      <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center k-my-8">
        <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-primary/10 k-flex k-items-center k-justify-center k-text-primary k-mb-4">
          <UsersGroupIcon className="k-w-8 k-h-8" />
        </div>
        <h3 className="k-text-lg k-font-semibold">Selecciona una Organización</h3>
        <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
          Para ver y administrar los miembros y sus accesos a aplicaciones, selecciona una organización activa.
        </p>
      </Card>
    );
  }

  // Filter members list
  const filteredMembers = (members ?? []).filter((member) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      member.email.toLowerCase().includes(query) ||
      member.roles.some((r) => r.name.toLowerCase().includes(query) || r.application?.name.toLowerCase().includes(query));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && member.status === "active") ||
      (statusFilter === "suspended" && member.status === "suspended");

    return matchesQuery && matchesStatus;
  });

  const totalMembersCount = members?.length ?? 0;
  const activeMembersCount = members?.filter((m) => m.status === "active").length ?? 0;
  const suspendedMembersCount = members?.filter((m) => m.status === "suspended").length ?? 0;

  return (
    <div className="k-flex k-flex-col k-gap-6 k-pb-12">
      {/* --- HERO BANNER --- */}
      <div className="k-relative k-overflow-hidden k-rounded-2xl k-bg-[linear-gradient(135deg,#1b1030,#2b1a52_45%,#4c2a8c)] k-p-6 sm:k-p-8 k-shadow-md k-text-white">
        <div className="k-relative k-z-10 k-flex k-flex-col md:k-flex-row md:k-items-center md:k-justify-between k-gap-4">
          <div>
            <span className="k-inline-flex k-items-center k-gap-2 k-rounded-full k-bg-white/10 k-px-3.5 k-py-1 k-text-xs k-font-semibold k-text-white/80 k-backdrop-blur-sm">
              <UsersGroupIcon className="k-w-3.5 k-h-3.5" />
              <span>Gestión de Miembros</span>
            </span>
            <h1 className="k-mt-3 k-text-3xl sm:k-text-4xl k-font-extrabold k-tracking-tight k-text-white">
              Usuarios
            </h1>
            <p className="k-mt-1.5 k-text-sm sm:k-text-base k-text-white/70 k-max-w-2xl">
              Miembros de <strong className="k-text-white k-font-semibold">{organization.name}</strong> y sus roles asignados en aplicaciones.
            </p>
          </div>

          <div className="k-shrink-0">
            <Link
              href="/invitations"
              className="k-inline-flex k-items-center k-gap-2 k-rounded-xl k-bg-white k-px-4 k-py-2.5 k-text-sm k-font-semibold k-text-slate-900 k-shadow-lg hover:k-bg-slate-100 k-transition-all active:k-scale-[0.98]"
            >
              <PlusIcon />
              <span>Invitar Usuario</span>
            </Link>
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

      {/* --- PLATFORM ADMIN GLOBAL USER SEARCH --- */}
      {platformAdmin && (
        <Card className="k-p-5 k-border-primary/20 k-bg-primary/5">
          <form onSubmit={handleSearch} className="k-flex k-flex-col sm:k-flex-row sm:k-items-end k-gap-3">
            <div className="k-flex-1 k-flex k-flex-col k-gap-1.5">
              <div className="k-flex k-items-center k-gap-2">
                <CrownIcon className="k-w-4 k-h-4 k-text-primary" />
                <label htmlFor="k-users-search-email" className="k-text-sm k-font-semibold k-text-foreground">
                  Búsqueda Global de Usuario (Platform Admin)
                </label>
              </div>
              <p className="k-text-xs k-text-muted-foreground">
                Busca cualquier usuario registrado en el sistema por correo electrónico, independientemente de su organización.
              </p>
              <input
                id="k-users-search-email"
                type="email"
                required
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="ej. usuario@empresa.com"
                className="k-w-full k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !searchEmail.trim()}
              className="k-inline-flex k-items-center k-justify-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground hover:k-opacity-90 disabled:k-opacity-50 k-transition-all"
            >
              {searching ? (
                <>
                  <SpinnerIcon />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <SearchIcon />
                  <span>Buscar Global</span>
                </>
              )}
            </button>
          </form>
          {searchError && (
            <p className="k-mt-2 k-text-xs k-text-destructive k-font-medium">{searchError}</p>
          )}
        </Card>
      )}

      {/* --- METRICS STATS BAR --- */}
      <div className="k-grid k-grid-cols-1 sm:k-grid-cols-3 k-gap-4">
        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-primary/10 k-text-primary">
            <UsersGroupIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{members === null ? "—" : totalMembersCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Total Miembros</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-emerald-500/10 k-text-emerald-600 dark:k-text-emerald-400">
            <UserCheckIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{members === null ? "—" : activeMembersCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Miembros Activos</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-amber-500/10 k-text-amber-600 dark:k-text-amber-400">
            <UserMinusIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{members === null ? "—" : suspendedMembersCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Suspendidos</p>
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
            placeholder="Buscar miembro por correo o rol..."
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
          {/* Status Tabs */}
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
              Todos ({totalMembersCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                statusFilter === "active"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Activos ({activeMembersCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("suspended")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                statusFilter === "suspended"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Suspendidos ({suspendedMembersCount})
            </button>
          </div>

          {/* Grid/Table Switcher */}
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
      {members === null ? (
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
      ) : filteredMembers.length === 0 ? (
        /* EMPTY STATE */
        <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center">
          <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-muted k-flex k-items-center k-justify-center k-text-muted-foreground k-mb-4">
            <UsersGroupIcon className="k-w-8 k-h-8" />
          </div>
          <h3 className="k-text-lg k-font-semibold">
            {searchQuery || statusFilter !== "all" ? "No se encontraron miembros" : "Sin usuarios en esta organización"}
          </h3>
          <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
            {searchQuery || statusFilter !== "all"
              ? "Prueba cambiando el término de búsqueda o restableciendo los filtros."
              : "Para sumar usuarios a este espacio de trabajo, envíales una invitación desde la sección de Invitaciones."}
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
              <Link
                href="/invitations"
                className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground hover:k-opacity-90 k-transition-all"
              >
                <MailIcon />
                <span>Ir a Invitaciones</span>
              </Link>
            )}
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 lg:k-grid-cols-3 k-gap-5">
          {filteredMembers.map((member) => {
            const orgWideRoles = member.roles.filter((role) => role.application_id === null);
            const appRoleByApp = new Map(
              member.roles.filter((role) => role.application_id !== null).map((role) => [role.application_id, role]),
            );
            const isExpanded = expandedId === member.membershipId;

            return (
              <Card
                key={member.membershipId}
                className="k-p-5 k-flex k-flex-col k-justify-between k-gap-4 hover:k-border-primary/40 hover:k-shadow-md k-transition-all k-duration-200"
              >
                {/* Header: Avatar, Email, Platform Admin & Status Badge */}
                <div className="k-flex k-items-start k-justify-between k-gap-3">
                  <div className="k-flex k-items-center k-gap-3 k-min-w-0">
                    <div
                      className={`k-w-11 k-h-11 k-rounded-xl k-flex k-items-center k-justify-center k-font-bold k-text-sm k-shrink-0 k-shadow-sm ${getAvatarGradient(
                        member.userId
                      )}`}
                    >
                      {getInitials(member.email)}
                    </div>
                    <div className="k-min-w-0">
                      <h3 className="k-font-semibold k-text-sm k-truncate" title={member.email}>
                        {member.email}
                      </h3>
                      {platformAdminIds.has(member.userId) && (
                        <div className="k-mt-1">
                          <Badge variant="primary">
                            <CrownIcon className="k-w-3 k-h-3 k-mr-1" /> Platform Admin
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <Badge variant={member.status === "active" ? "success" : "neutral"}>
                    {member.status === "active" ? "Activo" : "Suspendido"}
                  </Badge>
                </div>

                {/* Roles Tags */}
                <div className="k-flex k-flex-col k-gap-1.5 k-rounded-lg k-bg-muted/40 k-p-3 k-text-xs">
                  <span className="k-text-muted-foreground k-font-medium">Roles asignados:</span>
                  <div className="k-flex k-flex-wrap k-gap-1">
                    {orgWideRoles.length === 0 && appRoleByApp.size === 0 && (
                      <span className="k-text-muted-foreground">Sin roles asignados</span>
                    )}
                    {orgWideRoles.map((role) => (
                      <Badge key={role.id} variant="neutral">
                        <ShieldIcon className="k-mr-1" />
                        {role.name}
                      </Badge>
                    ))}
                    {[...appRoleByApp.entries()].map(([applicationId, role]) => (
                      <Badge key={applicationId} variant="primary">
                        {role.application?.name}: {role.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Date & Quick Details Link */}
                <div className="k-flex k-items-center k-justify-between k-text-xs k-text-muted-foreground k-pt-2 k-border-t k-border-border/60">
                  <div className="k-flex k-items-center k-gap-1.5">
                    <CalendarIcon />
                    <span>{new Date(member.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>

                  <Link
                    href={`/users/${member.membershipId}`}
                    className="k-inline-flex k-items-center k-gap-1 k-font-medium k-text-primary hover:k-underline"
                  >
                    <span>Ver detalle</span>
                    <ExternalLinkIcon />
                  </Link>
                </div>

                {/* Access Drawer Toggle & Actions */}
                <div className="k-flex k-flex-col k-gap-2 k-pt-2 k-border-t k-border-border/60">
                  {appGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : member.membershipId)}
                      className="k-w-full k-inline-flex k-items-center k-justify-between k-px-3 k-py-1.5 k-rounded-lg k-bg-muted/60 k-text-xs k-font-medium k-text-foreground hover:k-bg-muted k-transition-all"
                    >
                      <span>Gestionar accesos a apps</span>
                      {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>
                  )}

                  {/* Expanded App Role Selectors */}
                  {isExpanded && (
                    <div className="k-flex k-flex-col k-gap-2.5 k-p-3 k-rounded-lg k-bg-muted/80 k-text-xs">
                      <p className="k-font-semibold k-text-foreground">Rol por aplicación:</p>
                      {appGroups.map((group) => {
                        const currentRoleId = appRoleByApp.get(group.applicationId)?.id ?? "";
                        return (
                          <div key={group.applicationId} className="k-flex k-items-center k-justify-between k-gap-2">
                            <span className="k-font-medium k-text-muted-foreground k-truncate">{group.applicationName}</span>
                            <select
                              value={currentRoleId}
                              disabled={!canManage || pendingId === member.membershipId}
                              onChange={(e) => void handleAppRoleChange(member, group.applicationId, e.target.value)}
                              className="k-rounded-md k-border k-border-border k-bg-background k-px-2 k-py-1 k-text-xs focus:k-outline-none focus:k-ring-1 focus:k-ring-primary disabled:k-opacity-50"
                            >
                              <option value="">Sin acceso</option>
                              {group.roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions Bar */}
                  {canManage && (
                    <div className="k-flex k-items-center k-justify-end k-gap-2 k-pt-1">
                      <button
                        type="button"
                        disabled={pendingId === member.membershipId}
                        onClick={() =>
                          member.status === "suspended"
                            ? void handleToggleStatus(member)
                            : setConfirmAction({ kind: "suspend", member })
                        }
                        className="k-px-2.5 k-py-1 k-rounded-md k-text-xs k-font-medium k-text-muted-foreground hover:k-bg-muted k-transition-all disabled:k-opacity-50"
                      >
                        {member.status === "suspended" ? "Reactivar" : "Suspender"}
                      </button>

                      <button
                        type="button"
                        disabled={pendingId === member.membershipId}
                        onClick={() => setConfirmAction({ kind: "remove", member })}
                        className="k-px-2.5 k-py-1 k-rounded-md k-text-xs k-font-medium k-text-destructive hover:k-bg-destructive/10 k-transition-all disabled:k-opacity-50"
                      >
                        Quitar
                      </button>
                    </div>
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
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Usuario</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Roles</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Estado</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold">Desde</th>
                  <th className="k-px-5 k-py-3.5 k-font-semibold k-text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="k-divide-y k-divide-border">
                {filteredMembers.map((member) => {
                  const orgWideRoles = member.roles.filter((role) => role.application_id === null);
                  const appRoleByApp = new Map(
                    member.roles.filter((role) => role.application_id !== null).map((role) => [role.application_id, role]),
                  );
                  const isExpanded = expandedId === member.membershipId;

                  return (
                    <Fragment key={member.membershipId}>
                      <tr className="hover:k-bg-muted/30 k-transition-colors">
                        {/* Email & Avatar */}
                        <td className="k-px-5 k-py-3.5">
                          <div className="k-flex k-items-center k-gap-3">
                            <div
                              className={`k-w-9 k-h-9 k-rounded-lg k-flex k-items-center k-justify-center k-font-bold k-text-xs k-shrink-0 ${getAvatarGradient(
                                member.userId
                              )}`}
                            >
                              {getInitials(member.email)}
                            </div>
                            <div className="k-flex k-flex-col">
                              <span className="k-font-semibold k-text-foreground">{member.email}</span>
                              {platformAdminIds.has(member.userId) && (
                                <span className="k-text-[11px] k-text-primary k-font-medium">Platform Admin</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Roles */}
                        <td className="k-px-5 k-py-3.5">
                          <div className="k-flex k-flex-wrap k-gap-1">
                            {orgWideRoles.length === 0 && appRoleByApp.size === 0 && (
                              <span className="k-text-muted-foreground k-text-xs">—</span>
                            )}
                            {orgWideRoles.map((role) => (
                              <Badge key={role.id} variant="neutral">
                                {role.name}
                              </Badge>
                            ))}
                            {[...appRoleByApp.entries()].map(([applicationId, role]) => (
                              <Badge key={applicationId} variant="primary">
                                {role.application?.name}: {role.name}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="k-px-5 k-py-3.5">
                          <Badge variant={member.status === "active" ? "success" : "neutral"}>
                            {member.status === "active" ? "Activo" : "Suspendido"}
                          </Badge>
                        </td>

                        {/* Date */}
                        <td className="k-px-5 k-py-3.5 k-text-muted-foreground k-text-xs">
                          {new Date(member.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                        </td>

                        {/* Actions */}
                        <td className="k-px-5 k-py-3.5 k-text-right k-whitespace-nowrap">
                          <div className="k-inline-flex k-items-center k-gap-3">
                            <Link
                              href={`/users/${member.membershipId}`}
                              className="k-text-xs k-font-medium k-text-primary hover:k-underline"
                            >
                              Detalle
                            </Link>

                            {appGroups.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : member.membershipId)}
                                className="k-text-xs k-font-medium k-text-muted-foreground hover:k-text-foreground hover:k-underline"
                              >
                                {isExpanded ? "Ocultar" : "Accesos"}
                              </button>
                            )}

                            {canManage && (
                              <button
                                type="button"
                                disabled={pendingId === member.membershipId}
                                onClick={() =>
                                  member.status === "suspended"
                                    ? void handleToggleStatus(member)
                                    : setConfirmAction({ kind: "suspend", member })
                                }
                                className="k-text-xs k-font-medium k-text-muted-foreground hover:k-text-foreground hover:k-underline disabled:k-opacity-50"
                              >
                                {member.status === "suspended" ? "Reactivar" : "Suspender"}
                              </button>
                            )}

                            {canManage && (
                              <button
                                type="button"
                                disabled={pendingId === member.membershipId}
                                onClick={() => setConfirmAction({ kind: "remove", member })}
                                className="k-text-xs k-font-medium k-text-destructive hover:k-underline disabled:k-opacity-50"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Drawer for App Roles in Table */}
                      {isExpanded && (
                        <tr className="k-bg-muted/40">
                          <td colSpan={5} className="k-px-6 k-py-4">
                            <div className="k-flex k-flex-col k-gap-3">
                              <p className="k-text-xs k-font-semibold k-text-foreground">
                                Accesos a aplicaciones para {member.email}:
                              </p>
                              <div className="k-grid k-grid-cols-1 sm:k-grid-cols-2 md:k-grid-cols-3 k-gap-3">
                                {appGroups.map((group) => {
                                  const currentRoleId = appRoleByApp.get(group.applicationId)?.id ?? "";
                                  return (
                                    <div
                                      key={group.applicationId}
                                      className="k-flex k-flex-col k-gap-1 k-p-2.5 k-rounded-lg k-bg-background k-border k-border-border"
                                    >
                                      <span className="k-text-xs k-font-medium k-text-muted-foreground">
                                        {group.applicationName}
                                      </span>
                                      <select
                                        value={currentRoleId}
                                        disabled={!canManage || pendingId === member.membershipId}
                                        onChange={(e) => void handleAppRoleChange(member, group.applicationId, e.target.value)}
                                        className="k-rounded k-border k-border-border k-bg-background k-px-2 k-py-1 k-text-xs focus:k-outline-none focus:k-ring-1 focus:k-ring-primary disabled:k-opacity-50"
                                      >
                                        <option value="">Sin acceso</option>
                                        {group.roles.map((role) => (
                                          <option key={role.id} value={role.id}>
                                            {role.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
              <span>Cargar más usuarios</span>
            )}
          </button>
        </div>
      )}

      {/* --- CONFIRM ACTION DIALOG --- */}
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        destructive
        title={confirmAction?.kind === "remove" ? "Quitar de la organización" : "Suspender miembro"}
        description={
          !confirmAction
            ? ""
            : confirmAction.kind === "remove"
              ? `¿Quitar a ${confirmAction.member.email} de ${organization.name}? Perderá acceso a la organización y todas sus aplicaciones.`
              : `¿Suspender a ${confirmAction.member.email}? Perderá acceso a ${organization.name} de forma temporal hasta que lo reactives.`
        }
        confirmLabel={confirmAction?.kind === "remove" ? "Quitar definitivo" : "Suspender acceso"}
        onConfirm={async () => {
          if (!confirmAction) return;
          if (confirmAction.kind === "remove") await handleRemoveMember(confirmAction.member);
          else await handleToggleStatus(confirmAction.member);
        }}
      />
    </div>
  );
}

