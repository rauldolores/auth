"use client";

import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface RoleRow {
  id: string;
  name: string;
  slug: string;
  is_system_role: boolean;
  organization_id: string | null;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);

  useEffect(() => {
    const supabase = createKontroliaSchemaClient();
    supabase
      .from("roles")
      .select("id, name, slug, is_system_role, organization_id")
      .then(({ data }) => setRoles(data));
  }, []);

  return (
    <div className="k-flex k-flex-col k-gap-4">
      <h1 className="k-text-xl k-font-semibold">Roles</h1>
      <table className="k-w-full k-text-sm">
        <thead>
          <tr className="k-border-b k-border-border k-text-left k-text-muted-foreground">
            <th className="k-py-2">Nombre</th>
            <th className="k-py-2">Slug</th>
            <th className="k-py-2">Tipo</th>
          </tr>
        </thead>
        <tbody>
          {roles?.map((role) => (
            <tr key={role.id} className="k-border-b k-border-border">
              <td className="k-py-2">{role.name}</td>
              <td className="k-py-2 k-text-muted-foreground">{role.slug}</td>
              <td className="k-py-2 k-text-muted-foreground">{role.is_system_role ? "Sistema" : "Personalizado"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
