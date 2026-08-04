"use client";

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

export default function PermissionsPage() {
  const [groups, setGroups] = useState<ApplicationGroup[] | null>(null);

  useEffect(() => {
    const supabase = createKontroliaSchemaClient();
    supabase
      .from("permissions")
      .select("id, key, resource, action, description, application:applications(id, name)")
      .order("key")
      .returns<PermissionRow[]>()
      .then(({ data }) => {
        const byApplication = new Map<string, ApplicationGroup>();
        for (const permission of data ?? []) {
          const app = permission.application;
          if (!app) continue;
          const group = byApplication.get(app.id) ?? { id: app.id, name: app.name, permissions: [] };
          group.permissions.push(permission);
          byApplication.set(app.id, group);
        }
        setGroups([...byApplication.values()].sort((a, b) => a.name.localeCompare(b.name)));
      });
  }, []);

  return (
    <div className="k-flex k-flex-col k-gap-6">
      <h1 className="k-text-xl k-font-semibold">Permisos</h1>

      {groups?.map((group) => (
        <div key={group.id} className="k-flex k-flex-col k-gap-2">
          <h2 className="k-text-sm k-font-semibold">{group.name}</h2>
          <table className="k-w-full k-text-sm">
            <thead>
              <tr className="k-border-b k-border-border k-text-left k-text-muted-foreground">
                <th className="k-py-2">Clave</th>
                <th className="k-py-2">Recurso</th>
                <th className="k-py-2">Acción</th>
                <th className="k-py-2">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {group.permissions.map((permission) => (
                <tr key={permission.id} className="k-border-b k-border-border">
                  <td className="k-py-2 k-font-mono k-text-xs">{permission.key}</td>
                  <td className="k-py-2 k-text-muted-foreground">{permission.resource}</td>
                  <td className="k-py-2 k-text-muted-foreground">{permission.action}</td>
                  <td className="k-py-2 k-text-muted-foreground">{permission.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {groups?.length === 0 && (
        <p className="k-text-sm k-text-muted-foreground">
          Sin permisos todavía — se registran junto con cada aplicación (Facturación, CRM, ...).
        </p>
      )}
    </div>
  );
}
