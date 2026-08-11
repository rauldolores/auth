"use client";

import { Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface PermissionRow {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
  application: { id: string; name: string } | null;
}

interface ApplicationGroup {
  id: string;
  name: string;
  permissions: PermissionRow[];
}

const PERMISSIONS_PAGE_SIZE = 50;

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<PermissionRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const groups: ApplicationGroup[] | null = (() => {
    if (permissions === null) return null;
    const byApplication = new Map<string, ApplicationGroup>();
    for (const permission of permissions) {
      const app = permission.application;
      if (!app) continue;
      const group = byApplication.get(app.id) ?? { id: app.id, name: app.name, permissions: [] };
      group.permissions.push(permission);
      byApplication.set(app.id, group);
    }
    return [...byApplication.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  async function loadPage(offset: number, append: boolean) {
    const supabase = createKontroliaSchemaClient();
    const { data } = await supabase
      .from("permissions")
      .select("id, key, resource, action, description, application:applications(id, name)")
      .order("key")
      .range(offset, offset + PERMISSIONS_PAGE_SIZE - 1)
      .returns<PermissionRow[]>();
    const page = data ?? [];
    setPermissions((current) => (append ? [...(current ?? []), ...page] : page));
    setHasMore(page.length === PERMISSIONS_PAGE_SIZE);
  }

  useEffect(() => {
    void loadPage(0, false);
  }, []);

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadPage((permissions ?? []).length, true);
    setLoadingMore(false);
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Permisos</h1>
        <p className="k-text-sm k-text-muted-foreground">Catálogo de permisos declarado por cada aplicación.</p>
      </div>

      {groups?.map((group) => (
        <div key={group.id} className="k-flex k-flex-col k-gap-2">
          <h2 className="k-text-sm k-font-semibold">{group.name}</h2>
          <Card className="k-p-0">
            <div className="k-overflow-x-auto">
            <table className="k-w-full k-text-sm">
              <thead>
                <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
                  <th className="k-px-5 k-py-3 k-font-semibold">Clave</th>
                  <th className="k-px-5 k-py-3 k-font-semibold">Recurso</th>
                  <th className="k-px-5 k-py-3 k-font-semibold">Acción</th>
                  <th className="k-px-5 k-py-3 k-font-semibold">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {group.permissions.map((permission) => (
                  <tr key={permission.id} className="k-border-b k-border-border last:k-border-0">
                    <td className="k-px-5 k-py-3 k-font-mono k-text-xs">{permission.key}</td>
                    <td className="k-px-5 k-py-3 k-text-muted-foreground">{permission.resource}</td>
                    <td className="k-px-5 k-py-3 k-text-muted-foreground">{permission.action}</td>
                    <td className="k-px-5 k-py-3 k-text-muted-foreground">{permission.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      ))}

      {groups?.length === 0 && (
        <p className="k-text-sm k-text-muted-foreground">
          Sin permisos todavía — se registran junto con cada aplicación (Facturación, CRM, ...).
        </p>
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
