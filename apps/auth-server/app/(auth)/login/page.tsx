"use client";

import { GuestGuard, useAuth } from "@kontrolia/react";
import { AuthShell, LoginForm } from "@kontrolia/ui";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const { getAuthenticatorAssuranceLevel } = useAuth();

  async function handleLoginSuccess() {
    // login() only gets the session to aal1 — if the account has a verified
    // TOTP factor, currentLevel/nextLevel diverge and the session isn't
    // fully elevated until the code challenge completes.
    const { currentLevel, nextLevel } = await getAuthenticatorAssuranceLevel();
    if (nextLevel === "aal2" && currentLevel !== "aal2") {
      router.push("/mfa-challenge");
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
