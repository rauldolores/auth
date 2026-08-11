"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface RoleDetail {
  id: string;
  name: string;
  slug: string;
  is_system_role: boolean;
  grants_all_permissions: boolean;
  organization_id: string | null;
  application_id: string | null;
}

interface PermissionRow {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
  application_id: string;
  application: { name: string } | null;
}

interface ApplicationGroup {
  name: string;
  permissions: PermissionRow[];
}

const PERMISSIONS_PAGE_SIZE = 50;

export default function RoleDetailPage() {
  const params = useParams<{ roleId: string }>();
  const roleId = params.roleId;
  const { organization } = useAuth();

  const [role, setRole] = useState<RoleDetail | null | undefined>(undefined);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [appIds, setAppIds] = useState<string[]>([]);
  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const groups: ApplicationGroup[] = (() => {
    const byApplication = new Map<string, ApplicationGroup>();
    for (const permission of permissions) {
      const appName = permission.application?.name ?? "—";
      const group = byApplication.get(permission.application_id) ?? { name: appName, permissions: [] };
      group.permissions.push(permission);
      byApplication.set(permission.application_id, group);
    }
    return [...byApplication.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  async function loadPermissions(ids: string[], offset: number, append: boolean) {
    if (ids.length === 0) {
      setPermissions([]);
      setHasMore(false);
      return;
    }
    const supabase = createKontroliaSchemaClient();
    const { data: permissionRows } = await supabase
      .from("permissions")
      .select("id, key, resource, action, description, application_id, application:applications(name)")
      .in("application_id", ids)
      .order("key")
      .range(offset, offset + PERMISSIONS_PAGE_SIZE - 1)
      .returns<PermissionRow[]>();

    const page = permissionRows ?? [];
    setPermissions((current) => (append ? [...current, ...page] : page));
    setHasMore(page.length === PERMISSIONS_PAGE_SIZE);
  }

  async function loadAll(orgId: string) {
    const supabase = createKontroliaSchemaClient();

    const { data: roleRow } = await supabase
      .from("roles")
      .select("id, name, slug, is_system_role, grants_all_permissions, organization_id, application_id")
      .eq("id", roleId)
      .maybeSingle();
    setRole(roleRow ?? null);
    if (!roleRow) return;

    // Org-wide system roles (Owner/Admin/Member) aren't tied to one
    // application — show permissions across every app enabled for this org,
    // same as before. App-scoped roles (custom or the auto-managed
    // "Administrador de <app>") only ever show that one app's permissions.
    let ids: string[];
    if (roleRow.application_id) {
      ids = [roleRow.application_id];
    } else {
      const { data: appRows } = await supabase
        .from("application_organizations")
        .select("application_id")
        .eq("organization_id", orgId)
        .returns<{ application_id: string }[]>();
      ids = (appRows ?? []).map((row) => row.application_id);
    }
    setAppIds(ids);
    await loadPermissions(ids, 0, false);

    const { data: rolePermissionRows } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId)
      .returns<{ permission_id: string }[]>();
    setGrantedIds(new Set((rolePermissionRows ?? []).map((row) => row.permission_id)));
  }

  useEffect(() => {
    if (organization) void loadAll(organization.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, roleId]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadPermissions(appIds, permissions.length, true);
    setLoadingMore(false);
  }

  const isEditable = role != null && !role.is_system_role;

  async function toggle(permissionId: string, currentlyGranted: boolean) {
    setError(null);
    setPendingId(permissionId);
    try {
      const supabase = createKontroliaSchemaClient();
      if (currentlyGranted) {
        const { error: deleteError } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId)
          .eq("permission_id", permissionId);
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .from("role_permissions")
          .insert({ role_id: roleId, permission_id: permissionId });
        if (insertError) throw insertError;
      }
      setGrantedIds((prev) => {
        const next = new Set(prev);
        if (currentlyGranted) next.delete(permissionId);
        else next.add(permissionId);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el permiso.");
    } finally {
      setPendingId(null);
    }
  }

  if (!organization) {
    return <p className="k-text-sm k-text-muted-foreground">Selecciona una organización primero.</p>;
  }

  if (role === undefined) {
    return <p className="k-text-sm k-text-muted-foreground">Cargando...</p>;
  }

  if (role === null) {
    return <p className="k-text-sm k-text-muted-foreground">Rol no encontrado.</p>;
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <Link href="/roles" className="k-text-sm k-text-muted-foreground hover:k-underline">
          ← Roles
        </Link>
        <div className="k-mt-1 k-flex k-items-center k-gap-2.5">
          <h1 className="k-text-2xl k-font-bold">{role.name}</h1>
          <Badge variant={role.is_system_role ? "primary" : "neutral"}>
            {role.is_system_role ? "Sistema" : "Personalizado"}
          </Badge>
        </div>
        <p className="k-text-sm k-text-muted-foreground">
          {role.grants_all_permissions
            ? "Rol automático — siempre tiene todos los permisos de esta aplicación. Se mantiene sincronizado solo cuando la aplicación agrega permisos nuevos; no se edita a mano."
            : role.is_system_role
              ? "Rol de sistema — sus permisos son fijos y no se pueden editar."
              : "Rol personalizado — activa o desactiva los permisos de esta aplicación."}
        </p>
      </div>

      {error && <p className="k-text-sm k-text-destructive">{error}</p>}

      {groups.length === 0 && (
        <p className="k-text-sm k-text-muted-foreground">
          Esta organización no tiene aplicaciones habilitadas con permisos para asignar.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.name} className="k-flex k-flex-col k-gap-2">
          <h2 className="k-text-sm k-font-semibold">{group.name}</h2>
          <Card className="k-flex k-flex-col k-gap-2 k-p-3">
            {group.permissions.map((permission) => {
              const granted = grantedIds.has(permission.id);
              return (
                <div
                  key={permission.id}
                  className="k-flex k-items-center k-justify-between k-rounded-lg k-border k-border-border k-p-3 k-text-sm"
                >
                  <div>
                    <p className="k-font-mono k-text-xs">{permission.key}</p>
                    {permission.description && (
                      <p className="k-text-xs k-text-muted-foreground">{permission.description}</p>
                    )}
                  </div>
                  <label className="k-flex k-items-center k-gap-2 k-text-xs">
                    <input
                      type="checkbox"
                      checked={granted}
                      disabled={!isEditable || pendingId === permission.id}
                      onChange={() => void toggle(permission.id, granted)}
                      className="k-h-4 k-w-4 k-accent-primary"
                    />
                    <Badge variant={granted ? "success" : "neutral"}>{granted ? "Concedido" : "No concedido"}</Badge>
                  </label>
                </div>
              );
            })}
          </Card>
        </div>
      ))}

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
