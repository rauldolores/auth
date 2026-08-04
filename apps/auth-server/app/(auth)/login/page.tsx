"use client";

import { GuestGuard } from "@kontrolia/react";
import { LoginForm } from "@kontrolia/ui";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  return (
    <GuestGuard fallback={<p className="k-p-8 k-text-center k-text-sm">Ya iniciaste sesión.</p>}>
      <div className="k-mx-auto k-flex k-min-h-screen k-max-w-sm k-flex-col k-justify-center k-gap-6 k-px-4">
        <h1 className="k-text-xl k-font-semibold">Inicia sesión en KontrolIA</h1>
        <LoginForm
          onSuccess={() => router.push("/")}
          forgotPasswordHref="/forgot-password"
          registerHref="/register"
        />
      </div>
    </GuestGuard>
  );
}
