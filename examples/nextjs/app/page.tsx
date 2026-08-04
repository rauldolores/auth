"use client";

import { useAuth } from "@kontrolia/react";
import { useState } from "react";

export default function HomePage() {
  const { isAuthenticated, user, login, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    }
  }

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
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 280 }}>
          <p>Usa la misma cuenta que creaste en auth-server (localhost:3000) — cada app tiene su propia sesión de navegador.</p>
          <input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p style={{ color: "red" }}>{error}</p>}
          <button type="submit">Iniciar sesión</button>
        </form>
      )}
    </main>
  );
}
