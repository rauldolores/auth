"use client";

import { AuthGuard, useAuth } from "@kontrolia/react";
import { Card, OrgSwitcher, UserMenu } from "@kontrolia/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useOrganizations } from "@/lib/use-organizations";

export default function HomePage() {
  const { user, organization, isAuthenticated, hasRole } = useAuth();
  const { organizations, isLoading, error: organizationsError, reload } = useOrganizations(isAuthenticated);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Records this browser session as a known device once per sign-in, so
  // /devices has something to list and revoke.
  useEffect(() => {
    if (isAuthenticated) void fetch("/api/devices/touch", { method: "POST" });
  }, [isAuthenticated]);

  return (
    <AuthGuard fallback={<GoToLogin />}>
      <div className="k-min-h-screen k-bg-background">
        <header className="k-border-b k-border-border k-bg-card">
          <div className="k-mx-auto k-flex k-max-w-3xl k-items-center k-justify-between k-px-8 k-py-4">
            <div className="k-flex k-items-center k-gap-2.5">
              <div className="k-flex k-h-8 k-w-8 k-shrink-0 k-items-center k-justify-center k-rounded-lg k-bg-gradient-to-br k-from-primary k-to-[#4c2a8c] k-text-sm k-font-extrabold k-text-white">
                K
              </div>
              <span className="k-text-sm k-font-extrabold">KontrolIA Auth</span>
            </div>
            <div className="k-flex k-items-center k-gap-5">
              <Link href="/devices" className="k-text-sm k-text-muted-foreground hover:k-text-foreground">
                Dispositivos
              </Link>
              <Link href="/security" className="k-text-sm k-text-muted-foreground hover:k-text-foreground">
                Seguridad
              </Link>
              <UserMenu />
            </div>
          </div>
        </header>

        <div className="k-mx-auto k-flex k-max-w-3xl k-flex-col k-gap-6 k-p-8">
          <h1 className="k-text-2xl k-font-bold">Hola, {user?.fullName ?? user?.email}</h1>

          {!isLoading && organizations.length > 0 && (
            <div className="k-flex k-items-center k-gap-3">
              <OrgSwitcher organizations={organizations} onSwitched={() => void reload()} />
              <button
                type="button"
                onClick={() => setShowCreateForm((v) => !v)}
                className="k-text-sm k-text-muted-foreground hover:k-underline"
              >
                + nueva organización
              </button>
            </div>
          )}

          {organizationsError && !isLoading && (
            <p className="k-text-sm k-text-destructive">
              No se pudieron cargar tus organizaciones: {organizationsError}. Intenta recargar la página.
            </p>
          )}

          {!organization && !isLoading && !organizationsError && organizations.length === 0 && (
            <CreateOrganizationForm onCreated={() => void reload()} />
          )}

          {showCreateForm && organizations.length > 0 && (
            <CreateOrganizationForm
              onCreated={() => {
                setShowCreateForm(false);
                void reload();
              }}
            />
          )}

          {organization && (
            <OrganizationCard organization={organization} isOwner={hasRole(["owner"])} onChanged={() => void reload()} />
          )}

          {organization && <OrganizationApplications organizationId={organization.id} />}
        </div>
      </div>
    </AuthGuard>
  );
}

function OrganizationCard({
  organization,
  isOwner,
  onChanged,
}: {
  organization: { id: string; name: string };
  isOwner: boolean;
  onChanged: () => void;
}) {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const [name, setName] = useState(organization.name);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The active org can change out from under this component (OrgSwitcher) —
  // keep the rename input in sync instead of showing a stale name.
  useEffect(() => {
    setName(organization.name);
    setMode("view");
    setConfirmText("");
    setError(null);
  }, [organization.id, organization.name]);

  async function handleRename(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "No se pudo renombrar la organización.");
      }
      // organization.name comes from the JWT, not the row we just updated —
      // without this it'd keep showing the old name until the token
      // naturally refreshes (up to its full TTL).
      await refresh();
      setMode("view");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renombrar la organización.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "No se pudo eliminar la organización.");
      }
      // The active org just disappeared — refresh() falls back to whatever
      // the hook resolves next (another membership, or none).
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la organización.");
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="k-flex k-flex-col k-gap-3">
      <div className="k-flex k-items-center k-justify-between">
        <p className="k-text-sm k-font-semibold">{organization.name}</p>
        {mode === "view" && (
          <div className="k-flex k-items-center k-gap-4">
            <button type="button" onClick={() => setMode("rename")} className="k-text-sm k-text-muted-foreground hover:k-underline">
              Editar
            </button>
            {isOwner && (
              <button type="button" onClick={() => setMode("delete")} className="k-text-sm k-text-destructive hover:k-underline">
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="k-text-sm k-text-destructive">{error}</p>}

      {mode === "rename" && (
        <form onSubmit={handleRename} className="k-flex k-items-center k-gap-2">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="k-flex-1 k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="k-rounded-md k-bg-primary k-px-3 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
          >
            Guardar
          </button>
          <button type="button" onClick={() => setMode("view")} className="k-text-sm k-text-muted-foreground">
            Cancelar
          </button>
        </form>
      )}

      {mode === "delete" && (
        <div className="k-flex k-flex-col k-gap-2 k-rounded-md k-border k-border-destructive/40 k-bg-destructive/5 k-p-3">
          <p className="k-text-sm">
            Esto elimina <strong>{organization.name}</strong> de forma permanente — todos sus miembros, roles,
            invitaciones y el historial de auditoría se pierden. No se puede deshacer.
          </p>
          <p className="k-text-sm k-text-muted-foreground">
            Escribe <strong>{organization.name}</strong> para confirmar:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
          />
          <div className="k-flex k-gap-2">
            <button
              type="button"
              disabled={confirmText !== organization.name || isSubmitting}
              onClick={() => void handleDelete()}
              className="k-rounded-md k-bg-destructive k-px-3 k-py-2 k-text-sm k-font-medium k-text-destructive-foreground disabled:k-opacity-60"
            >
              Eliminar definitivamente
            </button>
            <button type="button" onClick={() => setMode("view")} className="k-text-sm k-text-muted-foreground">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

interface LauncherApplication {
  id: string;
  name: string;
  slug: string;
  homepage_url: string | null;
}

function OrganizationApplications({ organizationId }: { organizationId: string }) {
  const [applications, setApplications] = useState<LauncherApplication[] | null>(null);

  useEffect(() => {
    setApplications(null);
    void fetch(`/api/organizations/${organizationId}/applications`)
      .then((res) => (res.ok ? res.json() : { applications: [] }))
      .then((body: { applications: LauncherApplication[] }) => setApplications(body.applications));
  }, [organizationId]);

  if (applications === null) return null;
  if (applications.length === 0) return null;

  return (
    <Card className="k-flex k-flex-col k-gap-3">
      <p className="k-text-sm k-font-semibold">Tus aplicaciones</p>
      <div className="k-flex k-flex-wrap k-gap-2">
        {applications.map((app) =>
          app.homepage_url ? (
            <a
              key={app.id}
              href={app.homepage_url}
              target="_blank"
              rel="noreferrer"
              className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm k-font-medium hover:k-border-primary"
            >
              {app.name}
            </a>
          ) : (
            <span
              key={app.id}
              title="Aún no tiene una URL configurada"
              className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm k-text-muted-foreground"
            >
              {app.name}
            </span>
          ),
        )}
      </div>
    </Card>
  );
}

function CreateOrganizationForm({ onCreated }: { onCreated: () => void }) {
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "No se pudo crear la organización.");
      }

      // The trigger on kontrolia_auth.organizations auto-enrolls the caller as
      // Owner. refresh() only matters for the very first org (there was no
      // active org yet for the hook to fall back to); switching to an
      // organization created while another was already active still
      // requires switchOrganization() explicitly, same as any other org.
      await refresh();
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la organización.");
    } finally {
      setIsSubmitting(false);
    }
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
        {error && <p className="k-text-sm k-text-destructive">{error}</p>}
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

function GoToLogin() {
  if (typeof window !== "undefined") window.location.href = "/login";
  return null;
}
