"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import Link from "next/link";
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
  const { organization, hasRole, getToken } = useAuth();
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [appGroups, setAppGroups] = useState<AppRoleGroup[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const canManage = hasRole(["owner", "admin"]);

  async function loadMembers(orgId: string) {
    const token = await getToken();
    const response = await fetch(`${AUTH_SERVER_URL}/api/organization-members?organizationId=${orgId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = (await response.json()) as { members: MemberRow[] };
    setMembers(data.members);
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

  async function handleRemoveMember(membershipId: string) {
    if (!organization) return;
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

      <Card className="k-p-0">
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
                    <td className="k-px-5 k-py-3 k-font-medium">{member.email}</td>
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
                          onClick={() => void handleToggleStatus(member)}
                          className="k-mr-3 k-text-sm k-text-muted-foreground hover:k-underline disabled:k-opacity-60"
                        >
                          {member.status === "suspended" ? "Reactivar" : "Suspender"}
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          disabled={pendingId === member.membershipId}
                          onClick={() => void handleRemoveMember(member.membershipId)}
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
        {members?.length === 0 && <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin usuarios todavía.</p>}
      </Card>
    </div>
  );
}
