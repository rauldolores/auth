"use client";

import { RequirePermission } from "@kontrolia/react";

export default function FacturasPage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <RequirePermission
        permission="facturacion.facturas.crear"
        fallback={<p>No tienes permiso para crear facturas.</p>}
      >
        <h1>Crear factura</h1>
        <p>Esta ruta está protegida por permiso, no por rol — solo &lt;RequirePermission&gt; del SDK.</p>
      </RequirePermission>
    </main>
  );
}
