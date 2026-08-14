"use client";

import { AuthShell, ResetPasswordForm } from "@kontrolia/ui";
import { useRouter } from "next/navigation";
import { useAuthUiSettings } from "@/lib/instance-settings-context";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { logoUrl } = useAuthUiSettings();

  return (
    <AuthShell title="Elige una nueva contraseña" subtitle="Mínimo 8 caracteres." logoUrl={logoUrl}>
      <ResetPasswordForm onSuccess={() => router.push("/login")} />
    </AuthShell>
  );
}
