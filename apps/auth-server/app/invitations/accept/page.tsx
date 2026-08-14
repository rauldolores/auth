"use client";

import { useAuth } from "@kontrolia/react";
import { AuthShell, LoginForm, RegisterForm } from "@kontrolia/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuthUiSettings } from "@/lib/instance-settings-context";

interface InvitationPreview {
  email: string;
  organizationName: string;
  roleName: string | null;
}

// useSearchParams() requires a Suspense boundary in the App Router, or the
// page can render behind a fallback that never resolves ("Cargando
// invitación..." stuck forever) instead of erroring loudly.
export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<p className="k-p-8 k-text-center k-text-sm k-text-muted-foreground">Cargando invitación...</p>}>
      <AcceptInvitationInner />
    </Suspense>
  );
}

function AcceptInvitationInner() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { logoUrl } = useAuthUiSettings();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Falta el token de invitación.");
      return;
    }
    fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json()) as InvitationPreview & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Invitación inválida.");
        setPreview(body);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Invitación inválida."));
  }, [token]);

  async function acceptNow() {
    if (!token) return;
    setIsAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "No se pudo aceptar la invitación.");
      setAccepted(true);
      setTimeout(() => router.push("/"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aceptar la invitación.");
    } finally {
      setIsAccepting(false);
    }
  }

  // Auto-accept the moment the visitor is authenticated (whether they
  // already had a session, just logged in, or just registered).
  useEffect(() => {
    if (isAuthenticated && preview && !accepted && !isAccepting) {
      void acceptNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, preview]);

  if (error) {
    return (
      <AuthShell title="Invitación no válida" logoUrl={logoUrl}>
        <p className="k-text-sm k-text-destructive">{error}</p>
      </AuthShell>
    );
  }

  if (!preview || authLoading) {
    return (
      <div className="k-flex k-min-h-screen k-items-center k-justify-center">
        <p className="k-text-sm k-text-muted-foreground">Cargando invitación...</p>
      </div>
    );
  }

  if (accepted) {
    return (
      <AuthShell title="¡Listo!" logoUrl={logoUrl}>
        <p className="k-text-sm k-text-muted-foreground">Te uniste a {preview.organizationName}. Redirigiendo...</p>
      </AuthShell>
    );
  }

  if (isAuthenticated) {
    return (
      <AuthShell title="Un momento" logoUrl={logoUrl}>
        <p className="k-text-sm k-text-muted-foreground">Aceptando invitación a {preview.organizationName}...</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Te invitaron a ${preview.organizationName}`}
      subtitle={
        preview.roleName
          ? `Como ${preview.roleName} — inicia sesión o crea una cuenta con ${preview.email} para continuar.`
          : `Inicia sesión o crea una cuenta con ${preview.email} para continuar.`
      }
      logoUrl={logoUrl}
    >
      {showRegister ? <RegisterForm onSuccess={() => void 0} /> : <LoginForm onSuccess={() => void 0} />}
      <button
        type="button"
        onClick={() => setShowRegister((v) => !v)}
        className="k-mt-4 k-w-full k-text-center k-text-sm k-text-muted-foreground hover:k-underline"
      >
        {showRegister ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Crea una"}
      </button>
    </AuthShell>
  );
}
