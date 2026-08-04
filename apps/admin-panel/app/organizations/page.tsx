"use client";

import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRow[] | null>(null);

  useEffect(() => {
    const supabase = createKontroliaSchemaClient();
    supabase
      .from("organizations")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrganizations(data));
  }, []);

  return (
    <div className="k-flex k-flex-col k-gap-4">
      <h1 className="k-text-xl k-font-semibold">Organizaciones</h1>
      <table className="k-w-full k-text-sm">
        <thead>
          <tr className="k-border-b k-border-border k-text-left k-text-muted-foreground">
            <th className="k-py-2">Nombre</th>
            <th className="k-py-2">Slug</th>
            <th className="k-py-2">Creada</th>
          </tr>
        </thead>
        <tbody>
          {organizations?.map((org) => (
            <tr key={org.id} className="k-border-b k-border-border">
              <td className="k-py-2">{org.name}</td>
              <td className="k-py-2 k-text-muted-foreground">{org.slug}</td>
              <td className="k-py-2 k-text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {organizations?.length === 0 && <p className="k-text-sm k-text-muted-foreground">Sin organizaciones todavía.</p>}
    </div>
  );
}
