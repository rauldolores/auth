"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card, ConfirmDialog } from "@kontrolia/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Membership {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  status: string;
  roles: { name: string; slug: string }[];
}

type ConfirmAction = { kind: "revoke-platform-admin" } | { kind: "remove-membership"; membership: Membership };

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

/**
 * Landing page for the platform-admin "buscar cualquier usuario" search on
 * /users, when the found person has no membership in the currently active
 * organization — /users/[membershipId] is keyed by a membership id *in that
 * org*, so there's nothing there to link to. This route is keyed by the
 * user's id instead and shows only what's actually reachable across every
 * organization: platform-admin status and the raw list of memberships (no
 * suspend/reactivate here — that goes through a per-org RLS-scoped route
 * this caller may not have a membership to satisfy; only remove, which runs
 * as service_role and is genuinely cross-org).
 */
export default function UserByIdPage() {
  const { userId } = useParams<{ userId: string }>();
  const { isPlatformAdmin, getToken } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [targetIsPlatformAdmin, setTargetIsPlatformAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  async function loadAll() {
    const token = await getToken();
    const [membershipsResponse, statusResponse] = await Promise.all([
      fetch(`${AUTH_SERVER_URL}/api/platform-admins/user-memberships?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${AUTH_SERVER_URL}/api/platform-admins?userId=${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (membershipsResponse.ok) {
      const data = (await membershipsResponse.json()) as { user: { email: string }; memberships: Membership[] };
      setEmail(data.user.email);
      setMemberships(data.memberships);
    } else {
      const data = (await membershipsResponse.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudo cargar este usuario.");
    }
    if (statusResponse.ok) {
      const data = (await statusResponse.json()) as { isPlatformAdmin: boolean };
      setTargetIsPlatformAdmin(data.isPlatformAdmin);
    }
  }

  useEffect(() => {
    void (async () => {
      const isAdmin = await isPlatformAdmin();
      setAllowed(isAdmin);
      if (isAdmin) await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleTogglePlatformAdmin() {
    if (!email) return;
    setError(null);
    setPending(true);
    try {
      const token = await getToken();
      const response = targetIsPlatformAdmin
        ? await fetch(`${AUTH_SERVER_URL}/api/platform-admins?userId=${userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        : await fetch(`${AUTH_SERVER_URL}/api/platform-admins`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo actualizar el estado de platform admin.");
      }
      setTargetIsPlatformAdmin((current) => !current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el estado de platform admin.");
    } finally {
      setPending(false);
    }
  }

  async function handleRemoveMembership(membership: Membership) {
    setError(null);
    setPending(true);
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
      setMemberships((current) => (current ?? []).filter((m) => m.membershipId !== membership.membershipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar al usuario de esa organización.");
    } finally {
      setPending(false);
    }
  }

  if (allowed === null) return <p className="k-text-sm k-text-muted-foreground">Cargando...</p>;

  if (!allowed) {
    return <p className="k-text-sm k-text-muted-foreground">Esta pantalla es solo para platform admins.</p>;
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <Link href="/users" className="k-text-sm k-text-muted-foreground hover:k-underline">
          ← Usuarios
        </Link>
        <h1 className="k-mt-2 k-text-2xl k-font-bold">{email ?? "Cargando..."}</h1>
        <p className="k-text-sm k-text-muted-foreground">
          No pertenece a la organización activa — esta es su vista de acceso en toda la instalación.
        </p>
      </div>

      {error && <p className="k-text-sm k-text-destructive">{error}</p>}

      <Card className="k-flex k-flex-col k-gap-3 k-p-5">
        <div className="k-flex k-items-center k-justify-between">
          <div className="k-flex k-items-center k-gap-3">
            <span className="k-text-sm k-font-medium">Platform admin</span>
            {targetIsPlatformAdmin === null ? (
              <span className="k-text-sm k-text-muted-foreground">Cargando…</span>
            ) : (
              <Badge variant={targetIsPlatformAdmin ? "primary" : "neutral"}>{targetIsPlatformAdmin ? "Sí" : "No"}</Badge>
            )}
          </div>
          {targetIsPlatformAdmin !== null && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                targetIsPlatformAdmin ? setConfirmAction({ kind: "revoke-platform-admin" }) : void handleTogglePlatformAdmin()
              }
              className="k-rounded-md k-border k-border-border k-px-3 k-py-1.5 k-text-sm hover:k-bg-muted disabled:k-opacity-60"
            >
              {targetIsPlatformAdmin ? "Quitar" : "Otorgar"}
            </button>
          )}
        </div>
      </Card>

      <Card className="k-flex k-flex-col k-gap-3 k-p-5">
        <span className="k-text-sm k-font-medium">Organizaciones</span>
        {memberships === null ? (
          <p className="k-text-sm k-text-muted-foreground">Cargando…</p>
        ) : memberships.length === 0 ? (
          <p className="k-text-sm k-text-muted-foreground">No pertenece a ninguna organización.</p>
        ) : (
          <div className="k-flex k-flex-col k-gap-2">
            {memberships.map((m) => (
              <div key={m.membershipId} className="k-flex k-items-center k-justify-between k-gap-3 k-text-sm">
                <div className="k-flex k-items-center k-gap-2">
                  <span className="k-font-medium">{m.organizationName}</span>
                  {m.roles.map((role) => (
                    <Badge key={role.slug} variant="neutral">
                      {role.name}
                    </Badge>
                  ))}
                  <Badge variant={m.status === "active" ? "success" : "neutral"}>{m.status}</Badge>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmAction({ kind: "remove-membership", membership: m })}
                  className="k-text-sm k-text-destructive hover:k-underline disabled:k-opacity-60"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        destructive
        title={confirmAction?.kind === "revoke-platform-admin" ? "Quitar platform admin" : "Quitar de la organización"}
        description={
          !confirmAction
            ? ""
            : confirmAction.kind === "revoke-platform-admin"
              ? `¿Quitarle el rol de platform admin a ${email}? Perderá acceso a las pantallas administrativas de toda la instalación.`
              : `¿Quitar a ${email} de "${confirmAction.membership.organizationName}"? Perderá acceso a esa organización.`
        }
        confirmLabel="Quitar"
        onConfirm={async () => {
          if (!confirmAction) return;
          if (confirmAction.kind === "revoke-platform-admin") await handleTogglePlatformAdmin();
          else await handleRemoveMembership(confirmAction.membership);
        }}
      />
    </div>
  );
}
