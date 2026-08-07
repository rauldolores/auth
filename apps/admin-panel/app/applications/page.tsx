"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface ApplicationRow {
  id: string;
  name: string;
  slug: string;
  environment: string;
  permissionCount: number;
}

export default function ApplicationsPage() {
  const { organization, hasRole } = useAuth();
  const [enabled, setEnabled] = useState<ApplicationRow[] | null>(null);
  const [available, setAvailable] = useState<ApplicationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const canManage = hasRole(["owner", "admin"]);

  async function loadApplications(orgId: string) {
    const supabase = createKontroliaSchemaClient();

    const [{ data: allApps }, { data: enabledRows }] = await Promise.all([
      supabase.from("applications").select("id, name, slug, environment"),
      supabase
        .from("application_organizations")
        .select("application_id")
        .eq("organization_id", orgId)
        .returns<{ application_id: string }[]>(),
    ]);

    const enabledIds = new Set((enabledRows ?? []).map((row) => row.application_id));
    const apps = allApps ?? [];

    const { data: permissionRows } = await supabase
      .from("permissions")
      .select("application_id")
      .in(
        "application_id",
        apps.map((app) => app.id),
      )
      .returns<{ application_id: string }[]>();

    const counts = new Map<string, number>();
    for (const permission of permissionRows ?? []) {
      counts.set(permission.application_id, (counts.get(permission.application_id) ?? 0) + 1);
    }

    const withCounts = apps
      .map((app) => ({ ...app, permissionCount: counts.get(app.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setEnabled(withCounts.filter((app) => enabledIds.has(app.id)));
    setAvailable(withCounts.filter((app) => !enabledIds.has(app.id)));
  }

  useEffect(() => {
    if (organization) void loadApplications(organization.id);
  }, [organization?.id]);

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

  async function handleDisable(applicationId: string) {
    if (!organization) return;
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

      <div>
        <h2 className="k-mb-2 k-text-sm k-font-semibold">Habilitadas</h2>
        <Card className="k-p-0">
          <table className="k-w-full k-text-sm">
            <thead>
              <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
                <th className="k-px-5 k-py-3 k-font-semibold">Nombre</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Slug</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Entorno</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Permisos</th>
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
                  {canManage && (
                    <td className="k-px-5 k-py-3 k-text-right">
                      <button
                        type="button"
                        disabled={pendingId === app.id}
                        onClick={() => void handleDisable(app.id)}
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
          {enabled?.length === 0 && (
            <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin aplicaciones habilitadas para esta organización.</p>
          )}
        </Card>
      </div>

      {canManage && (available?.length ?? 0) > 0 && (
        <div>
          <h2 className="k-mb-2 k-text-sm k-font-semibold">Disponibles para habilitar</h2>
          <Card className="k-p-0">
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
          </Card>
        </div>
      )}
    </div>
  );
}
