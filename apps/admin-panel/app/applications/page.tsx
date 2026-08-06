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
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Aplicaciones</h1>
        <p className="k-mt-1 k-text-sm k-text-muted-foreground">
          Aplicaciones habilitadas para {organization.name} y el catálogo de permisos que cada una declara. Cada
          aplicación mantiene su propio catálogo sincronizado desde su pipeline de despliegue (ver la guía
          "Registro de aplicaciones" en la documentación) — lo que se ve aquí se actualiza solo, sin que nadie lo
          edite a mano. Una pantalla para registrar aquí tus propias aplicaciones de terceros (client_id/secret
          reales, vía OAuth 2.1) está en el roadmap — mientras tanto se habilitan a nivel de plataforma.
        </p>
      </div>
      <Card className="k-p-0">
        <table className="k-w-full k-text-sm">
          <thead>
            <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
              <th className="k-px-5 k-py-3 k-font-semibold">Nombre</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Slug</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Entorno</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Permisos</th>
            </tr>
          </thead>
          <tbody>
            {applications?.map((app) => (
              <tr key={app.id} className="k-border-b k-border-border last:k-border-0">
                <td className="k-px-5 k-py-3 k-font-medium">{app.name}</td>
                <td className="k-px-5 k-py-3 k-text-muted-foreground">{app.slug}</td>
                <td className="k-px-5 k-py-3">
                  <Badge variant={app.environment === "production" ? "success" : "neutral"}>{app.environment}</Badge>
                </td>
                <td className="k-px-5 k-py-3 k-text-muted-foreground">{app.permissionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {applications?.length === 0 && (
          <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin aplicaciones habilitadas para esta organización.</p>
        )}
      </Card>
    </div>
  );
}
