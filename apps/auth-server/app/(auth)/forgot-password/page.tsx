"use client";

import { ForgotPasswordForm } from "@kontrolia/ui";

export default function ForgotPasswordPage() {
  return (
    <div className="k-mx-auto k-flex k-min-h-screen k-max-w-sm k-flex-col k-justify-center k-gap-6 k-px-4">
      <h1 className="k-text-xl k-font-semibold">Recuperar contraseña</h1>
      <ForgotPasswordForm redirectTo="/reset-password" />
    </div>
  );
}
