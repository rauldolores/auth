"use client";

import { useAuth } from "@kontrolia/react";

export default function HomePage() {
  const { isAuthenticated, user, login, logout } = useAuth();

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>App de Facturación (ejemplo)</h1>
      <p>Esta app nunca importa supabase-js, ni conoce OAuth o JWT — solo usa @kontrolia/react.</p>
      {isAuthenticated ? (
        <>
          <p>Sesión activa: {user?.email}</p>
          <button onClick={() => logout()}>Cerrar sesión</button>
          <p>
            <a href="/facturas">Ir a Facturas (requiere permiso facturacion.facturas.crear)</a>
          </p>
        </>
      ) : (
        <button
          onClick={() =>
            login({ email: "demo@kontrolia.dev", password: "changeme" }).catch((err) => alert(err.message))
          }
        >
          Iniciar sesión de prueba
        </button>
      )}
    </main>
  );
}
