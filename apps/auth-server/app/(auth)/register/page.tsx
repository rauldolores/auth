"use client";

import { GuestGuard } from "@kontrolia/react";
import { RegisterForm } from "@kontrolia/ui";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <GuestGuard fallback={<p className="k-p-8 k-text-center k-text-sm">Ya iniciaste sesión.</p>}>
      <div className="k-mx-auto k-flex k-min-h-screen k-max-w-sm k-flex-col k-justify-center k-gap-6 k-px-4">
        <h1 className="k-text-xl k-font-semibold">Crea tu cuenta en KontrolIA</h1>
        <RegisterForm
          onSuccess={() => router.push("/verify-email")}
          loginHref="/login"
          showGoogle={process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true"}
          showMicrosoft={process.env.NEXT_PUBLIC_MICROSOFT_LOGIN_ENABLED === "true"}
        />
      </div>
    </GuestGuard>
  );
}
