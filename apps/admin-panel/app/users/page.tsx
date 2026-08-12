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

export default function UsersPage() {
  const router = useRouter();
  const { organization, hasRole, isPlatformAdmin, getToken } = useAuth();
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [appGroups, setAppGroups] = useState<AppRoleGroup[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

      await loadMembers(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el acceso.");
    } finally {
      setPendingId(null);
    }
  }

  if (!organization) {
    return <p className="k-text-sm k-text-muted-foreground">Selecciona una organización primero.</p>;
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Usuarios</h1>
        <p className="k-text-sm k-text-muted-foreground">
          Miembros de {organization.name}. Para invitar a alguien nuevo usa "Invitaciones". Cada persona puede
          tener un rol distinto en cada aplicación habilitada — despliega una fila para ver o cambiar sus
          accesos.
        </p>
      </div>

      {error && <p className="k-text-sm k-text-destructive">{error}</p>}

      {platformAdmin && (
        <Card>
          <form onSubmit={handleSearch} className="k-flex k-max-w-lg k-items-end k-gap-3">
            <div className="k-flex k-flex-1 k-flex-col k-gap-1.5">
              <label htmlFor="k-users-search-email" className="k-text-sm k-font-medium">
                Buscar cualquier usuario por correo
              </label>
              <p className="k-text-xs k-text-muted-foreground">
                En toda la instalación, no solo {organization.name} — solo visible para platform admins.
              </p>
              <input
                id="k-users-search-email"
                type="email"
                required
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !searchEmail.trim()}
              className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
            >
              {searching ? "Buscando..." : "Buscar"}
            </button>
          </form>
          {searchError && <p className="k-mt-2 k-text-sm k-text-destructive">{searchError}</p>}
        </Card>
      )}

      <Card className="k-p-0">
        <div className="k-overflow-x-auto">
        <table className="k-w-full k-text-sm">
          <thead>
            <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
              <th className="k-px-5 k-py-3 k-font-semibold">Correo</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Roles</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Estado</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Desde</th>
              <th className="k-px-5 k-py-3 k-font-semibold" />
            </tr>
          </thead>
          <tbody>
            {members?.map((member) => {
              const orgWideRoles = member.roles.filter((role) => role.application_id === null);
              const appRoleByApp = new Map(
                member.roles.filter((role) => role.application_id !== null).map((role) => [role.application_id, role]),
              );
              const isExpanded = expandedId === member.membershipId;
              return (
                <Fragment key={member.membershipId}>
                  <tr className="k-border-b k-border-border last:k-border-0">
                    <td className="k-px-5 k-py-3 k-font-medium">
                      <div className="k-flex k-items-center k-gap-2">
                        {member.email}
                        {platformAdminIds.has(member.userId) && <Badge variant="primary">Platform admin</Badge>}
                      </div>
                    </td>
                    <td className="k-px-5 k-py-3">
                      <div className="k-flex k-flex-wrap k-gap-1">
                        {orgWideRoles.length === 0 && appRoleByApp.size === 0 && (
                          <span className="k-text-muted-foreground">—</span>
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
                    <td className="k-px-5 k-py-3">
                      <Badge variant={member.status === "active" ? "success" : "neutral"}>{member.status}</Badge>
                    </td>
                    <td className="k-px-5 k-py-3 k-text-muted-foreground">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </td>
                    <td className="k-px-5 k-py-3 k-text-right k-whitespace-nowrap">
                      <Link
                        href={`/users/${member.membershipId}`}
                        className="k-mr-3 k-text-sm k-text-muted-foreground hover:k-underline"
                      >
                        Ver detalle
                      </Link>
                      {appGroups.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : member.membershipId)}
                          className="k-mr-3 k-text-sm k-text-muted-foreground hover:k-underline"
                        >
                          {isExpanded ? "Ocultar accesos" : "Gestionar accesos"}
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
                          className="k-mr-3 k-text-sm k-text-muted-foreground hover:k-underline disabled:k-opacity-60"
                        >
                          {member.status === "suspended" ? "Reactivar" : "Suspender"}
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          disabled={pendingId === member.membershipId}
                          onClick={() => setConfirmAction({ kind: "remove", member })}
                          className="k-text-sm k-text-destructive hover:k-underline disabled:k-opacity-60"
                        >
                          Quitar
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="k-border-b k-border-border k-bg-muted/30 last:k-border-0">
                      <td colSpan={5} className="k-px-5 k-py-4">
                        <div className="k-flex k-flex-col k-gap-2">
                          {appGroups.map((group) => {
                            const currentRoleId = appRoleByApp.get(group.applicationId)?.id ?? "";
                            return (
                              <div key={group.applicationId} className="k-flex k-items-center k-gap-3 k-text-sm">
                                <span className="k-w-40 k-font-medium">{group.applicationName}</span>
                                <select
                                  value={currentRoleId}
                                  disabled={!canManage || pendingId === member.membershipId}
                                  onChange={(e) => void handleAppRoleChange(member, group.applicationId, e.target.value)}
                                  className="k-rounded-md k-border k-border-border k-bg-background k-px-2 k-py-1 k-text-sm disabled:k-opacity-60"
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
        {members?.length === 0 && <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin usuarios todavía.</p>}
        {hasMore && (
          <div className="k-border-t k-border-border k-p-3 k-text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void handleLoadMore()}
              className="k-text-sm k-text-muted-foreground hover:k-underline disabled:k-opacity-60"
            >
              {loadingMore ? "Cargando..." : "Cargar más"}
            </button>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        destructive
        title={confirmAction?.kind === "remove" ? "Quitar de la organización" : "Suspender miembro"}
        description={
          !confirmAction
            ? ""
            : confirmAction.kind === "remove"
              ? `¿Quitar a ${confirmAction.member.email} de ${organization.name}? Perderá acceso a la organización.`
              : `¿Suspender a ${confirmAction.member.email}? Perderá acceso a ${organization.name} hasta que lo reactives.`
        }
        confirmLabel={confirmAction?.kind === "remove" ? "Quitar" : "Suspender"}
        onConfirm={async () => {
          if (!confirmAction) return;
          if (confirmAction.kind === "remove") await handleRemoveMember(confirmAction.member);
          else await handleToggleStatus(confirmAction.member);
        }}
      />
    </div>
  );
}
