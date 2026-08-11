"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface RoleRow {
  id: string;
  name: string;
  slug: string;
  is_system_role: boolean;
  grants_all_permissions: boolean;
  organization_id: string | null;
  application_id: string | null;
}

interface ApplicationOption {
  id: string;
  name: string;
}

interface ApplicationGroup {
  applicationId: string;
  applicationName: string;
  roles: RoleRow[];
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export default function RolesPage() {
  const { organization } = useAuth();
  const [generalRoles, setGeneralRoles] = useState<RoleRow[]>([]);
  const [appGroups, setAppGroups] = useState<ApplicationGroup[]>([]);
  const [availableApps, setAvailableApps] = useState<ApplicationOption[]>([]);
  const [name, setName] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadRoles(orgId: string) {
    const supabase = createKontroliaSchemaClient();

    const { data: roleRows } = await supabase
      .from("roles")
      .select(
        "id, name, slug, is_system_role, grants_all_permissions, organization_id, application_id, application:applications(name)",
      )
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .returns<(RoleRow & { application: { name: string } | null })[]>();

    const all = roleRows ?? [];
    setGeneralRoles(all.filter((role) => role.application_id === null).sort((a, b) => a.name.localeCompare(b.name)));

    const byApplication = new Map<string, ApplicationGroup>();
    for (const role of all) {
      if (role.application_id === null) continue;
      const group = byApplication.get(role.application_id) ?? {
        applicationId: role.application_id,
        applicationName: role.application?.name ?? "—",
        roles: [],
      };
      group.roles.push(role);
      byApplication.set(role.application_id, group);
    }
    for (const group of byApplication.values()) {
      group.roles.sort((a, b) => Number(b.grants_all_permissions) - Number(a.grants_all_permissions) || a.name.localeCompare(b.name));
    }
    setAppGroups([...byApplication.values()].sort((a, b) => a.applicationName.localeCompare(b.applicationName)));

    const { data: enabledRows } = await supabase
      .from("application_organizations")
      .select("application:applications(id, name)")
      .eq("organization_id", orgId)
      .returns<{ application: ApplicationOption | null }[]>();
    const apps = (enabledRows ?? []).map((row) => row.application).filter((app): app is ApplicationOption => app !== null);
    setAvailableApps(apps);
    if (apps.length && !applicationId) setApplicationId(apps[0]!.id);
  }

  useEffect(() => {
    if (organization) void loadRoles(organization.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!organization || !applicationId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: insertError } = await supabase
        .from("roles")
        .insert({ organization_id: organization.id, application_id: applicationId, name, slug: slugify(name) });
      if (insertError) throw insertError;
      setName("");
      await loadRoles(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el rol.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function roleRow(role: RoleRow) {
    return (
      <tr key={role.id} className="k-border-b k-border-border last:k-border-0">
        <td className="k-px-5 k-py-3">
          <Link href={`/roles/${role.id}`} className="k-font-medium hover:k-underline">
            {role.name}
          </Link>
        </td>
        <td className="k-px-5 k-py-3 k-text-muted-foreground">{role.slug}</td>
        <td className="k-px-5 k-py-3">
          {role.grants_all_permissions ? (
            <Badge variant="primary">Automático (todos los permisos)</Badge>
          ) : (
            <Badge variant={role.is_system_role ? "primary" : "neutral"}>
              {role.is_system_role ? "Sistema" : "Personalizado"}
            </Badge>
          )}
        </td>
      </tr>
    );
  }

  if (!organization) {
    return <p className="k-text-sm k-text-muted-foreground">Selecciona una organización primero.</p>;
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Roles</h1>
        <p className="k-text-sm k-text-muted-foreground">
          Los roles de sistema (Owner/Admin/Member) son generales de la instalación. Cada aplicación habilitada
          tiene su propio "Administrador" (con todos sus permisos, siempre al día) y puede tener roles
          personalizados adicionales — un usuario puede tener un rol distinto en cada aplicación.
        </p>
      </div>

      <Card>
        {availableApps.length === 0 ? (
          <p className="k-text-sm k-text-muted-foreground">
            Habilita al menos una aplicación en{" "}
            <Link href="/applications" className="k-underline">
              Aplicaciones
            </Link>{" "}
            para poder crear roles personalizados.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="k-flex k-max-w-2xl k-flex-wrap k-items-end k-gap-3">
            <div className="k-flex k-flex-1 k-min-w-[12rem] k-flex-col k-gap-1.5">
              <label htmlFor="k-role-name" className="k-text-sm k-font-medium">
                Nuevo rol personalizado
              </label>
              <input
                id="k-role-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p. ej. Contador"
                className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
              />
            </div>
            <div className="k-flex k-flex-col k-gap-1.5">
              <label htmlFor="k-role-app" className="k-text-sm k-font-medium">
                Aplicación
              </label>
              <select
                id="k-role-app"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
              >
                {availableApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
            >
              Crear
            </button>
          </form>
        )}
        {error && <p className="k-mt-2 k-text-sm k-text-destructive">{error}</p>}
      </Card>

      <div className="k-flex k-flex-col k-gap-2">
        <h2 className="k-text-sm k-font-semibold">General</h2>
        <Card className="k-p-0">
          <div className="k-overflow-x-auto">
          <table className="k-w-full k-text-sm">
            <thead>
              <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
                <th className="k-px-5 k-py-3 k-font-semibold">Nombre</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Slug</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Tipo</th>
              </tr>
            </thead>
            <tbody>{generalRoles.map(roleRow)}</tbody>
          </table>
          </div>
        </Card>
      </div>

      {appGroups.map((group) => (
        <div key={group.applicationId} className="k-flex k-flex-col k-gap-2">
          <h2 className="k-text-sm k-font-semibold">{group.applicationName}</h2>
          <Card className="k-p-0">
            <div className="k-overflow-x-auto">
            <table className="k-w-full k-text-sm">
              <thead>
                <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
                  <th className="k-px-5 k-py-3 k-font-semibold">Nombre</th>
                  <th className="k-px-5 k-py-3 k-font-semibold">Slug</th>
                  <th className="k-px-5 k-py-3 k-font-semibold">Tipo</th>
                </tr>
              </thead>
              <tbody>{group.roles.map(roleRow)}</tbody>
            </table>
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}
