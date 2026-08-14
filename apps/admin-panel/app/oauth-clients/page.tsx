"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card, ConfirmDialog, Dialog, ForbiddenScreen } from "@kontrolia/ui";
import { useEffect, useRef, useState } from "react";

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

interface OAuthClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}

interface ApplicationRow {
  id: string;
  name: string;
  oauth_client_id: string | null;
}

function KeyIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function CopyIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

function CopyableId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="k-flex k-items-center k-gap-2 k-rounded-lg k-border k-border-border k-bg-background k-px-3 k-py-2">
      <code className="k-min-w-0 k-flex-1 k-truncate k-font-mono k-text-xs select-all">{value}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="k-inline-flex k-shrink-0 k-items-center k-gap-1.5 k-rounded-md k-border k-border-border k-bg-card k-px-2.5 k-py-1 k-text-xs k-font-medium hover:k-bg-muted k-transition-all"
      >
        {copied ? (
          <>
            <CheckIcon className="k-h-3 k-w-3" />
            <span>Copiado</span>
          </>
        ) : (
          <>
            <CopyIcon className="k-h-3 k-w-3" />
            <span>Copiar</span>
          </>
        )}
      </button>
    </div>
  );
}

export default function OauthClientsPage() {
  const { isPlatformAdmin, getToken } = useAuth();
  const [platformAdminChecked, setPlatformAdminChecked] = useState(false);
  const [platformAdmin, setPlatformAdmin] = useState(false);

  const [clients, setClients] = useState<OAuthClient[] | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [mcpClientId, setMcpClientId] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootstrapAttempted = useRef(false);

  const [editDialogClient, setEditDialogClient] = useState<OAuthClient | "new" | null>(null);
  const [formName, setFormName] = useState("");
  const [formRedirectUris, setFormRedirectUris] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OAuthClient | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void isPlatformAdmin().then((result) => {
      setPlatformAdmin(result);
      setPlatformAdminChecked(true);
    });
  }, [isPlatformAdmin]);

  async function loadAll() {
    setError(null);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [settingsRes, clientsRes, appsRes] = await Promise.all([
        fetch(`${AUTH_SERVER_URL}/api/instance-settings`),
        fetch(`${AUTH_SERVER_URL}/api/oauth-clients`, { headers }),
        fetch(`${AUTH_SERVER_URL}/api/applications`, { headers }),
      ]);
      const settingsData = (await settingsRes.json().catch(() => ({}))) as { mcpOauthClientId?: string | null };
      const clientsData = (await clientsRes.json().catch(() => ({}))) as { clients?: OAuthClient[]; error?: string };
      const appsData = (await appsRes.json().catch(() => ({}))) as { applications?: ApplicationRow[] };
      if (!clientsRes.ok) throw new Error(clientsData.error ?? "No se pudieron cargar los clientes OAuth.");

      setMcpClientId(settingsData.mcpOauthClientId ?? null);
      setClients(clientsData.clients ?? []);
      setApplications(appsData.applications ?? []);
      return settingsData.mcpOauthClientId ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los clientes OAuth.");
      return null;
    }
  }

  useEffect(() => {
    if (!platformAdmin) return;
    void (async () => {
      const existingMcpId = await loadAll();
      if (!existingMcpId && !bootstrapAttempted.current) {
        bootstrapAttempted.current = true;
        setBootstrapping(true);
        try {
          const token = await getToken();
          const response = await fetch(`${AUTH_SERVER_URL}/api/oauth-clients/mcp-bootstrap`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(data?.error ?? "No se pudo crear el cliente de MCP.");
          }
          await loadAll();
        } catch (err) {
          setError(err instanceof Error ? err.message : "No se pudo crear el cliente de MCP.");
        } finally {
          setBootstrapping(false);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformAdmin]);

  function openEdit(client: OAuthClient) {
    setEditDialogClient(client);
    setFormName(client.client_name);
    setFormRedirectUris(client.redirect_uris.join("\n"));
    setFormError(null);
  }

  function openCreate() {
    setEditDialogClient("new");
    setFormName("");
    setFormRedirectUris("");
    setFormError(null);
  }

  async function handleSave() {
    const redirectUris = formRedirectUris
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!formName.trim() || redirectUris.length === 0) {
      setFormError("Nombre y al menos una redirect URI son requeridos.");
      return;
    }
    if (!editDialogClient) return;
    setSaving(true);
    setFormError(null);
    try {
      const token = await getToken();
      const isEdit = editDialogClient !== "new";
      const url = isEdit
        ? `${AUTH_SERVER_URL}/api/oauth-clients?clientId=${editDialogClient.client_id}`
        : `${AUTH_SERVER_URL}/api/oauth-clients`;
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: formName.trim(), redirect_uris: redirectUris }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo guardar el cliente.");
      }
      setEditDialogClient(null);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/oauth-clients?clientId=${deleteTarget.client_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo eliminar el cliente.");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el cliente.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (!platformAdminChecked) {
    return <p className="k-p-8 k-text-sm k-text-muted-foreground">Cargando...</p>;
  }
  if (!platformAdmin) {
    return <ForbiddenScreen description="Solo un platform admin puede administrar los clientes OAuth de la instalación." />;
  }

  const mcpClient = clients?.find((c) => c.client_id === mcpClientId) ?? null;
  const otherClients = (clients ?? []).filter((c) => c.client_id !== mcpClientId);
  const appByClientId = new Map(applications.filter((a) => a.oauth_client_id).map((a) => [a.oauth_client_id, a.name]));

  return (
    <div className="k-flex k-max-w-2xl k-flex-col k-gap-6">
      <div>
        <h1 className="k-text-xl k-font-bold">Clientes OAuth</h1>
        <p className="k-mt-1 k-text-sm k-text-muted-foreground">
          Credenciales de login SSO (OAuth 2.1 + PKCE) — quién puede iniciar sesión centralizado contra esta
          instalación. No confundir con las <strong>API Keys</strong>, que son para que el backend de una
          aplicación llame al API de administración (ver Aplicaciones → tu app → API Keys). Un cliente OAuth
          puede pertenecer a una aplicación de negocio (SSO) o ser de propósito general, como el reservado para
          agentes de IA de abajo.
        </p>
      </div>

      {error && <p className="k-rounded-lg k-border k-border-destructive/20 k-bg-destructive/10 k-p-2.5 k-text-xs k-text-destructive">{error}</p>}

      {bootstrapping && (
        <p className="k-flex k-items-center k-gap-2 k-text-sm k-text-muted-foreground">
          <SpinnerIcon />
          Creando el cliente reservado para MCP...
        </p>
      )}

      {mcpClient && (
        <Card className="k-flex k-flex-col k-gap-3 k-border-primary/30 k-bg-primary/5 k-p-5">
          <div className="k-flex k-items-start k-justify-between k-gap-3">
            <div className="k-flex k-items-center k-gap-2">
              <KeyIcon className="k-text-primary" />
              <span className="k-font-semibold">{mcpClient.client_name}</span>
            </div>
            <Badge variant="primary">Reservado</Badge>
          </div>
          <p className="k-text-xs k-text-muted-foreground">
            Cliente fijo para conectar agentes de IA (Claude Code, Claude Desktop, ChatGPT y similares) vía MCP —
            no se puede eliminar. Ver <a href="/docs/mcp" className="k-underline">MCP: conecta un agente de IA</a>.
          </p>
          <CopyableId value={mcpClient.client_id} />
          <div className="k-flex k-flex-col k-gap-1">
            <span className="k-text-xs k-font-medium k-text-muted-foreground">Redirect URIs autorizadas</span>
            <div className="k-flex k-flex-col k-gap-1">
              {mcpClient.redirect_uris.map((uri) => (
                <code key={uri} className="k-rounded k-bg-background k-px-2 k-py-1 k-font-mono k-text-[11px] k-text-muted-foreground">
                  {uri}
                </code>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openEdit(mcpClient)}
            className="k-inline-flex k-w-fit k-items-center k-gap-1.5 k-text-xs k-font-medium k-text-primary hover:k-underline"
          >
            Agregar otra redirect URI (ej. tu propio localhost para Claude Code)
          </button>
        </Card>
      )}

      <div className="k-flex k-items-center k-justify-between">
        <p className="k-text-[11px] k-font-semibold k-uppercase k-tracking-wide k-text-muted-foreground">
          Otros clientes {otherClients.length > 0 && `(${otherClients.length})`}
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="k-inline-flex k-items-center k-gap-1.5 k-rounded-lg k-bg-primary k-px-3 k-py-1.5 k-text-xs k-font-medium k-text-primary-foreground hover:k-opacity-90 k-transition-all"
        >
          + Nuevo cliente
        </button>
      </div>

      {clients === null ? (
        <p className="k-text-sm k-text-muted-foreground">Cargando...</p>
      ) : otherClients.length === 0 ? (
        <p className="k-text-sm k-text-muted-foreground">No hay más clientes OAuth registrados.</p>
      ) : (
        <div className="k-flex k-flex-col k-gap-2">
          {otherClients.map((client) => {
            const linkedAppName = appByClientId.get(client.client_id);
            return (
              <Card key={client.client_id} className="k-flex k-flex-col k-gap-2 k-p-4">
                <div className="k-flex k-items-start k-justify-between k-gap-3">
                  <div className="k-min-w-0">
                    <p className="k-truncate k-text-sm k-font-semibold">{client.client_name}</p>
                    {linkedAppName ? (
                      <Badge variant="success">Vinculado a {linkedAppName}</Badge>
                    ) : (
                      <Badge variant="neutral">Sin vincular</Badge>
                    )}
                  </div>
                  <div className="k-flex k-shrink-0 k-gap-3 k-text-xs">
                    <button type="button" onClick={() => openEdit(client)} className="k-font-medium k-text-primary hover:k-underline">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(client)}
                      className="k-font-medium k-text-destructive hover:k-underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                <code className="k-truncate k-font-mono k-text-[11px] k-text-muted-foreground">{client.client_id}</code>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={editDialogClient !== null}
        onOpenChange={(open) => !open && setEditDialogClient(null)}
        title={editDialogClient === "new" ? "Nuevo cliente OAuth" : "Editar cliente OAuth"}
        description="Nombre y redirect URIs autorizadas para este cliente."
      >
        <div className="k-flex k-flex-col k-gap-4 k-pt-1">
          <div className="k-flex k-flex-col k-gap-1.5">
            <label htmlFor="k-oauth-name" className="k-text-sm k-font-medium">
              Nombre
            </label>
            <input
              id="k-oauth-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2.5 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20"
            />
          </div>
          <div className="k-flex k-flex-col k-gap-1.5">
            <label htmlFor="k-oauth-redirects" className="k-text-sm k-font-medium">
              Redirect URIs (una por línea)
            </label>
            <textarea
              id="k-oauth-redirects"
              rows={3}
              value={formRedirectUris}
              onChange={(e) => setFormRedirectUris(e.target.value)}
              placeholder="https://miapp.com/oauth/callback"
              className="k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2.5 k-font-mono k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20"
            />
          </div>
          {formError && <p className="k-rounded-lg k-bg-destructive/10 k-p-2.5 k-text-xs k-text-destructive">{formError}</p>}
          <div className="k-flex k-justify-end k-gap-3 k-pt-2">
            <button
              type="button"
              onClick={() => setEditDialogClient(null)}
              disabled={saving}
              className="k-rounded-lg k-px-4 k-py-2 k-text-sm k-font-medium k-text-muted-foreground hover:k-bg-muted disabled:k-opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60 hover:k-opacity-90"
            >
              {saving && <SpinnerIcon />}
              <span>Guardar</span>
            </button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        destructive
        title="Eliminar cliente OAuth"
        description={`¿Eliminar "${deleteTarget?.client_name}"? Cualquier integración que lo use dejará de poder iniciar sesión de inmediato.`}
        confirmLabel={deleting ? "Eliminando..." : "Eliminar"}
        onConfirm={handleDelete}
      />
    </div>
  );
}
