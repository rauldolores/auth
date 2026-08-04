"use client";

import { AuthGuard, useAuth } from "@kontrolia/react";
import { OrgSwitcher, UserMenu } from "@kontrolia/ui";
import { useState } from "react";
import { useOrganizations } from "@/lib/use-organizations";

export default function HomePage() {
  const { user, organization, isAuthenticated } = useAuth();
  const { organizations, isLoading, reload } = useOrganizations(isAuthenticated);
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <AuthGuard fallback={<GoToLogin />}>
      <div className="k-mx-auto k-flex k-max-w-3xl k-flex-col k-gap-6 k-p-8">
        <div className="k-flex k-items-center k-justify-between">
          <h1 className="k-text-xl k-font-semibold">Hola, {user?.fullName ?? user?.email}</h1>
          <UserMenu />
        </div>

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

        {!organization && !isLoading && organizations.length === 0 && (
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
      </div>
    </AuthGuard>
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

      // The trigger on kontrolia.organizations auto-enrolls the caller as
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
    <form onSubmit={handleSubmit} className="k-flex k-max-w-sm k-flex-col k-gap-3 k-rounded-md k-border k-border-border k-p-4">
      <p className="k-text-sm k-font-medium">Crear organización</p>
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
  );
}

function GoToLogin() {
  if (typeof window !== "undefined") window.location.href = "/login";
  return null;
}
