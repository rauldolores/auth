"use client";

import { useAuth } from "@kontrolia/react";
import { Card } from "@kontrolia/ui";

export default function DashboardPage() {
  const { user, organization, roles, permissions } = useAuth();

  return (
    <div className="k-flex k-flex-col k-gap-6">
      <div className="k-relative k-overflow-hidden k-rounded-2xl k-bg-[linear-gradient(135deg,#1b1030,#2b1a52_45%,#4c2a8c)] k-p-7">
        <span className="k-inline-flex k-items-center k-rounded-full k-bg-white/10 k-px-3 k-py-1 k-text-xs k-font-medium k-text-white/70">
          Resumen general
        </span>
        <h1 className="k-mb-2 k-mt-3 k-text-[34px] k-font-extrabold k-leading-tight k-tracking-tight k-text-white">
          Bienvenido, <span className="k-bg-gradient-to-r k-from-[#c9bdff] k-to-[#8f7cff] k-bg-clip-text k-text-transparent">{user?.fullName ?? user?.email}</span>
        </h1>
        <p className="k-mb-5 k-text-sm k-text-white/70">
          {organization ? `Estás trabajando en ${organization.name}.` : "Selecciona una organización para empezar."}
        </p>
        <div className="k-flex k-flex-wrap k-gap-2.5">
          <span className="k-flex k-items-center k-gap-1.5 k-rounded-[10px] k-border k-border-white/[0.12] k-bg-white/[0.07] k-px-3.5 k-py-2 k-text-sm k-text-white">
            <strong className="k-font-bold">{roles.length}</strong> roles activos
          </span>
          <span className="k-flex k-items-center k-gap-1.5 k-rounded-[10px] k-border k-border-white/[0.12] k-bg-white/[0.07] k-px-3.5 k-py-2 k-text-sm k-text-white">
            <strong className="k-font-bold">{permissions.length}</strong> permisos concedidos
          </span>
        </div>
      </div>

      <div className="k-grid k-grid-cols-2 k-gap-4">
        <Card>
          <p className="k-mb-2 k-text-sm k-font-semibold">Roles activos</p>
          <p className="k-text-sm k-text-muted-foreground">{roles.join(", ") || "Ninguno"}</p>
        </Card>
        <Card>
          <p className="k-mb-2 k-text-sm k-font-semibold">Permisos</p>
          <p className="k-text-sm k-text-muted-foreground">{permissions.length} permisos concedidos en esta organización</p>
        </Card>
      </div>
    </div>
  );
}
