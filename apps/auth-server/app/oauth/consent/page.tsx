"use client";

import { useAuth } from "@kontrolia/react";
import { AuthShell } from "@kontrolia/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

interface AuthorizationDetails {
  authorizationId: string;
  redirectUri: string;
  client: { id: string; name: string };
  user: { id: string; email: string | null };
  scope: string;
}

// useSearchParams() requires a Suspense boundary in the App Router.
export default function OAuthConsentPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OAuthConsentInner />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="k-flex k-min-h-screen k-items-center k-justify-center">
      <p className="k-text-sm k-text-muted-foreground">Cargando...</p>
    </div>
  );
}

function OAuthConsentInner() {
  const router = useRouter();
  const { isAuthenticated, isLoading, getOAuthAuthorizationDetails, decideOAuthAuthorization } = useAuth();
  const authorizationId = useSearchParams().get("authorization_id");

  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  // GoTrue's authorization GET is only meaningful once — a repeat GET after
  // it's already been decided returns the decision payload instead (no
  // redirect_uri), not the pending-authorization shape. Without this guard,
  // a double effect run (React Strict Mode in dev, or isLoading/isAuthenticated
  // settling in two renders) fetches+auto-approves the same authorizationId
  // twice and the second call crashes on the mismatched shape.
  const processedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!authorizationId) {
      setError("Falta el parámetro authorization_id.");
      return;
    }
    if (!isAuthenticated) {
      const returnTo = `${window.location.origin}/oauth/consent?authorization_id=${authorizationId}`;
      router.push(`/login?redirect_to=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (processedIdRef.current === authorizationId) return;
    processedIdRef.current = authorizationId;

    void (async () => {
      try {
        const result = await getOAuthAuthorizationDetails(authorizationId);

        // GoTrue already decided this one on the GET itself (no consent
        // step exists to call) — just follow the URL it handed back.
        if (result.status === "decided") {
          window.location.href = result.redirectUrl;
          return;
        }

        setDetails(result.details);

        // First-party (admin-panel itself, or any app on that same origin):
        // skip the manual click and approve immediately. A real third-party
        // client falls through to the confirmation screen below.
        const adminPanelUrl = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
        if (adminPanelUrl && result.details.redirectUri.startsWith(adminPanelUrl)) {
          await decide(authorizationId, "approve");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la solicitud de autorización.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, authorizationId]);

  async function decide(id: string, action: "approve" | "deny") {
    setDeciding(true);
    setError(null);
    try {
      const redirectUrl = await decideOAuthAuthorization(id, action);
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la solicitud.");
      setDeciding(false);
    }
  }

  if (error) {
    return (
      <AuthShell title="Solicitud inválida">
        <p className="k-text-sm k-text-destructive">{error}</p>
      </AuthShell>
    );
  }

  if (!details || deciding) return <Loading />;

  return (
    <AuthShell title="Autorizar acceso" subtitle={`${details.client.name} quiere acceder a tu cuenta.`}>
      <div className="k-flex k-flex-col k-gap-4">
        <p className="k-text-sm k-text-muted-foreground">
          Iniciando sesión como <strong>{details.user.email}</strong>.
        </p>
        <div className="k-flex k-gap-3">
          <button
            type="button"
            onClick={() => void decide(details.authorizationId, "deny")}
            className="k-flex-1 k-rounded-md k-border k-border-border k-px-4 k-py-2 k-text-sm k-font-medium hover:k-bg-muted"
          >
            Denegar
          </button>
          <button
            type="button"
            onClick={() => void decide(details.authorizationId, "approve")}
            className="k-flex-1 k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground"
          >
            Autorizar
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
