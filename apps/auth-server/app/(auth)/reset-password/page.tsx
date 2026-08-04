"use client";

import { ResetPasswordForm } from "@kontrolia/ui";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  return (
    <div className="k-mx-auto k-flex k-min-h-screen k-max-w-sm k-flex-col k-justify-center k-gap-6 k-px-4">
      <h1 className="k-text-xl k-font-semibold">Elige una nueva contraseña</h1>
      <ResetPasswordForm onSuccess={() => router.push("/login")} />
    </div>
  );
}
