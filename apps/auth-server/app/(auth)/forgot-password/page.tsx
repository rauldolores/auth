"use client";

import { AuthShell, ForgotPasswordForm } from "@kontrolia/ui";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Recuperar contraseña" subtitle="Te enviamos un enlace para elegir una nueva.">
      <ForgotPasswordForm redirectTo="/reset-password" />
    </AuthShell>
  );
}
