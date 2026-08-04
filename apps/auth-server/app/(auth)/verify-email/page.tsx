"use client";

import { useAuth } from "@kontrolia/react";
import { AuthShell } from "@kontrolia/ui";

export default function VerifyEmailPage() {
  const { isAuthenticated } = useAuth();

  return (
    <AuthShell title="Revisa tu correo">
      <p className="k-mb-5 k-text-sm k-text-muted-foreground">
        {isAuthenticated
          ? "Tu cuenta ya está confirmada (autoconfirm activo en este entorno)."
          : "Te enviamos un enlace de confirmación. Ábrelo para activar tu cuenta."}
      </p>
      <a
        href={isAuthenticated ? "/" : "/login"}
        className="k-flex k-w-full k-items-center k-justify-center k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground"
      >
        {isAuthenticated ? "Continuar" : "Ir a iniciar sesión"}
      </a>
    </AuthShell>
  );
}
