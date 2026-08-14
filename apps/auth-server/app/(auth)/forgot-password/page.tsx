"use client";

import { AuthShell, ForgotPasswordForm } from "@kontrolia/ui";
import { useAuthUiSettings } from "@/lib/instance-settings-context";

export default function ForgotPasswordPage() {
  const { logoUrl } = useAuthUiSettings();

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Te enviamos un enlace para elegir una nueva." logoUrl={logoUrl}>
      <ForgotPasswordForm redirectTo="/reset-password" />
    </AuthShell>
  );
}
