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

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

export default function UserDetailPage() {
  const { membershipId } = useParams<{ membershipId: string }>();
  const router = useRouter();
  const { organization, hasRole, getToken } = useAuth();
  const [member, setMember] = useState<MemberRow | null | undefined>(undefined);
  const [appGroups, setAppGroups] = useState<AppRoleGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canManage = hasRole(["owner", "admin"]);
  const [confirmAction, setConfirmAction] = useState<"remove" | "suspend" | null>(null);

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

      await loadMember(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el acceso.");
    } finally {
      setPending(false);
    }
  }

  if (!organization) {
    return <p className="k-text-sm k-text-muted-foreground">Selecciona una organización primero.</p>;
  }

  if (member === undefined) {
    return <p className="k-text-sm k-text-muted-foreground">Cargando…</p>;
  }

  if (member === null) {
    return (
      <div className="k-flex k-flex-col k-gap-3">
        <p className="k-text-sm k-text-destructive">No se encontró este usuario en {organization.name}.</p>
        <Link href="/users" className="k-text-sm k-text-muted-foreground hover:k-underline">
          Volver a Usuarios
        </Link>
      </div>
    );
  }

  const orgWideRoles = member.roles.filter((role) => role.application_id === null);
  const appRoleByApp = new Map(
    member.roles.filter((role) => role.application_id !== null).map((role) => [role.application_id, role]),
  );

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <Link href="/users" className="k-text-sm k-text-muted-foreground hover:k-underline">
          ← Usuarios
        </Link>
        <h1 className="k-mt-2 k-text-2xl k-font-bold">{member.email}</h1>
        <p className="k-text-sm k-text-muted-foreground">Miembro de {organization.name}</p>
      </div>

      {error && <p className="k-text-sm k-text-destructive">{error}</p>}

      <Card className="k-flex k-flex-col k-gap-4 k-p-5">
        <div className="k-flex k-items-center k-justify-between">
          <div className="k-flex k-items-center k-gap-3">
            <span className="k-text-sm k-font-medium">Estado</span>
            <Badge variant={member.status === "active" ? "success" : "neutral"}>{member.status}</Badge>
          </div>
          {canManage && (
            <div className="k-flex k-gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => (member.status === "suspended" ? void handleToggleStatus() : setConfirmAction("suspend"))}
                className="k-rounded-md k-border k-border-border k-px-3 k-py-1.5 k-text-sm hover:k-bg-muted disabled:k-opacity-60"
              >
                {member.status === "suspended" ? "Reactivar" : "Suspender"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmAction("remove")}
                className="k-rounded-md k-border k-border-destructive k-px-3 k-py-1.5 k-text-sm k-text-destructive hover:k-bg-destructive/10 disabled:k-opacity-60"
              >
                Quitar de la organización
              </button>
            </div>
          )}
        </div>

        <div className="k-text-sm k-text-muted-foreground">
          Miembro desde {new Date(member.createdAt).toLocaleDateString()}
        </div>

        <div>
          <span className="k-text-sm k-font-medium">Roles generales</span>
          <div className="k-mt-1 k-flex k-flex-wrap k-gap-1">
            {orgWideRoles.length === 0 && <span className="k-text-sm k-text-muted-foreground">—</span>}
            {orgWideRoles.map((role) => (
              <Badge key={role.id} variant="neutral">
                {role.name}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {appGroups.length > 0 && (
        <Card className="k-flex k-flex-col k-gap-3 k-p-5">
          <span className="k-text-sm k-font-medium">Accesos por aplicación</span>
          {appGroups.map((group) => {
            const currentRoleId = appRoleByApp.get(group.applicationId)?.id ?? "";
            return (
              <div key={group.applicationId} className="k-flex k-items-center k-gap-3 k-text-sm">
                <span className="k-w-40 k-font-medium">{group.applicationName}</span>
                <select
                  value={currentRoleId}
                  disabled={!canManage || pending}
                  onChange={(e) => void handleAppRoleChange(group.applicationId, e.target.value)}
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
        </Card>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        destructive
        title={confirmAction === "remove" ? "Quitar de la organización" : "Suspender miembro"}
        description={
          confirmAction === "remove"
            ? `¿Quitar a ${member.email} de ${organization.name}? Perderá acceso a la organización.`
            : `¿Suspender a ${member.email}? Perderá acceso a ${organization.name} hasta que lo reactives.`
        }
        confirmLabel={confirmAction === "remove" ? "Quitar" : "Suspender"}
        onConfirm={async () => {
          if (confirmAction === "remove") await handleRemove();
          else if (confirmAction === "suspend") await handleToggleStatus();
        }}
      />
    </div>
  );
}
