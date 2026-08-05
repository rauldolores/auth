"use client";

import { GuestGuard, useAuth } from "@kontrolia/react";
import { AuthShell, LoginForm } from "@kontrolia/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { resolveRedirectTarget } from "@/lib/redirect";

// useSearchParams() requires a Suspense boundary in the App Router.
export default function LoginPage() {
  return (
    <Suspense fallback={<p className="k-p-8 k-text-center k-text-sm k-text-muted-foreground">Cargando...</p>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const { getAuthenticatorAssuranceLevel } = useAuth();
  const redirectTarget = resolveRedirectTarget(useSearchParams().get("redirect_to"));

  async function handleLoginSuccess() {
    // login() only gets the session to aal1 — if the account has a verified
    // TOTP factor, currentLevel/nextLevel diverge and the session isn't
    // fully elevated until the code challenge completes.
    const { currentLevel, nextLevel } = await getAuthenticatorAssuranceLevel();
    if (nextLevel === "aal2" && currentLevel !== "aal2") {
      const query = redirectTarget !== "/" ? `?redirect_to=${encodeURIComponent(redirectTarget)}` : "";
      router.push(`/mfa-challenge${query}`);
    } else if (redirectTarget !== "/") {
      // Cross-origin (e.g. back to admin-panel) — a Next.js route push can't
      // leave this app, this has to be a real browser navigation.
      window.location.href = redirectTarget;
    } else {
      router.push("/");
    }
  }

  return (
    <GuestGuard fallback={<p className="k-p-8 k-text-center k-text-sm">Ya iniciaste sesión.</p>}>
      <AuthShell title="Inicia sesión" subtitle="Continúa con tu cuenta o correo.">
        <LoginForm
          onSuccess={() => void handleLoginSuccess()}
          forgotPasswordHref="/forgot-password"
          registerHref="/register"
          showGoogle={process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true"}
          showMicrosoft={process.env.NEXT_PUBLIC_MICROSOFT_LOGIN_ENABLED === "true"}
        />
      </AuthShell>
    </GuestGuard>
  );
}
