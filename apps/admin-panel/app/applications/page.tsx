"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

interface ApplicationRow {
  id: string;
  name: string;
  slug: string;
  environment: string;
  owner_organization_id: string | null;
  homepage_url: string | null;
  api_key_last_used_at: string | null;
  permissionCount: number;
}

const APPLICATIONS_PAGE_SIZE = 50;

/** Mirrors packages/db/src/api-key.ts exactly (same prefix, same 24
 * random bytes base64url-encoded, same sha256 hex digest) — generated and
 * hashed entirely client-side so the plaintext key is shown once here and
 * never round-tripped through the database; only its hash is ever sent. */
async function generateAndHashApiKey(): Promise<{ plaintext: string; hashHex: string }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64Url = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const plaintext = `kapp_${base64Url}`;

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plaintext));
  const hashHex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return { plaintext, hashHex };
}

export default function ApplicationsPage() {
  const { organization, hasRole, isPlatformAdmin, getToken } = useAuth();
  const [enabled, setEnabled] = useState<ApplicationRow[] | null>(null);
  const [available, setAvailable] = useState<ApplicationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newApiKey, setNewApiKey] = useState<{ appId: string; plaintext: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const canManage = hasRole(["owner", "admin"]);

  useEffect(() => {
    void (async () => setPlatformAdmin(await isPlatformAdmin()))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadApplications(orgId: string, offset = 0, append = false) {
    const supabase = createKontroliaSchemaClient();

    const [{ data: appPage }, { data: enabledRows }] = await Promise.all([
      supabase
        .from("applications")
        .select("id, name, slug, environment, owner_organization_id, homepage_url, api_key_last_used_at")
        .order("name")
        .range(offset, offset + APPLICATIONS_PAGE_SIZE - 1),
      supabase
        .from("application_organizations")
        .select("application_id")
        .eq("organization_id", orgId)
        .returns<{ application_id: string }[]>(),
    ]);

    const enabledIds = new Set((enabledRows ?? []).map((row) => row.application_id));
    const page = appPage ?? [];

    const { data: permissionRows } = await supabase
      .from("permissions")
      .select("application_id")
      .in(
        "application_id",
        page.map((app) => app.id),
      )
      .returns<{ application_id: string }[]>();

    const counts = new Map<string, number>();
    for (const permission of permissionRows ?? []) {
      counts.set(permission.application_id, (counts.get(permission.application_id) ?? 0) + 1);
    }

    const withCounts = page.map((app) => ({ ...app, permissionCount: counts.get(app.id) ?? 0 }));

    setEnabled((current) => {
      const next = withCounts.filter((app) => enabledIds.has(app.id));
      return append ? [...(current ?? []), ...next] : next;
    });
    setAvailable((current) => {
      const next = withCounts.filter((app) => !enabledIds.has(app.id));
      return append ? [...(current ?? []), ...next] : next;
    });
    setHasMore(page.length === APPLICATIONS_PAGE_SIZE);
  }

  useEffect(() => {
    if (organization) void loadApplications(organization.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  async function handleLoadMore() {
    if (!organization) return;
    setLoadingMore(true);
    await loadApplications(organization.id, (enabled?.length ?? 0) + (available?.length ?? 0), true);
    setLoadingMore(false);
  }

  async function handleEnable(applicationId: string) {
    if (!organization) return;
    setError(null);
    setPendingId(applicationId);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: insertError } = await supabase
        .from("application_organizations")
        .insert({ application_id: applicationId, organization_id: organization.id });
      if (insertError) throw insertError;
      await loadApplications(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo habilitar la aplicación.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDisable(applicationId: string, applicationName: string) {
    if (!organization) return;
    if (
      !window.confirm(
        `¿Deshabilitar "${applicationName}" para ${organization.name}? Quien inicie sesión con esa app dejará de poder acceder.`,
      )
    ) {
      return;
    }
    setError(null);
    setPendingId(applicationId);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: deleteError } = await supabase
        .from("application_organizations")
        .delete()
        .eq("application_id", applicationId)
        .eq("organization_id", organization.id);
      if (deleteError) throw deleteError;
      await loadApplications(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo deshabilitar la aplicación.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleSaveUrl(applicationId: string) {
    setError(null);
    setPendingId(applicationId);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: updateError } = await supabase
        .from("applications")
        .update({ homepage_url: urlDraft.trim() || null })
        .eq("id", applicationId);
      if (updateError) throw updateError;
      setEditingUrlId(null);
      if (organization) await loadApplications(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la URL.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleClaim(app: ApplicationRow) {
    if (!organization) return;
    if (
      !window.confirm(
        `¿Reclamar "${app.name}" para ${organization.name}? Esta organización pasará a controlar su clave de sincronización — no se puede deshacer ni transferir después.`,
      )
    ) {
      return;
    }
    setError(null);
    setPendingId(app.id);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/applications/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: app.id, organizationId: organization.id }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo reclamar la aplicación.");
      }
      await loadApplications(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reclamar la aplicación.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleRotateKey(app: ApplicationRow) {
    if (
      !window.confirm(
        `¿Rotar la clave de sincronización de "${app.name}"? La clave anterior deja de funcionar de inmediato — actualiza el pipeline de despliegue de la app con la nueva.`,
      )
    ) {
      return;
    }
    setError(null);
    setPendingId(app.id);
    setNewApiKey(null);
    try {
      const { plaintext, hashHex } = await generateAndHashApiKey();
      const supabase = createKontroliaSchemaClient();
      const { error: updateError } = await supabase
        .from("applications")
        .update({ api_key_hash: hashHex, api_key_last_used_at: null })
        .eq("id", app.id);
      if (updateError) throw updateError;
      setNewApiKey({ appId: app.id, plaintext });
      if (organization) await loadApplications(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo rotar la clave.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleRevokeKey(app: ApplicationRow) {
    if (
      !window.confirm(
        `¿Revocar la clave de sincronización de "${app.name}"? El pipeline de despliegue de la app dejará de poder sincronizar su catálogo de permisos hasta que generes una nueva.`,
      )
    ) {
      return;
    }
    setError(null);
    setPendingId(app.id);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: updateError } = await supabase
        .from("applications")
        .update({ api_key_hash: null, api_key_last_used_at: null })
        .eq("id", app.id);
      if (updateError) throw updateError;
      if (newApiKey?.appId === app.id) setNewApiKey(null);
      if (organization) await loadApplications(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revocar la clave.");
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
        <h1 className="k-text-2xl k-font-bold">Aplicaciones</h1>
        <p className="k-mt-1 k-text-sm k-text-muted-foreground">
          Aplicaciones habilitadas para {organization.name} y el catálogo de permisos que cada una declara. Cada
          aplicación mantiene su propio catálogo sincronizado desde su pipeline de despliegue (ver la guía
          "Registro de aplicaciones" en la documentación) — lo que se ve aquí se actualiza solo, sin que nadie lo
          edite a mano. Solo las aplicaciones habilitadas aquí aparecen en Permisos y se pueden asignar a un rol.
          Si lo que buscas es dar de alta un cliente OAuth (para que otra app inicie sesión vía auth-server), eso
          está en "Clientes OAuth" (solo visible para platform admins).
        </p>
      </div>

      {error && <p className="k-text-sm k-text-destructive">{error}</p>}

      {newApiKey && (
        <Card className="k-flex k-items-center k-justify-between k-gap-3 k-border-primary/40 k-bg-primary/5 k-p-4">
          <div className="k-min-w-0">
            <p className="k-text-sm k-font-medium">
              Nueva clave de sincronización — cópiala ahora, no se puede volver a mostrar
            </p>
            <p className="k-truncate k-font-mono k-text-sm k-text-muted-foreground">{newApiKey.plaintext}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(newApiKey.plaintext);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="k-shrink-0 k-rounded-md k-border k-border-border k-px-3 k-py-1.5 k-text-sm hover:k-bg-muted"
          >
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
        </Card>
      )}

      <div>
        <h2 className="k-mb-2 k-text-sm k-font-semibold">Habilitadas</h2>
        <Card className="k-p-0">
          <div className="k-overflow-x-auto">
          <table className="k-w-full k-text-sm">
            <thead>
              <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
                <th className="k-px-5 k-py-3 k-font-semibold">Nombre</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Slug</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Entorno</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Permisos</th>
                <th className="k-px-5 k-py-3 k-font-semibold">URL</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Clave de sincronización</th>
                {canManage && <th className="k-px-5 k-py-3 k-font-semibold" />}
              </tr>
            </thead>
            <tbody>
              {enabled?.map((app) => (
                <tr key={app.id} className="k-border-b k-border-border last:k-border-0">
                  <td className="k-px-5 k-py-3 k-font-medium">{app.name}</td>
                  <td className="k-px-5 k-py-3 k-text-muted-foreground">{app.slug}</td>
                  <td className="k-px-5 k-py-3">
                    <Badge variant={app.environment === "production" ? "success" : "neutral"}>{app.environment}</Badge>
                  </td>
                  <td className="k-px-5 k-py-3 k-text-muted-foreground">{app.permissionCount}</td>
                  <td className="k-px-5 k-py-3">
                    {editingUrlId === app.id ? (
                      <div className="k-flex k-items-center k-gap-2">
                        <input
                          type="url"
                          autoFocus
                          placeholder="https://..."
                          value={urlDraft}
                          onChange={(e) => setUrlDraft(e.target.value)}
                          className="k-w-48 k-rounded-md k-border k-border-border k-bg-background k-px-2 k-py-1 k-text-sm"
                        />
                        <button
                          type="button"
                          disabled={pendingId === app.id}
                          onClick={() => void handleSaveUrl(app.id)}
                          className="k-text-sm k-font-medium k-text-primary hover:k-underline disabled:k-opacity-60"
                        >
                          Guardar
                        </button>
                        <button type="button" onClick={() => setEditingUrlId(null)} className="k-text-sm k-text-muted-foreground">
                          Cancelar
                        </button>
                      </div>
                    ) : app.homepage_url ? (
                      <a href={app.homepage_url} target="_blank" rel="noreferrer" className="k-text-sm k-text-primary hover:k-underline">
                        {app.homepage_url}
                      </a>
                    ) : app.owner_organization_id === organization.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUrlId(app.id);
                          setUrlDraft("");
                        }}
                        className="k-text-sm k-text-muted-foreground hover:k-underline"
                      >
                        Configurar URL
                      </button>
                    ) : (
                      <span className="k-text-sm k-text-muted-foreground">—</span>
                    )}
                    {app.owner_organization_id === organization.id && app.homepage_url && editingUrlId !== app.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUrlId(app.id);
                          setUrlDraft(app.homepage_url ?? "");
                        }}
                        className="k-ml-2 k-text-sm k-text-muted-foreground hover:k-underline"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                  <td className="k-px-5 k-py-3">
                    {app.owner_organization_id === organization.id ? (
                      <div className="k-flex k-flex-col k-gap-1">
                        <span className="k-text-xs k-text-muted-foreground">
                          {app.api_key_last_used_at
                            ? `Última sincronización: ${new Date(app.api_key_last_used_at).toLocaleDateString()}`
                            : "Nunca sincronizada"}
                        </span>
                        {canManage && (
                          <div className="k-flex k-gap-3">
                            <button
                              type="button"
                              disabled={pendingId === app.id}
                              onClick={() => void handleRotateKey(app)}
                              className="k-text-sm k-text-muted-foreground hover:k-underline disabled:k-opacity-60"
                            >
                              Rotar
                            </button>
                            <button
                              type="button"
                              disabled={pendingId === app.id}
                              onClick={() => void handleRevokeKey(app)}
                              className="k-text-sm k-text-destructive hover:k-underline disabled:k-opacity-60"
                            >
                              Revocar
                            </button>
                          </div>
                        )}
                      </div>
                    ) : app.owner_organization_id === null && platformAdmin ? (
                      <button
                        type="button"
                        disabled={pendingId === app.id}
                        onClick={() => void handleClaim(app)}
                        className="k-text-sm k-font-medium k-text-primary hover:k-underline disabled:k-opacity-60"
                      >
                        Reclamar propiedad
                      </button>
                    ) : app.owner_organization_id === null ? (
                      <span className="k-text-sm k-text-muted-foreground">Sin propietario</span>
                    ) : (
                      <span className="k-text-sm k-text-muted-foreground">—</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="k-px-5 k-py-3 k-text-right">
                      <button
                        type="button"
                        disabled={pendingId === app.id}
                        onClick={() => void handleDisable(app.id, app.name)}
                        className="k-text-sm k-text-destructive hover:k-underline disabled:k-opacity-60"
                      >
                        Deshabilitar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {enabled?.length === 0 && (
            <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin aplicaciones habilitadas para esta organización.</p>
          )}
        </Card>
      </div>

      {canManage && (available?.length ?? 0) > 0 && (
        <div>
          <h2 className="k-mb-2 k-text-sm k-font-semibold">Disponibles para habilitar</h2>
          <Card className="k-p-0">
            <div className="k-overflow-x-auto">
            <table className="k-w-full k-text-sm">
              <thead>
                <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
                  <th className="k-px-5 k-py-3 k-font-semibold">Nombre</th>
                  <th className="k-px-5 k-py-3 k-font-semibold">Slug</th>
                  <th className="k-px-5 k-py-3 k-font-semibold">Entorno</th>
                  <th className="k-px-5 k-py-3 k-font-semibold">Permisos</th>
                  <th className="k-px-5 k-py-3 k-font-semibold" />
                </tr>
              </thead>
              <tbody>
                {available?.map((app) => (
                  <tr key={app.id} className="k-border-b k-border-border last:k-border-0">
                    <td className="k-px-5 k-py-3 k-font-medium">{app.name}</td>
                    <td className="k-px-5 k-py-3 k-text-muted-foreground">{app.slug}</td>
                    <td className="k-px-5 k-py-3">
                      <Badge variant={app.environment === "production" ? "success" : "neutral"}>{app.environment}</Badge>
                    </td>
                    <td className="k-px-5 k-py-3 k-text-muted-foreground">{app.permissionCount}</td>
                    <td className="k-px-5 k-py-3 k-text-right">
                      <button
                        type="button"
                        disabled={pendingId === app.id}
                        onClick={() => void handleEnable(app.id)}
                        className="k-text-sm k-font-medium k-text-primary hover:k-underline disabled:k-opacity-60"
                      >
                        Habilitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {hasMore && (
        <div className="k-text-center">
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
    </div>
  );
}
