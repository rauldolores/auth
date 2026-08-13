"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card, ConfirmDialog } from "@kontrolia/ui";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

interface OtherMembership {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  status: string;
  roles: { name: string; slug: string }[];
}

type ConfirmAction =
  | { kind: "remove" | "suspend" | "revoke-platform-admin" }
  | { kind: "remove-other-membership"; membership: OtherMembership };

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
function ArrowLeftIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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

function CrownIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 16l-1-8 4 2 4-4 4 2 4-2-1 8H5zm0 0v2a1 1 0 001 1h12a1 1 0 001-1v-2H5z" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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

function AppIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function BuildingIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-6 0h6M9 7h1m-1 4h1m4-4h1m-1 4h1" />
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

function XIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

export default function UserDetailPage() {
  const { membershipId } = useParams<{ membershipId: string }>();
  const router = useRouter();
  const { organization, hasRole, isPlatformAdmin, getToken } = useAuth();
  const [member, setMember] = useState<MemberRow | null | undefined>(undefined);
  const [appGroups, setAppGroups] = useState<AppRoleGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canManage = hasRole(["owner", "admin"]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [viewerIsPlatformAdmin, setViewerIsPlatformAdmin] = useState(false);
  const [targetIsPlatformAdmin, setTargetIsPlatformAdmin] = useState<boolean | null>(null);
  const [otherMemberships, setOtherMemberships] = useState<OtherMembership[] | null>(null);
  const [platformAdminPending, setPlatformAdminPending] = useState(false);
  const [platformAdminError, setPlatformAdminError] = useState<string | null>(null);

  function triggerSuccessNotice(msg: string) {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 3000);
  }

  useEffect(() => {
    void (async () => setViewerIsPlatformAdmin(await isPlatformAdmin()))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPlatformAdminInfo(userId: string) {
    const token = await getToken();
    const [statusResponse, membershipsResponse] = await Promise.all([
      fetch(`${AUTH_SERVER_URL}/api/platform-admins?userId=${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${AUTH_SERVER_URL}/api/platform-admins/user-memberships?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (statusResponse.ok) {
      const data = (await statusResponse.json()) as { isPlatformAdmin: boolean };
      setTargetIsPlatformAdmin(data.isPlatformAdmin);
    }
    if (membershipsResponse.ok) {
      const data = (await membershipsResponse.json()) as { memberships: OtherMembership[] };
      setOtherMemberships(data.memberships.filter((m) => m.organizationId !== organization?.id));
    }
  }

  async function loadMember(orgId: string) {
    const token = await getToken();
    const response = await fetch(
      `${AUTH_SERVER_URL}/api/organization-members?organizationId=${orgId}&membershipId=${membershipId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      setMember(null);
      return;
    }
    const data = (await response.json()) as { members: MemberRow[] };
    setMember(data.members[0] ?? null);
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
      void loadMember(organization.id);
      void loadAppRoles(organization.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, membershipId]);

  useEffect(() => {
    if (viewerIsPlatformAdmin && member) void loadPlatformAdminInfo(member.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerIsPlatformAdmin, member?.userId]);

  async function handleTogglePlatformAdmin() {
    if (!member) return;
    setPlatformAdminError(null);
    setPlatformAdminPending(true);
    try {
      const token = await getToken();
      const response = targetIsPlatformAdmin
        ? await fetch(`${AUTH_SERVER_URL}/api/platform-admins?userId=${member.userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        : await fetch(`${AUTH_SERVER_URL}/api/platform-admins`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email: member.email }),
          });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo actualizar el estado de platform admin.");
      }
      setTargetIsPlatformAdmin((current) => !current);
      triggerSuccessNotice(
        targetIsPlatformAdmin
          ? "Rol de Platform Admin removido."
          : "Rol de Platform Admin concedido."
      );
    } catch (err) {
      setPlatformAdminError(err instanceof Error ? err.message : "No se pudo actualizar el estado de platform admin.");
    } finally {
      setPlatformAdminPending(false);
    }
  }

  async function handleRemoveOtherMembership(membership: OtherMembership) {
    if (!member) return;
    setPlatformAdminError(null);
    setPlatformAdminPending(true);
    try {
      const token = await getToken();
      const response = await fetch(
        `${AUTH_SERVER_URL}/api/platform-admins/user-memberships?membershipId=${membership.membershipId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo quitar al usuario de esa organización.");
      }
      setOtherMemberships((current) => (current ?? []).filter((m) => m.membershipId !== membership.membershipId));
      triggerSuccessNotice(`Usuario removido de ${membership.organizationName}.`);
    } catch (err) {
      setPlatformAdminError(err instanceof Error ? err.message : "No se pudo quitar al usuario de esa organización.");
    } finally {
      setPlatformAdminPending(false);
    }
  }

  async function handleToggleStatus() {
    if (!organization || !member) return;
    const nextStatus = member.status === "suspended" ? "active" : "suspended";
    setError(null);
    setPending(true);
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
      triggerSuccessNotice(nextStatus === "suspended" ? "Usuario suspendido." : "Usuario reactivado.");
      await loadMember(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el estado del usuario.");
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    if (!organization || !member) return;
    setError(null);
    setPending(true);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/organization-members?membershipId=${member.membershipId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "No se pudo quitar al usuario.");
      }
      router.push("/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar al usuario.");
      setPending(false);
    }
  }

  async function handleAppRoleChange(applicationId: string, newRoleId: string) {
    if (!organization || !member) return;
    setError(null);
    setPending(true);
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

      triggerSuccessNotice("Rol de aplicación actualizado.");
      await loadMember(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el acceso.");
    } finally {
      setPending(false);
    }
  }

  if (!organization) {
    return (
      <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center k-my-8">
        <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-primary/10 k-flex k-items-center k-justify-center k-text-primary k-mb-4">
          <UserIcon className="k-w-8 k-h-8" />
        </div>
        <h3 className="k-text-lg k-font-semibold">Selecciona una Organización</h3>
        <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
          Selecciona una organización activa para ver el detalle de este usuario.
        </p>
      </Card>
    );
  }

  if (member === undefined) {
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

  if (member === null) {
    return (
      <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center k-my-8">
        <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-destructive/10 k-flex k-items-center k-justify-center k-text-destructive k-mb-4">
          <AlertTriangleIcon className="k-w-8 k-h-8" />
        </div>
        <h3 className="k-text-lg k-font-semibold">Usuario No Encontrado</h3>
        <p className="k-text-sm k-text-muted-foreground k-mt-1 k-mb-6 k-max-w-md">
          Este usuario no pertenece a {organization.name} o el enlace es inválido.
        </p>
        <Link
          href="/users"
          className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground hover:k-opacity-90 k-transition-all"
        >
          <ArrowLeftIcon />
          <span>Volver a Usuarios</span>
        </Link>
      </Card>
    );
  }

  function confirmActionCopy(action: ConfirmAction): { title: string; description: string } {
    switch (action.kind) {
      case "remove":
        return {
          title: "Quitar de la organización",
          description: `¿Quitar a ${member!.email} de ${organization!.name}? Perderá acceso a la organización y sus aplicaciones.`,
        };
      case "suspend":
        return {
          title: "Suspender miembro",
          description: `¿Suspender a ${member!.email}? Perderá acceso a ${organization!.name} hasta que lo reactives.`,
        };
      case "revoke-platform-admin":
        return {
          title: "Quitar platform admin",
          description: `¿Quitarle el rol de platform admin a ${member!.email}? Perderá acceso a las pantallas administrativas globales.`,
        };
      case "remove-other-membership":
        return {
          title: "Quitar de la organización",
          description: `¿Quitar a ${member!.email} de "${action.membership.organizationName}"? Perderá acceso a esa organización.`,
        };
    }
  }

  const orgWideRoles = member.roles.filter((role) => role.application_id === null);
  const appRoleByApp = new Map(
    member.roles.filter((role) => role.application_id !== null).map((role) => [role.application_id, role]),
  );

  return (
    <div className="k-flex k-flex-col k-gap-6 k-pb-12">
      {/* --- HERO BANNER & BREADCRUMB --- */}
      <div className="k-relative k-overflow-hidden k-rounded-2xl k-bg-[linear-gradient(135deg,#1b1030,#2b1a52_45%,#4c2a8c)] k-p-6 sm:k-p-8 k-shadow-md k-text-white">
        <div className="k-relative k-z-10 k-flex k-flex-col k-gap-3">
          <div>
            <Link
              href="/users"
              className="k-inline-flex k-items-center k-gap-1.5 k-text-xs k-font-medium k-text-white/70 hover:k-text-white k-transition-all k-mb-2"
            >
              <ArrowLeftIcon />
              <span>Volver a Usuarios</span>
            </Link>
          </div>

          <div className="k-flex k-flex-col md:k-flex-row md:k-items-center md:k-justify-between k-gap-4">
            <div className="k-flex k-items-center k-gap-3.5">
              <div
                className={`k-w-12 k-h-12 k-rounded-2xl k-flex k-items-center k-justify-center k-font-bold k-text-base k-shrink-0 k-shadow-sm ${getAvatarGradient(
                  member.userId
                )}`}
              >
                {getInitials(member.email)}
              </div>
              <div>
                <div className="k-flex k-items-center k-gap-2.5">
                  <h1 className="k-text-3xl k-font-bold k-tracking-tight k-text-white">{member.email}</h1>
                  <Badge variant={member.status === "active" ? "success" : "neutral"}>
                    {member.status === "active" ? "Activo" : "Suspendido"}
                  </Badge>
                </div>
                <p className="k-text-xs k-text-white/70 k-mt-0.5">
                  Miembro de <strong className="k-text-white">{organization.name}</strong>
                </p>
              </div>
            </div>

            {canManage && (
              <div className="k-flex k-items-center k-gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    member.status === "suspended" ? void handleToggleStatus() : setConfirmAction({ kind: "suspend" })
                  }
                  className="k-inline-flex k-items-center k-gap-2 k-rounded-xl k-bg-white/10 k-px-4 k-py-2 k-text-sm k-font-semibold k-text-white hover:k-bg-white/20 disabled:k-opacity-50 k-transition-all"
                >
                  {pending ? <SpinnerIcon /> : null}
                  <span>{member.status === "suspended" ? "Reactivar Acceso" : "Suspender Acceso"}</span>
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmAction({ kind: "remove" })}
                  className="k-inline-flex k-items-center k-gap-2 k-rounded-xl k-bg-rose-500/20 k-px-4 k-py-2 k-text-sm k-font-semibold k-text-rose-200 hover:k-bg-rose-500/30 disabled:k-opacity-50 k-transition-all"
                >
                  <span>Quitar de la Organización</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="k-absolute -k-right-10 -k-top-10 k-w-64 k-h-64 k-rounded-full k-bg-white/5 k-blur-2xl k-pointer-events-none" />
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

      {/* --- CARD: GENERAL MEMBER INFO --- */}
      <Card className="k-p-5 k-flex k-flex-col k-gap-4">
        <div className="k-flex k-items-center k-gap-2 k-text-sm k-font-semibold k-border-b k-border-border/60 k-pb-3">
          <UserIcon className="k-text-primary" />
          <span>Información General del Miembro</span>
        </div>

        <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 k-gap-4 k-text-sm">
          <div className="k-flex k-flex-col k-gap-1 k-rounded-lg k-bg-muted/40 k-p-3">
            <span className="k-text-xs k-text-muted-foreground k-font-medium">Correo Electrónico:</span>
            <span className="k-font-semibold k-text-foreground select-all">{member.email}</span>
          </div>

          <div className="k-flex k-flex-col k-gap-1 k-rounded-lg k-bg-muted/40 k-p-3">
            <span className="k-text-xs k-text-muted-foreground k-font-medium">Miembro Desde:</span>
            <div className="k-flex k-items-center k-gap-1.5 k-font-medium k-text-foreground">
              <CalendarIcon />
              <span>{new Date(member.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
          </div>
        </div>

        <div className="k-flex k-flex-col k-gap-2 k-pt-2">
          <span className="k-text-xs k-font-semibold k-text-muted-foreground k-uppercase k-tracking-wider">
            Roles Globales en esta Organización
          </span>
          <div className="k-flex k-flex-wrap k-gap-1.5">
            {orgWideRoles.length === 0 && (
              <span className="k-text-xs k-text-muted-foreground">Sin roles generales asignados</span>
            )}
            {orgWideRoles.map((role) => (
              <Badge key={role.id} variant="neutral">
                <ShieldCheckIcon className="k-mr-1" />
                {role.name}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* --- CARD: APPLICATION ROLES --- */}
      {appGroups.length > 0 && (
        <Card className="k-p-5 k-flex k-flex-col k-gap-4">
          <div className="k-flex k-items-center k-gap-2 k-text-sm k-font-semibold k-border-b k-border-border/60 k-pb-3">
            <AppIcon className="k-text-amber-600" />
            <span>Matriz de Accesos por Aplicación</span>
          </div>

          <div className="k-grid k-grid-cols-1 sm:k-grid-cols-2 lg:k-grid-cols-3 k-gap-3">
            {appGroups.map((group) => {
              const currentRoleId = appRoleByApp.get(group.applicationId)?.id ?? "";
              return (
                <div
                  key={group.applicationId}
                  className="k-flex k-flex-col k-gap-2 k-p-3.5 k-rounded-xl k-bg-muted/40 k-border k-border-border/60"
                >
                  <span className="k-text-xs k-font-semibold k-text-foreground">{group.applicationName}</span>
                  <select
                    value={currentRoleId}
                    disabled={!canManage || pending}
                    onChange={(e) => void handleAppRoleChange(group.applicationId, e.target.value)}
                    className="k-w-full k-rounded-lg k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-xs focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 disabled:k-opacity-50"
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
        </Card>
      )}

      {/* --- CARD: PLATFORM ADMIN CONTROLS --- */}
      {viewerIsPlatformAdmin && (
        <Card className="k-p-5 k-flex k-flex-col k-gap-4 k-border-primary/30 k-bg-primary/5">
          <div className="k-border-b k-border-primary/20 k-pb-3">
            <div className="k-flex k-items-center k-gap-2 k-text-sm k-font-bold k-text-primary">
              <CrownIcon />
              <span>Controles Globales de Plataforma (Platform Admin)</span>
            </div>
            <p className="k-text-xs k-text-muted-foreground k-mt-0.5">
              Acceso global a través de toda la instalación de KontrolIA Auth.
            </p>
          </div>

          {platformAdminError && (
            <p className="k-text-xs k-text-destructive k-bg-destructive/10 k-p-2.5 k-rounded-lg">{platformAdminError}</p>
          )}

          <div className="k-flex k-items-center k-justify-between k-bg-background/80 k-p-3.5 k-rounded-xl k-border k-border-border">
            <div className="k-flex k-items-center k-gap-3">
              <span className="k-text-xs k-font-semibold">Privilegios de Platform Admin:</span>
              {targetIsPlatformAdmin === null ? (
                <span className="k-text-xs k-text-muted-foreground">Cargando…</span>
              ) : (
                <Badge variant={targetIsPlatformAdmin ? "primary" : "neutral"}>
                  {targetIsPlatformAdmin ? "Concedido" : "No concedido"}
                </Badge>
              )}
            </div>

            {targetIsPlatformAdmin !== null && (
              <button
                type="button"
                disabled={platformAdminPending}
                onClick={() =>
                  targetIsPlatformAdmin
                    ? setConfirmAction({ kind: "revoke-platform-admin" })
                    : void handleTogglePlatformAdmin()
                }
                className="k-inline-flex k-items-center k-gap-1.5 k-rounded-lg k-border k-border-border k-bg-background k-px-3 k-py-1.5 k-text-xs k-font-medium hover:k-bg-muted disabled:k-opacity-50 k-transition-all"
              >
                {platformAdminPending ? <SpinnerIcon /> : null}
                <span>{targetIsPlatformAdmin ? "Quitar Privilegios" : "Otorgar Privilegios"}</span>
              </button>
            )}
          </div>

          <div className="k-flex k-flex-col k-gap-2.5">
            <span className="k-text-xs k-font-semibold k-text-foreground">
              Membresías en Otras Organizaciones del Sistema:
            </span>

            {otherMemberships === null ? (
              <p className="k-text-xs k-text-muted-foreground">Cargando memberships…</p>
            ) : otherMemberships.length === 0 ? (
              <p className="k-text-xs k-text-muted-foreground">Este usuario no pertenece a ninguna otra organización.</p>
            ) : (
              <div className="k-flex k-flex-col k-gap-2">
                {otherMemberships.map((m) => (
                  <div
                    key={m.membershipId}
                    className="k-flex k-items-center k-justify-between k-gap-3 k-p-3 k-rounded-xl k-bg-background/80 k-border k-border-border k-text-xs"
                  >
                    <div className="k-flex k-items-center k-gap-2.5 k-min-w-0">
                      <BuildingIcon className="k-text-muted-foreground k-shrink-0" />
                      <span className="k-font-semibold k-truncate">{m.organizationName}</span>
                      {m.roles.map((role) => (
                        <Badge key={role.slug} variant="neutral">
                          {role.name}
                        </Badge>
                      ))}
                      <Badge variant={m.status === "active" ? "success" : "neutral"}>{m.status}</Badge>
                    </div>

                    <button
                      type="button"
                      disabled={platformAdminPending}
                      onClick={() => setConfirmAction({ kind: "remove-other-membership", membership: m })}
                      className="k-text-xs k-font-medium k-text-destructive hover:k-underline disabled:k-opacity-50 k-shrink-0"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* --- CONFIRM DIALOG --- */}
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        destructive
        title={confirmAction ? confirmActionCopy(confirmAction).title : ""}
        description={confirmAction ? confirmActionCopy(confirmAction).description : ""}
        confirmLabel={confirmAction?.kind === "suspend" ? "Suspender" : "Quitar"}
        onConfirm={async () => {
          if (!confirmAction) return;
          switch (confirmAction.kind) {
            case "remove":
              await handleRemove();
              break;
            case "suspend":
              await handleToggleStatus();
              break;
            case "revoke-platform-admin":
              await handleTogglePlatformAdmin();
              break;
            case "remove-other-membership":
              await handleRemoveOtherMembership(confirmAction.membership);
              break;
          }
        }}
      />
    </div>
  );
}

