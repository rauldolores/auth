"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
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

function invitationLink(token: string): string {
  return `${AUTH_SERVER_URL}/invitations/accept?token=${token}`;
}

export default function InvitationsPage() {
  const { organization } = useAuth();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadData(orgId: string) {
    const supabase = createKontroliaSchemaClient();

    const { data: roleRows } = await supabase
      .from("roles")
      .select("id, name, application:applications(name)")
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .order("name")
      .returns<RoleOption[]>();
    setRoles(roleRows ?? []);
    if (roleRows?.length && !roleId) setRoleId(roleRows[0]!.id);

    const { data: invitationRows } = await supabase
      .from("invitations")
      .select("id, email, token, created_at, expires_at, accepted_at, role:roles(name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .returns<InvitationRow[]>();
    setInvitations(invitationRows ?? []);
  }

  useEffect(() => {
    if (organization) void loadData(organization.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!organization) return;
    setError(null);
    setLastInviteLink(null);
    setIsSubmitting(true);
    try {
      const supabase = createKontroliaSchemaClient();
      const { data, error: insertError } = await supabase
        .from("invitations")
        .insert({ organization_id: organization.id, email, role_id: roleId || null })
        .select("token")
        .single();
      if (insertError) throw insertError;
      setEmail("");
      setLastInviteLink(invitationLink(data.token));
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
      const { error: updateError } = await supabase
        .from("invitations")
        .update({ expires_at: newExpiry })
        .eq("id", row.id);
      if (updateError) throw updateError;
      setLastInviteLink(invitationLink(row.token));
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
    return <p className="k-text-sm k-text-muted-foreground">Selecciona una organización primero.</p>;
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Invitaciones</h1>
        <p className="k-text-sm k-text-muted-foreground">Invita nuevos miembros a {organization.name}.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="k-flex k-max-w-lg k-items-end k-gap-3">
          <div className="k-flex k-flex-1 k-flex-col k-gap-1.5">
            <label htmlFor="k-invite-email" className="k-text-sm k-font-medium">
              Correo
            </label>
            <input
              id="k-invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
            />
          </div>
          <div className="k-flex k-flex-col k-gap-1.5">
            <label htmlFor="k-invite-role" className="k-text-sm k-font-medium">
              Rol
            </label>
            <select
              id="k-invite-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.application ? `${role.name} (${role.application.name})` : role.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
          >
            Invitar
          </button>
        </form>
        {error && <p className="k-mt-2 k-text-sm k-text-destructive">{error}</p>}
      </Card>

      {lastInviteLink && (
        <Card className="k-flex k-items-center k-justify-between k-gap-3 k-border-primary/40 k-bg-primary/5 k-p-4">
          <div className="k-min-w-0">
            <p className="k-text-sm k-font-medium">Comparte este enlace con la persona invitada</p>
            <p className="k-truncate k-text-sm k-text-muted-foreground">{lastInviteLink}</p>
          </div>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(lastInviteLink)}
            className="k-shrink-0 k-rounded-md k-border k-border-border k-px-3 k-py-1.5 k-text-sm hover:k-bg-muted"
          >
            Copiar
          </button>
        </Card>
      )}

      <Card className="k-p-0">
        <table className="k-w-full k-text-sm">
          <thead>
            <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
              <th className="k-px-5 k-py-3 k-font-semibold">Correo</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Rol</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Estado</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Enviada</th>
              <th className="k-px-5 k-py-3 k-font-semibold" />
            </tr>
          </thead>
          <tbody>
            {invitations.map((row) => {
              const status = invitationStatus(row);
              const isPending = status.label === "Pendiente";
              const isExpired = status.label === "Expirada";
              return (
                <tr key={row.id} className="k-border-b k-border-border last:k-border-0">
                  <td className="k-px-5 k-py-3">{row.email}</td>
                  <td className="k-px-5 k-py-3 k-text-muted-foreground">{row.role?.name ?? "—"}</td>
                  <td className="k-px-5 k-py-3">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </td>
                  <td className="k-px-5 k-py-3 k-text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="k-px-5 k-py-3 k-text-right k-whitespace-nowrap">
                    {(isPending || isExpired) && (
                      <button
                        type="button"
                        onClick={() => void handleCopyLink(row)}
                        className="k-mr-3 k-text-sm k-text-muted-foreground hover:k-underline"
                      >
                        {copiedId === row.id ? "¡Copiado!" : "Copiar enlace"}
                      </button>
                    )}
                    {isExpired && (
                      <button
                        type="button"
                        disabled={pendingId === row.id}
                        onClick={() => void handleResend(row)}
                        className="k-mr-3 k-text-sm k-text-muted-foreground hover:k-underline disabled:k-opacity-60"
                      >
                        Reenviar
                      </button>
                    )}
                    {(isPending || isExpired) && (
                      <button
                        type="button"
                        disabled={pendingId === row.id}
                        onClick={() => void handleRevoke(row)}
                        className="k-text-sm k-text-destructive hover:k-underline disabled:k-opacity-60"
                      >
                        Revocar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {invitations.length === 0 && <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin invitaciones todavía.</p>}
      </Card>
    </div>
  );
}
