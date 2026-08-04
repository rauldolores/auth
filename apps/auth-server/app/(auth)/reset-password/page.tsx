"use client";

import { AuthShell, ResetPasswordForm } from "@kontrolia/ui";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  return (
    <AuthShell title="Elige una nueva contraseña" subtitle="Mínimo 8 caracteres.">
      <ResetPasswordForm onSuccess={() => router.push("/login")} />
    </AuthShell>
  );
}
