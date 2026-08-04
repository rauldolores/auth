import { RequirePermission, useAuth } from "@kontrolia/react";
import { useState } from "react";

/**
 * No middleware here — a Vite SPA has no server to run one on. Route
 * protection with <RequirePermission> is real (the UI won't render
 * protected content without the permission), but it's still
 * client-side-only: a determined user can read the SPA's JS bundle. Any
 * data this app fetches from its own backend must be protected there too,
 * with verifyRequest()/requirePermission() from @kontrolia/auth/server —
 * see examples/express and examples/nestjs.
 */
export function App() {
  const { isAuthenticated, user, login, logout } = useAuth();
  const [view, setView] = useState<"home" | "facturas">("home");
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

  if (!isAuthenticated) {
    return (
      <main style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
        <h1>App de Facturación (ejemplo React/Vite)</h1>
        <p>Esta app nunca importa supabase-js, ni conoce OAuth o JWT — solo usa @kontrolia/react.</p>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 280 }}>
          <p>Usa la misma cuenta que creaste en auth-server (localhost:3000).</p>
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
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>App de Facturación (ejemplo React/Vite)</h1>
      <p>Sesión activa: {user?.email}</p>
      <nav style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setView("home")}>Inicio</button>
        <button onClick={() => setView("facturas")}>Facturas</button>
        <button onClick={() => void logout()}>Cerrar sesión</button>
      </nav>
      {view === "facturas" && (
        <RequirePermission
          permission="facturacion.facturas.crear"
          fallback={<p>No tienes permiso para crear facturas.</p>}
        >
          <h2>Crear factura</h2>
          <p>Ruta protegida por permiso, no por rol — solo &lt;RequirePermission&gt; del SDK.</p>
        </RequirePermission>
      )}
    </main>
  );
}
