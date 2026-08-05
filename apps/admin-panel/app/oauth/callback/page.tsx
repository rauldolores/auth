"use client";

import { useAuth } from "@kontrolia/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { OAUTH_CODE_VERIFIER_KEY } from "@/lib/oauth";

// useSearchParams() requires a Suspense boundary in the App Router.
export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OAuthCallbackInner />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="k-flex k-min-h-screen k-items-center k-justify-center">
      <p className="k-text-sm k-text-muted-foreground">Completando inicio de sesión...</p>
    </div>
  );
}

function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { exchangeOAuthServerCode } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");
    const state = searchParams.get("state");
    const clientId = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID;

    if (oauthError) {
      setError(searchParams.get("error_description") ?? oauthError);
      return;
    }
    if (!code || !clientId) {
      setError("Falta el código de autorización.");
      return;
    }
    const codeVerifier = sessionStorage.getItem(OAUTH_CODE_VERIFIER_KEY);
    if (!codeVerifier) {
      setError("No se encontró el verificador de la sesión. Intenta iniciar sesión de nuevo.");
      return;
    }

    void (async () => {
      try {
        await exchangeOAuthServerCode({
          clientId,
          redirectUri: `${window.location.origin}/oauth/callback`,
          code,
          codeVerifier,
        });
        sessionStorage.removeItem(OAUTH_CODE_VERIFIER_KEY);
        // Only ever a same-app relative path we generated ourselves — never
        // follow an arbitrary "state" value blindly.
        router.push(state && state.startsWith("/") ? state : "/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo completar el inicio de sesión.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="k-flex k-min-h-screen k-flex-col k-items-center k-justify-center k-gap-3 k-text-center">
        <p className="k-text-sm k-text-destructive">{error}</p>
        <a href="/" className="k-text-sm k-underline">
          Volver a intentar
        </a>
      </div>
    );
  }

  return <Loading />;
}
