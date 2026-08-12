"use client";

import { useAuth } from "@kontrolia/react";
import { Card, Dialog } from "@kontrolia/ui";
import { Fragment, useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  isOwner: boolean;
  isAdmin: boolean;
}

interface MembershipRow {
  status: string;
  organization: { id: string; name: string; slug: string; created_at: string } | null;
  membership_roles: { role: { slug: string } | null }[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function OrganizationsPage() {
  const { user, refresh } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const deletingOrg = organizations?.find((org) => org.id === deletingId) ?? null;

  async function loadOrganizations() {
    if (!user) return;
    const supabase = createKontroliaSchemaClient();
    const { data, error: fetchError } = await supabase
      .from("memberships")
      .select("status, organization:organizations(id, name, slug, created_at), membership_roles(role:roles(slug))")
      .eq("user_id", user.id)
      .eq("status", "active")
      .returns<MembershipRow[]>();

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setError(null);

    const rows = (data ?? [])
      .filter((row): row is MembershipRow & { organization: NonNullable<MembershipRow["organization"]> } => row.organization !== null)
      .map((row) => {
        const slugs = row.membership_roles.map((mr) => mr.role?.slug).filter(Boolean);
        return {
          id: row.organization.id,
          name: row.organization.name,
          slug: row.organization.slug,
          created_at: row.organization.created_at,
          isOwner: slugs.includes("owner"),
          isAdmin: slugs.includes("owner") || slugs.includes("admin"),
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setOrganizations(rows);
  }

  useEffect(() => {
    void loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleCreate(name: string) {
    setError(null);
    setPendingId("__create__");
    try {
      const supabase = createKontroliaSchemaClient();
      const slug = slugify(name);

      // Deliberately not .select().single() on the insert — the "members can
      // view their organizations" SELECT policy depends on the membership
      // row the bootstrap trigger creates in the same statement, and
      // Postgres can evaluate RETURNING's visibility against a stale
      // snapshot from before that trigger ran, intermittently failing RLS
      // even though the insert itself succeeded. A follow-up SELECT in a
      // fresh statement sees it correctly — same fix already shipped in
      // auth-server's own create-organization form.
      const { error: insertError } = await supabase.from("organizations").insert({ name, slug });
      if (insertError) throw insertError;

      await refresh();
      setShowCreateForm(false);
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la organización.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleRename(org: OrganizationRow) {
    if (!editName.trim()) return;
    setError(null);
    setPendingId(org.id);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ name: editName.trim() })
        .eq("id", org.id);
      if (updateError) throw updateError;

      await refresh();
      setEditingId(null);
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renombrar la organización.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(org: OrganizationRow) {
    setError(null);
    setPendingId(org.id);
    try {
      const supabase = createKontroliaSchemaClient();
      // RLS silently filters the row out of the operation instead of
      // erroring — an org that exists but isn't owned by the caller
      // "deletes" 0 rows with no error, so `count` is the only way to tell
      // that apart from success.
      const { error: deleteError, count } = await supabase
        .from("organizations")
        .delete({ count: "exact" })
        .eq("id", org.id);
      if (deleteError) throw deleteError;
      if (!count) throw new Error("No tienes permiso para eliminar esta organización (solo el Owner puede), o ya no existe.");

      await refresh();
      setDeletingId(null);
      setConfirmText("");
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la organización.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div className="k-flex k-items-center k-justify-between">
        <div>
          <h1 className="k-text-2xl k-font-bold">Organizaciones</h1>
          <p className="k-text-sm k-text-muted-foreground">Todas las organizaciones a las que perteneces.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground"
        >
          + Nueva organización
        </button>
      </div>

      {error && <p className="k-text-sm k-text-destructive">{error}</p>}

      {showCreateForm && <CreateOrganizationForm isSubmitting={pendingId === "__create__"} onSubmit={handleCreate} />}

      <Card className="k-p-0">
        <div className="k-overflow-x-auto">
          <table className="k-w-full k-text-sm">
            <thead>
              <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
                <th className="k-px-5 k-py-3 k-font-semibold">Nombre</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Slug</th>
                <th className="k-px-5 k-py-3 k-font-semibold">Creada</th>
                <th className="k-px-5 k-py-3 k-font-semibold" />
              </tr>
            </thead>
            <tbody>
              {organizations?.map((org) => (
                <Fragment key={org.id}>
                  <tr className="k-border-b k-border-border last:k-border-0">
                    <td className="k-px-5 k-py-3 k-font-medium">
                      {editingId === org.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="k-w-full k-rounded-md k-border k-border-border k-bg-background k-px-2 k-py-1 k-text-sm"
                        />
                      ) : (
                        org.name
                      )}
                    </td>
                    <td className="k-px-5 k-py-3 k-text-muted-foreground">{org.slug}</td>
                    <td className="k-px-5 k-py-3 k-text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</td>
                    <td className="k-px-5 k-py-3 k-text-right k-whitespace-nowrap">
                      {editingId === org.id ? (
                        <>
                          <button
                            type="button"
                            disabled={pendingId === org.id}
                            onClick={() => void handleRename(org)}
                            className="k-mr-3 k-text-sm k-font-medium k-text-primary hover:k-underline disabled:k-opacity-60"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="k-text-sm k-text-muted-foreground hover:k-underline"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          {org.isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(org.id);
                                setEditName(org.name);
                              }}
                              className="k-mr-3 k-text-sm k-text-muted-foreground hover:k-underline"
                            >
                              Editar
                            </button>
                          )}
                          {org.isOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingId(deletingId === org.id ? null : org.id);
                                setConfirmText("");
                              }}
                              className="k-text-sm k-text-destructive hover:k-underline"
                            >
                              Eliminar
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {organizations?.length === 0 && <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin organizaciones todavía.</p>}
      </Card>

      <Dialog
        open={deletingOrg !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingId(null);
            setConfirmText("");
          }
        }}
        title="Eliminar organización"
      >
        {deletingOrg && (
          <div className="k-flex k-flex-col k-gap-3">
            <p className="k-text-sm">
              Esto elimina <strong>{deletingOrg.name}</strong> de forma permanente — todos sus miembros, roles,
              invitaciones y el historial de auditoría se pierden. No se puede deshacer.
            </p>
            <div className="k-flex k-flex-col k-gap-1.5">
              <label htmlFor="k-org-delete-confirm" className="k-text-sm k-text-muted-foreground">
                Escribe <strong>{deletingOrg.name}</strong> para confirmar:
              </label>
              <input
                id="k-org-delete-confirm"
                type="text"
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
              />
            </div>
            <div className="k-flex k-justify-end k-gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeletingId(null);
                  setConfirmText("");
                }}
                className="k-rounded-md k-px-4 k-py-2 k-text-sm k-font-medium k-text-muted-foreground hover:k-bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirmText !== deletingOrg.name || pendingId === deletingOrg.id}
                onClick={() => void handleDelete(deletingOrg)}
                className="k-rounded-md k-bg-destructive k-px-4 k-py-2 k-text-sm k-font-medium k-text-destructive-foreground disabled:k-opacity-60"
              >
                Eliminar definitivamente
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function CreateOrganizationForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(name);
    setName("");
  }

  return (
    <Card className="k-max-w-sm">
      <form onSubmit={handleSubmit} className="k-flex k-flex-col k-gap-3">
        <p className="k-text-sm k-font-semibold">Crear organización</p>
        <input
          type="text"
          required
          placeholder="Nombre de la organización"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
        >
          {isSubmitting ? "Creando..." : "Crear organización"}
        </button>
      </form>
    </Card>
  );
}
