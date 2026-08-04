"use client";

import { useAuth } from "@kontrolia/react";
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
  const { organization } = useAuth();
  const [applications, setApplications] = useState<ApplicationRow[] | null>(null);

  useEffect(() => {
    if (!organization) return;
    const supabase = createKontroliaSchemaClient();

    void (async () => {
      const { data: rows } = await supabase
        .from("application_organizations")
        .select("application:applications(id, name, slug, environment)")
        .eq("organization_id", organization.id)
        .returns<{ application: { id: string; name: string; slug: string; environment: string } | null }[]>();

      const apps = (rows ?? []).map((row) => row.application).filter((app): app is NonNullable<typeof app> => app !== null);

      if (apps.length === 0) {
        setApplications([]);
        return;
      }

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

      setApplications(
        apps
          .map((app) => ({ ...app, permissionCount: counts.get(app.id) ?? 0 }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    })();
  }, [organization?.id]);

  if (!organization) {
    return <p className="k-text-sm k-text-muted-foreground">Selecciona una organización primero.</p>;
  }

  return (
    <div className="k-flex k-flex-col k-gap-6">
      <div>
        <h1 className="k-text-xl k-font-semibold">Aplicaciones — {organization.name}</h1>
        <p className="k-mt-1 k-text-sm k-text-muted-foreground">
          Aplicaciones habilitadas para esta organización y el catálogo de permisos que cada una declara. El
          registro de nuevas aplicaciones (client_id/secret vía OAuth 2.1) llega en v2 — mientras tanto se
          habilitan a nivel de plataforma.
        </p>
      </div>
      <table className="k-w-full k-text-sm">
        <thead>
          <tr className="k-border-b k-border-border k-text-left k-text-muted-foreground">
            <th className="k-py-2">Nombre</th>
            <th className="k-py-2">Slug</th>
            <th className="k-py-2">Entorno</th>
            <th className="k-py-2">Permisos</th>
          </tr>
        </thead>
        <tbody>
          {applications?.map((app) => (
            <tr key={app.id} className="k-border-b k-border-border">
              <td className="k-py-2">{app.name}</td>
              <td className="k-py-2 k-text-muted-foreground">{app.slug}</td>
              <td className="k-py-2 k-text-muted-foreground">{app.environment}</td>
              <td className="k-py-2 k-text-muted-foreground">{app.permissionCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {applications?.length === 0 && (
        <p className="k-text-sm k-text-muted-foreground">Sin aplicaciones habilitadas para esta organización.</p>
      )}
    </div>
  );
}
