"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";

interface MembershipRow {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  status: string;
  createdAt: string;
  roles: { name: string; slug: string }[];
}

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

/**
 * Cross-organization view of a single user's access, for platform admins.
 * `/users` only ever shows members of the currently active organization —
 * there was previously no way to see (let alone remove) every organization
 * a given user belongs to across the whole installation, which matters
 * because organization creation is self-service (anyone can create one and
 * become its Owner).
 */
export default function UserAccessPage() {
  const { isPlatformAdmin, getToken } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [searchedEmail, setSearchedEmail] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => setAllowed(await isPlatformAdmin()))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    setMemberships(null);
    setIsSearching(true);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/platform-admins/user-memberships?email=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => ({}))) as { memberships?: MembershipRow[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo buscar el usuario.");
      setMemberships(data.memberships ?? []);
      setSearchedEmail(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar el usuario.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleRemove(membership: MembershipRow) {
    if (
      !window.confirm(
        `¿Quitar a ${searchedEmail} de "${membership.organizationName}"? Perderá acceso a esa organización y a todas sus aplicaciones.`,
      )
    ) {
      return;
    }
    setError(null);
    setPendingId(membership.membershipId);
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
      setPendingId(null);
    }
  }

  if (allowed === null) return <p className="k-text-sm k-text-muted-foreground">Cargando...</p>;

  if (!allowed) {
    return (
      <p className="k-text-sm k-text-muted-foreground">
        Esta pantalla es solo para platform admins — ver y quitar el acceso de un usuario a cualquier organización de
        la instalación, no solo la activa.
      </p>
    );
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Acceso de usuarios</h1>
        <p className="k-mt-1 k-text-sm k-text-muted-foreground">
          Busca a un usuario por correo para ver a qué organizaciones pertenece en toda la instalación — como crear
          una organización es de autoservicio, un usuario puede terminar en más de las que debería. Quítalo de
          cualquiera desde aquí.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="k-flex k-max-w-lg k-items-end k-gap-3">
          <div className="k-flex k-flex-1 k-flex-col k-gap-1.5">
            <label htmlFor="k-user-access-email" className="k-text-sm k-font-medium">
              Correo del usuario
            </label>
            <input
              id="k-user-access-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !email.trim()}
            className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
          >
            {isSearching ? "Buscando..." : "Buscar"}
          </button>
        </form>
        {error && <p className="k-mt-2 k-text-sm k-text-destructive">{error}</p>}
      </Card>

      {memberships && (
        <div>
          <h2 className="k-mb-2 k-text-sm k-font-semibold">Organizaciones de {searchedEmail}</h2>
          <Card className="k-p-0">
            <div className="k-overflow-x-auto">
              <table className="k-w-full k-text-sm">
                <thead>
                  <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
                    <th className="k-px-5 k-py-3 k-font-semibold">Organización</th>
                    <th className="k-px-5 k-py-3 k-font-semibold">Roles</th>
                    <th className="k-px-5 k-py-3 k-font-semibold">Estado</th>
                    <th className="k-px-5 k-py-3 k-font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((m) => (
                    <tr key={m.membershipId} className="k-border-b k-border-border last:k-border-0">
                      <td className="k-px-5 k-py-3 k-font-medium">{m.organizationName}</td>
                      <td className="k-px-5 k-py-3">
                        {m.roles.length > 0 ? (
                          m.roles.map((role) => (
                            <Badge key={role.slug} variant="neutral" className="k-mr-1 k-mb-1">
                              {role.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="k-text-sm k-text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="k-px-5 k-py-3">
                        <Badge variant={m.status === "active" ? "success" : "neutral"}>{m.status}</Badge>
                      </td>
                      <td className="k-px-5 k-py-3 k-text-right">
                        <button
                          type="button"
                          disabled={pendingId === m.membershipId}
                          onClick={() => void handleRemove(m)}
                          className="k-text-sm k-text-destructive hover:k-underline disabled:k-opacity-60"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {memberships.length === 0 && (
              <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">
                {searchedEmail} no pertenece a ninguna organización.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
