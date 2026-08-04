"use client";

import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface PermissionRow {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<PermissionRow[] | null>(null);

  useEffect(() => {
    const supabase = createKontroliaSchemaClient();
    supabase
      .from("permissions")
      .select("id, key, resource, action, description")
      .order("key")
      .then(({ data }) => setPermissions(data));
  }, []);

  return (
    <div className="k-flex k-flex-col k-gap-4">
      <h1 className="k-text-xl k-font-semibold">Permisos</h1>
      <table className="k-w-full k-text-sm">
        <thead>
          <tr className="k-border-b k-border-border k-text-left k-text-muted-foreground">
            <th className="k-py-2">Clave</th>
            <th className="k-py-2">Descripción</th>
          </tr>
        </thead>
        <tbody>
          {permissions?.map((permission) => (
            <tr key={permission.id} className="k-border-b k-border-border">
              <td className="k-py-2 k-font-mono k-text-xs">{permission.key}</td>
              <td className="k-py-2 k-text-muted-foreground">{permission.description ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {permissions?.length === 0 && (
        <p className="k-text-sm k-text-muted-foreground">
          Sin permisos todavía — se registran junto con cada aplicación (Facturación, CRM, ...).
        </p>
      )}
    </div>
  );
}
