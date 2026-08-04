# @kontrolia/react

Bindings de React para [KontrolIA Auth](https://github.com/rauldolores/auth): `<AuthProvider>`, `<AuthGuard>`, `<GuestGuard>`, `<RequireRole>`, `<RequirePermission>` y el hook `useAuth()`.

## Instalación

```bash
npm install @kontrolia/react @kontrolia/auth
```

## Uso

```tsx
import { AuthProvider, AuthGuard, useAuth } from "@kontrolia/react";

function App() {
  return (
    <AuthProvider config={{ supabaseUrl, supabaseAnonKey }}>
      <AuthGuard fallback={<LoginPage />}>
        <Dashboard />
      </AuthGuard>
    </AuthProvider>
  );
}

function Dashboard() {
  const { user, organization, hasPermission, logout } = useAuth();
  if (!hasPermission("facturacion.facturas.crear")) return null;
  // ...
}
```

`<RequirePermission>` / `<RequireRole>` renderizan condicionalmente según los claims del JWT (roles/permisos de la organización activa), sin round-trip al servidor.

## Documentación

Ver la [guía completa](https://github.com/rauldolores/auth) del monorepo.
