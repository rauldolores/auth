"use client";

import { AuthGuard, useAuth } from "@kontrolia/react";
import { Card, OrgSwitcher, UserMenu } from "@kontrolia/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useOrganizations } from "@/lib/use-organizations";

export default function HomePage() {
  const { user, organization, isAuthenticated } = useAuth();
  const { organizations, isLoading, reload } = useOrganizations(isAuthenticated);
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
