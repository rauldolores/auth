"use client";

import { AuthGuard, useAuth } from "@kontrolia/react";
import { UserMenu } from "@kontrolia/ui";

export default function HomePage() {
  const { user, organization } = useAuth();

  return (
    <AuthGuard fallback={<GoToLogin />}>
      <div className="k-mx-auto k-flex k-max-w-3xl k-flex-col k-gap-6 k-p-8">
        <div className="k-flex k-items-center k-justify-between">
          <h1 className="k-text-xl k-font-semibold">Hola, {user?.fullName ?? user?.email}</h1>
          <UserMenu />
        </div>
        <p className="k-text-sm k-text-muted-foreground">
          Organización activa: {organization?.name ?? "sin organización"}
        </p>
      </div>
    </AuthGuard>
  );
}

function GoToLogin() {
  if (typeof window !== "undefined") window.location.href = "/login";
  return null;
}
