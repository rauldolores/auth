"use client";

import { Card } from "@kontrolia/ui";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createKontroliaSchemaClient();
    supabase
      .from("organizations")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message);
          return;
        }
        setOrganizations(data);
      });
  }, []);

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Organizaciones</h1>
        <p className="k-text-sm k-text-muted-foreground">Todas las organizaciones a las que perteneces.</p>
      </div>
      {error && <p className="k-text-sm k-text-destructive">No se pudieron cargar las organizaciones: {error}</p>}
      <Card className="k-p-0">
        <div className="k-overflow-x-auto">
        <table className="k-w-full k-text-sm">
          <thead>
            <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
              <th className="k-px-5 k-py-3 k-font-semibold">Nombre</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Slug</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Creada</th>
            </tr>
          </thead>
          <tbody>
            {organizations?.map((org) => (
              <tr key={org.id} className="k-border-b k-border-border last:k-border-0">
                <td className="k-px-5 k-py-3 k-font-medium">{org.name}</td>
                <td className="k-px-5 k-py-3 k-text-muted-foreground">{org.slug}</td>
                <td className="k-px-5 k-py-3 k-text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {organizations?.length === 0 && <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin organizaciones todavía.</p>}
      </Card>
    </div>
  );
}
