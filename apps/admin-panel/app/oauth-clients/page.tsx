"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";

interface OAuthClientRow {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  created_at: string;
}

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

export default function OAuthClientsPage() {
  const { isPlatformAdmin, getToken } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [clients, setClients] = useState<OAuthClientRow[] | null>(null);
  const [name, setName] = useState("");
  const [redirectUris, setRedirectUris] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastClientId, setLastClientId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRedirectUris, setEditRedirectUris] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadClients() {
    const token = await getToken();
    const response = await fetch(`${AUTH_SERVER_URL}/api/oauth-clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = (await response.json()) as { clients: OAuthClientRow[] };
    setClients(data.clients);
  }

  useEffect(() => {
    void (async () => {
      const isAdmin = await isPlatformAdmin();
      setAllowed(isAdmin);
      if (isAdmin) await loadClients();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLastClientId(null);
    setIsSubmitting(true);
    try {
      const token = await getToken();
      const uris = redirectUris
        .split("\n")
        .map((uri) => uri.trim())
        .filter(Boolean);
      const response = await fetch(`${AUTH_SERVER_URL}/api/oauth-clients`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: name, redirect_uris: uris }),
      });
      const data = (await response.json()) as { client_id?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo registrar el cliente.");
      setLastClientId(data.client_id ?? null);
      setName("");
      setRedirectUris("");
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el cliente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(client: OAuthClientRow) {
    setError(null);
    setEditingClientId(client.client_id);
    setEditName(client.client_name);
    setEditRedirectUris(client.redirect_uris.join("\n"));
  }

  function cancelEditing() {
    setEditingClientId(null);
    setEditName("");
    setEditRedirectUris("");
  }

  async function handleSaveEdit(clientId: string) {
    setError(null);
    setIsSaving(true);
    try {
      const token = await getToken();
      const uris = editRedirectUris
        .split("\n")
        .map((uri) => uri.trim())
        .filter(Boolean);
      const response = await fetch(`${AUTH_SERVER_URL}/api/oauth-clients?clientId=${clientId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: editName, redirect_uris: uris }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el cliente.");
      cancelEditing();
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cliente.");
    } finally {
      setIsSaving(false);
    }
  }

  if (allowed === null) return <p className="k-text-sm k-text-muted-foreground">Cargando...</p>;

  if (!allowed) {
    return (
      <p className="k-text-sm k-text-muted-foreground">
        Esta pantalla es solo para platform admins — registrar un cliente OAuth afecta a toda la instalación, no
        a una sola organización.
      </p>
    );
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Clientes OAuth</h1>
        <p className="k-mt-1 k-text-sm k-text-muted-foreground">
          Apps (propias o de terceros) que pueden usar auth-server para iniciar sesión — esto es distinto al
          catálogo de permisos en "Aplicaciones". Ver la guía{" "}
          <a href="/docs/guides/connect-your-app" className="k-underline">
            Conectar tu aplicación
          </a>{" "}
          para cómo se implementa del lado de esa app.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="k-flex k-max-w-lg k-flex-col k-gap-3">
          <div className="k-flex k-flex-col k-gap-1.5">
            <label htmlFor="k-oauth-client-name" className="k-text-sm k-font-medium">
              Nombre de la aplicación
            </label>
            <input
              id="k-oauth-client-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. Facturación"
              className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
            />
          </div>
          <div className="k-flex k-flex-col k-gap-1.5">
            <label htmlFor="k-oauth-redirect-uris" className="k-text-sm k-font-medium">
              Redirect URIs (una por línea)
            </label>
            <textarea
              id="k-oauth-redirect-uris"
              required
              rows={3}
              value={redirectUris}
              onChange={(e) => setRedirectUris(e.target.value)}
              placeholder="https://facturacion.tuempresa.com/oauth/callback"
              className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-font-mono k-text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !redirectUris.trim()}
            className="k-self-start k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
          >
            Registrar
          </button>
        </form>
        {error && <p className="k-mt-2 k-text-sm k-text-destructive">{error}</p>}
        {lastClientId && (
          <p className="k-mt-2 k-text-sm">
            Registrado — <code className="k-rounded k-bg-muted k-px-1.5 k-py-0.5">{lastClientId}</code>
          </p>
        )}
      </Card>

      <Card className="k-p-0">
        <table className="k-w-full k-text-sm">
          <thead>
            <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
              <th className="k-px-5 k-py-3 k-font-semibold">Nombre</th>
              <th className="k-px-5 k-py-3 k-font-semibold">client_id</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Redirect URIs</th>
              <th className="k-px-5 k-py-3 k-font-semibold" />
            </tr>
          </thead>
          <tbody>
            {clients?.map((client) =>
              editingClientId === client.client_id ? (
                <tr key={client.client_id} className="k-border-b k-border-border last:k-border-0">
                  <td className="k-px-5 k-py-3" colSpan={3}>
                    <div className="k-flex k-flex-col k-gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
                      />
                      <textarea
                        rows={3}
                        value={editRedirectUris}
                        onChange={(e) => setEditRedirectUris(e.target.value)}
                        className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-font-mono k-text-sm"
                      />
                    </div>
                  </td>
                  <td className="k-px-5 k-py-3 k-text-right k-align-top k-whitespace-nowrap">
                    <button
                      type="button"
                      disabled={isSaving || !editName.trim() || !editRedirectUris.trim()}
                      onClick={() => void handleSaveEdit(client.client_id)}
                      className="k-mr-3 k-text-sm k-font-medium k-text-primary hover:k-underline disabled:k-opacity-60"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="k-text-sm k-text-muted-foreground hover:k-underline"
                    >
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={client.client_id} className="k-border-b k-border-border last:k-border-0">
                  <td className="k-px-5 k-py-3 k-font-medium">{client.client_name}</td>
                  <td className="k-px-5 k-py-3">
                    <code className="k-text-xs k-text-muted-foreground">{client.client_id}</code>
                  </td>
                  <td className="k-px-5 k-py-3">
                    {client.redirect_uris.map((uri) => (
                      <Badge key={uri} variant="neutral" className="k-mr-1 k-mb-1">
                        {uri}
                      </Badge>
                    ))}
                  </td>
                  <td className="k-px-5 k-py-3 k-text-right">
                    <button
                      type="button"
                      onClick={() => startEditing(client)}
                      className="k-text-sm k-text-muted-foreground hover:k-underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {clients?.length === 0 && (
          <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin clientes OAuth registrados.</p>
        )}
      </Card>
    </div>
  );
}
