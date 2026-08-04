"use client";

import { useAuth } from "@kontrolia/react";

export default function DashboardPage() {
  const { user, roles, permissions } = useAuth();

  return (
    <div className="k-flex k-flex-col k-gap-4">
      <h1 className="k-text-xl k-font-semibold">Bienvenido, {user?.fullName ?? user?.email}</h1>
      <div className="k-grid k-grid-cols-2 k-gap-4 k-text-sm">
        <div className="k-rounded-md k-border k-border-border k-p-4">
          <p className="k-font-medium">Roles activos</p>
          <p className="k-text-muted-foreground">{roles.join(", ") || "ninguno"}</p>
        </div>
        <div className="k-rounded-md k-border k-border-border k-p-4">
          <p className="k-font-medium">Permisos</p>
          <p className="k-text-muted-foreground">{permissions.length} permisos concedidos</p>
        </div>
      </div>
    </div>
  );
}
