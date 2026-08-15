"use client";

import { useAuth } from "@kontrolia/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SUPABASE_OAUTH_CODE_VERIFIER_KEY } from "@/lib/oauth";

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

// useSearchParams() requires a Suspense boundary in the App Router.
export default function SupabaseOAuthCallbackPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SupabaseOAuthCallbackInner />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="k-flex k-min-h-screen k-items-center k-justify-center">
      <p className="k-text-sm k-text-muted-foreground">Conectando con Supabase...</p>
    </div>
  );
}

function SupabaseOAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      setError(searchParams.get("error_description") ?? oauthError);
      return;
    }
    if (!code) {
      setError("Falta el código de autorización.");
      return;
    }
    const codeVerifier = sessionStorage.getItem(SUPABASE_OAUTH_CODE_VERIFIER_KEY);
    if (!codeVerifier) {
      setError("No se encontró el verificador de la sesión. Intenta conectar de nuevo.");
      return;
    }

    void (async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${AUTH_SERVER_URL}/api/supabase-connection/callback`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            codeVerifier,
            redirectUri: `${window.location.origin}/oauth/supabase-callback`,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo completar la conexión con Supabase.");
        sessionStorage.removeItem(SUPABASE_OAUTH_CODE_VERIFIER_KEY);
        router.push("/social-login");
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo completar la conexión con Supabase.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="k-flex k-min-h-screen k-flex-col k-items-center k-justify-center k-gap-3 k-text-center">
        <p className="k-text-sm k-text-destructive">{error}</p>
        <a href="/social-login" className="k-text-sm k-underline">
          Volver
        </a>
      </div>
    );
  }

  return <Loading />;
}
