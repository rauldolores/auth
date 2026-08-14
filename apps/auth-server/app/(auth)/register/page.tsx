"use client";

import { GuestGuard } from "@kontrolia/react";
import { AuthShell, RegisterForm } from "@kontrolia/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthUiSettings } from "@/lib/instance-settings-context";

export default function RegisterPage() {
  const router = useRouter();
  const { registrationEnabled, logoUrl, googleLoginEnabled, microsoftLoginEnabled } = useAuthUiSettings();

  // Registration disabled instance-wide — the only path to a new account is
  // an Owner/Admin inviting someone from admin-panel. Bounce away rather
  // than rendering a form that would just fail (or worse, succeed against a
  // toggle meant to close this off).
  useEffect(() => {
    if (!registrationEnabled) router.replace("/login");
  }, [registrationEnabled, router]);

  if (!registrationEnabled) return null;

  return (
    <GuestGuard fallback={<p className="k-p-8 k-text-center k-text-sm">Ya iniciaste sesión.</p>}>
      <AuthShell title="Crea tu cuenta" subtitle="Empieza a usar KontrolIA Auth en segundos." logoUrl={logoUrl}>
        <RegisterForm
          onSuccess={() => router.push("/verify-email")}
          loginHref="/login"
          showGoogle={googleLoginEnabled}
          showMicrosoft={microsoftLoginEnabled}
        />
      </AuthShell>
    </GuestGuard>
  );
}
