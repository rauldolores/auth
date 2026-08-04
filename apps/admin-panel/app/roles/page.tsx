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
  organization_id: string | null;
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
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadRoles() {
    const supabase = createKontroliaSchemaClient();
    const { data } = await supabase
      .from("roles")
      .select("id, name, slug, is_system_role, organization_id")
      .order("is_system_role", { ascending: false })
      .order("name");
    setRoles(data ?? []);
  }

  useEffect(() => {
    void loadRoles();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!organization) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: insertError } = await supabase
        .from("roles")
        .insert({ organization_id: organization.id, name, slug: slugify(name) });
      if (insertError) throw insertError;
      setName("");
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el rol.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Roles</h1>
        <p className="k-text-sm k-text-muted-foreground">Roles de sistema y personalizados de tu organización.</p>
      </div>

      {organization && (
        <Card>
          <form onSubmit={handleSubmit} className="k-flex k-max-w-md k-items-end k-gap-3">
            <div className="k-flex k-flex-1 k-flex-col k-gap-1.5">
              <label htmlFor="k-role-name" className="k-text-sm k-font-medium">
                Nuevo rol personalizado
              </label>
              <input
                id="k-role-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p. ej. Facturación — Solo lectura"
                className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
            >
              Crear
            </button>
          </form>
          {error && <p className="k-mt-2 k-text-sm k-text-destructive">{error}</p>}
        </Card>
      )}

      <Card className="k-p-0">
        <table className="k-w-full k-text-sm">
          <thead>
            <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
              <th className="k-px-5 k-py-3 k-font-semibold">Nombre</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Slug</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="k-border-b k-border-border last:k-border-0">
                <td className="k-px-5 k-py-3">
                  <Link href={`/roles/${role.id}`} className="k-font-medium hover:k-underline">
                    {role.name}
                  </Link>
                </td>
                <td className="k-px-5 k-py-3 k-text-muted-foreground">{role.slug}</td>
                <td className="k-px-5 k-py-3">
                  <Badge variant={role.is_system_role ? "primary" : "neutral"}>
                    {role.is_system_role ? "Sistema" : "Personalizado"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {roles.length === 0 && <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin roles todavía.</p>}
      </Card>
    </div>
  );
}
