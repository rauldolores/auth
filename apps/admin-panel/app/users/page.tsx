"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";

interface MemberRow {
  membershipId: string;
  userId: string;
  email: string;
  status: string;
  createdAt: string;
  roles: { name: string; slug: string }[];
}

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

export default function UsersPage() {
  const { organization, hasRole, getToken } = useAuth();
  const [members, setMembers] = useState<MemberRow[] | null>(null);
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

  useEffect(() => {
    if (organization) void loadMembers(organization.id);
  }, [organization?.id]);

  async function handleRemove(membershipId: string) {
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

  if (!organization) {
    return <p className="k-text-sm k-text-muted-foreground">Selecciona una organización primero.</p>;
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Usuarios</h1>
        <p className="k-text-sm k-text-muted-foreground">
          Miembros de {organization.name}. Para invitar a alguien nuevo usa "Invitaciones"; los roles de cada
          persona se administran desde "Roles".
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
              {canManage && <th className="k-px-5 k-py-3 k-font-semibold" />}
            </tr>
          </thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.membershipId} className="k-border-b k-border-border last:k-border-0">
                <td className="k-px-5 k-py-3 k-font-medium">{m.email}</td>
                <td className="k-px-5 k-py-3">
                  <div className="k-flex k-flex-wrap k-gap-1">
                    {m.roles.length === 0 && <span className="k-text-muted-foreground">—</span>}
                    {m.roles.map((role) => (
                      <Badge key={role.slug} variant="neutral">
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="k-px-5 k-py-3">
                  <Badge variant={m.status === "active" ? "success" : "neutral"}>{m.status}</Badge>
                </td>
                <td className="k-px-5 k-py-3 k-text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</td>
                {canManage && (
                  <td className="k-px-5 k-py-3 k-text-right">
                    <button
                      type="button"
                      disabled={pendingId === m.membershipId}
                      onClick={() => void handleRemove(m.membershipId)}
                      className="k-text-sm k-text-destructive hover:k-underline disabled:k-opacity-60"
                    >
                      Quitar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {members?.length === 0 && <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin usuarios todavía.</p>}
      </Card>
    </div>
  );
}
