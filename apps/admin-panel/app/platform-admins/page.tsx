"use client";

import { useAuth } from "@kontrolia/react";
import { Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";

interface PlatformAdminRow {
  userId: string;
  email: string;
  grantedAt: string;
}

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

export default function PlatformAdminsPage() {
  const { isPlatformAdmin, getToken } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [admins, setAdmins] = useState<PlatformAdminRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function loadAdmins() {
    const token = await getToken();
    const response = await fetch(`${AUTH_SERVER_URL}/api/platform-admins`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = (await response.json()) as { admins: PlatformAdminRow[] };
    setAdmins(data.admins);
  }

  useEffect(() => {
    void (async () => {
      const isAdmin = await isPlatformAdmin();
      setAllowed(isAdmin);
      if (isAdmin) await loadAdmins();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/platform-admins`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo agregar.");
      setEmail("");
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(admin: PlatformAdminRow) {
    if (!window.confirm(`¿Quitar el rol de platform admin a ${admin.email}?`)) return;
    setError(null);
    setRevokingId(admin.userId);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/platform-admins?userId=${admin.userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "No se pudo quitar.");
      }
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar.");
    } finally {
      setRevokingId(null);
    }
  }

  if (allowed === null) return <p className="k-text-sm k-text-muted-foreground">Cargando...</p>;

  if (!allowed) {
    return (
      <p className="k-text-sm k-text-muted-foreground">
        Esta pantalla es solo para platform admins — otorgar este rol afecta a toda la instalación.
      </p>
    );
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Platform admins</h1>
        <p className="k-mt-1 k-text-sm k-text-muted-foreground">
          Quien tiene este rol puede ver y administrar cosas de toda la instalación, no solo una organización —
          incluida esta misma pantalla y "Clientes OAuth". El primer usuario que se registró en esta instalación
          lo obtuvo automáticamente; agrega o quita a alguien más aquí, sin tocar la base de datos.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="k-flex k-max-w-md k-items-end k-gap-3">
          <div className="k-flex k-flex-1 k-flex-col k-gap-1.5">
            <label htmlFor="k-admin-email" className="k-text-sm k-font-medium">
              Correo de un usuario ya registrado
            </label>
            <input
              id="k-admin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@tuempresa.com"
              className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
          >
            Agregar
          </button>
        </form>
        {error && <p className="k-mt-2 k-text-sm k-text-destructive">{error}</p>}
      </Card>

      <Card className="k-p-0">
        <div className="k-overflow-x-auto">
        <table className="k-w-full k-text-sm">
          <thead>
            <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
              <th className="k-px-5 k-py-3 k-font-semibold">Correo</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Desde</th>
              <th className="k-px-5 k-py-3 k-font-semibold" />
            </tr>
          </thead>
          <tbody>
            {admins?.map((row) => (
              <tr key={row.userId} className="k-border-b k-border-border last:k-border-0">
                <td className="k-px-5 k-py-3 k-font-medium">{row.email}</td>
                <td className="k-px-5 k-py-3 k-text-muted-foreground">
                  {new Date(row.grantedAt).toLocaleDateString()}
                </td>
                <td className="k-px-5 k-py-3 k-text-right">
                  <button
                    type="button"
                    disabled={revokingId === row.userId}
                    onClick={() => void handleRevoke(row)}
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
      </Card>
    </div>
  );
}
