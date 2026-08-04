# @kontrolia/ui

Componentes de UI compartidos (React + Tailwind) de [KontrolIA Auth](https://github.com/rauldolores/auth): formularios de login/registro/recuperar-contraseña, `OrgSwitcher`, `UserMenu`, `Avatar`, `Badge`, `Card`, `AuthShell`, y pantallas 401/403/sesión-expirada.

## Instalación

```bash
npm install @kontrolia/ui @kontrolia/react
```

Requiere Tailwind con el preset compartido (`@kontrolia/config/tailwind/preset`) y las variables CSS de tema (`--k-*`) — ver la guía de instalación del monorepo.

## Uso

```tsx
import { AuthShell, LoginForm } from "@kontrolia/ui";

export default function LoginPage() {
  return (
    <AuthShell title="Inicia sesión" subtitle="Continúa con tu cuenta o correo.">
      <LoginForm forgotPasswordHref="/forgot-password" registerHref="/register" showGoogle />
    </AuthShell>
  );
}
```

Todos los componentes leen el estado de sesión de `@kontrolia/react`'s `useAuth()` internamente — no necesitas pasarles props de usuario/organización manualmente.

## Documentación

Ver la [guía completa](https://github.com/rauldolores/auth) del monorepo.
