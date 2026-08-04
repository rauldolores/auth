"use client";

import { useAuth } from "@kontrolia/react";

export default function VerifyEmailPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="k-mx-auto k-flex k-min-h-screen k-max-w-sm k-flex-col k-justify-center k-gap-4 k-px-4 k-text-center">
      <h1 className="k-text-xl k-font-semibold">Revisa tu correo</h1>
      <p className="k-text-sm k-text-muted-foreground">
        {isAuthenticated
          ? "Tu cuenta ya está confirmada (autoconfirm activo en este entorno)."
          : "Te enviamos un enlace de confirmación. Ábrelo para activar tu cuenta."}
      </p>
      <a href={isAuthenticated ? "/" : "/login"} className="k-text-sm k-underline">
        {isAuthenticated ? "Continuar" : "Ir a iniciar sesión"}
      </a>
    </div>
  );
}
