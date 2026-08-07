# KontrolIA Auth

[![npm](https://img.shields.io/npm/v/%40kontrolia%2Fauth)](https://www.npmjs.com/package/@kontrolia/auth)
[![license](https://img.shields.io/npm/l/%40kontrolia%2Fauth)](LICENSE)

**Sistema de inicio de sesión, usuarios, organizaciones y permisos, listo para instalar en tu aplicación en unos 15 minutos.**

Si tu aplicación necesita que la gente pueda registrarse, iniciar sesión, formar equipos/organizaciones, e invitar a otras personas con distintos niveles de acceso (por ejemplo "puede ver facturas" vs "puede crear facturas"), normalmente eso significa construir y mantener tú mismo todo un sistema de seguridad — contraseñas, recuperación de cuenta, verificación de correo, permisos, sesiones... KontrolIA Auth hace ese trabajo por ti, como una pieza que se conecta a tu aplicación en vez de algo que tienes que programar desde cero.

Es **Open Source** (código abierto, gratis de usar y modificar), y tú controlas dónde vive tu información — no depende de que una empresa externa siga existiendo para que tu aplicación funcione.

## ¿Para quién es esto?

- **¿Vas a instalarlo/administrarlo, pero no programas?** No necesitas escribir código para el día a día — una vez instalado, hay un panel de administración visual donde se gestionan usuarios, organizaciones y permisos con clics, igual que un panel de control de cualquier otro servicio online. Ve directo a [Instalación en 15 minutos](#instalación-en-15-minutos).
- **¿Eres desarrollador/a integrando esto en una app React o Next.js?** Tu aplicación nunca necesita hablar directamente con la base de datos de usuarios ni con protocolos de login — usas el SDK oficial (`@kontrolia/auth`, `@kontrolia/react`, `@kontrolia/next`), ya publicado en npm. Ve a [Para desarrolladores](#para-desarrolladores).

## Instalación en 15 minutos

No necesitas experiencia previa con bases de datos ni con Docker para seguir estos pasos — el instalador te va guiando y explicando cada pregunta.

```bash
npx create-kontrolia-auth
```

Este comando descarga y ejecuta el instalador oficial (no instala nada permanente en tu computadora, solo corre una vez). Te va a preguntar, en orden:

1. **¿De dónde sale tu base de datos de usuarios?** — KontrolIA Auth guarda la información (usuarios, organizaciones, permisos) usando [Supabase](https://supabase.com), un servicio de bases de datos. Tienes dos caminos, y ninguno es "más correcto" que el otro:
   - **Ya tengo un proyecto Supabase** (por ejemplo si creaste una cuenta gratis en supabase.com): pegas la URL y las claves que Supabase te dio, y el instalador prepara tu proyecto sin tocar nada que ya tengas ahí.
   - **No tengo uno / quiero probar primero**: el instalador puede levantar una base de datos en tu propia computadora usando Docker (una herramienta que empaqueta programas listos para correr). Perfecto para probar antes de decidir dónde vivirá en producción.
2. **¿Dónde va a vivir la aplicación web (las pantallas de login y el panel de administración)?** — puede ser tu propia computadora (para probar), o un servicio de hosting como Vercel, Railway, Coolify, o cualquier servidor propio. Con esta respuesta, el instalador configura automáticamente que ambas pantallas mantengan la sesión sincronizada — incluso si terminan viviendo en dominios completamente distintos, no solo subdominios de uno mismo.
3. **(Opcional) Registra tu primera aplicación** — le pones un nombre (por ejemplo "Mi App") y defines qué acciones puede permitir o restringir (por ejemplo "crear factura", "ver reportes"). Puedes omitir este paso y hacerlo después.

Al terminar, tendrás dos pantallas abiertas en tu navegador:

- **La pantalla de inicio de sesión** — donde te registras y creas tu primera organización (equipo/empresa). La persona que crea la organización queda automáticamente como su administradora.
- **El panel de administración** — donde gestionas usuarios, roles, permisos e invitaciones con clics, sin tocar código.

📖 La guía completa, con capturas y explicaciones más detalladas de cada paso, está en **[la documentación](apps/documentation)** (o córrela localmente con `pnpm --filter @kontrolia/documentation dev`).

## Para desarrolladores

El SDK es la única forma soportada de integrar tu aplicación — nunca importas Supabase, manejas un redirect de OAuth, ni decodificas un JWT directamente.

```bash
npm install @kontrolia/auth @kontrolia/react
```

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
  const { user, organization, hasPermission } = useAuth();
  if (!hasPermission("facturacion.facturas.crear")) return null;
  // ...
}
```

### ¿Tu app vive en un dominio distinto al de auth-server?

Si tu aplicación (propia, o un SaaS de terceros de tu ecosistema) necesita que sus usuarios inicien sesión a
través de auth-server pero vive en un dominio completamente distinto, no basta con una cookie compartida — usa
el servidor OAuth 2.1 nativo de KontrolIA Auth (el mismo mecanismo que ya usa el panel de administración). Guía
completa, con el registro del cliente y el código exacto: [Conectar tu aplicación](apps/documentation/app/docs/guides/connect-your-app).

### ¿Tu aplicación declara sus propios permisos?

Si tu app tiene su propio catálogo de permisos (por ejemplo `facturacion.facturas.crear`) y ese catálogo puede
cambiar de un despliegue a otro, no hace falta que un operador de KontrolIA Auth lo edite a mano: tu aplicación
puede mantenerlo sincronizado ella misma, desde su propio pipeline de CI/CD, llamando a un endpoint con una clave
que se te entrega al registrarla.

```bash
curl -X POST "$AUTH_SERVER_URL/api/applications/sync" \
  -H "Authorization: Bearer $KONTROLIA_APPLICATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug":"facturacion","permissions":[{"resource":"facturas","action":"crear"}]}'
```

Guía completa (cómo se registra la primera vez, el contrato exacto del request, ejemplos en Node): [Registro de aplicaciones](apps/documentation/app/docs/guides/application-registration).

Paquetes publicados en npm bajo el scope `@kontrolia`:

| Paquete | Para qué |
|---|---|
| [`@kontrolia/auth`](https://www.npmjs.com/package/@kontrolia/auth) | SDK core, sin depender de ningún framework |
| [`@kontrolia/react`](https://www.npmjs.com/package/@kontrolia/react) | `<AuthProvider>`, `<AuthGuard>`, `<RequirePermission>`, `useAuth()` |
| [`@kontrolia/next`](https://www.npmjs.com/package/@kontrolia/next) | Middleware de rutas y helpers para Next.js |
| [`@kontrolia/ui`](https://www.npmjs.com/package/@kontrolia/ui) | Componentes de login/registro/etc. ya armados |
| [`@kontrolia/permissions`](https://www.npmjs.com/package/@kontrolia/permissions) | Motor de evaluación de permisos jerárquicos |
| [`@kontrolia/db`](https://www.npmjs.com/package/@kontrolia/db) | Migraciones SQL y runner de base de datos |
| [`create-kontrolia-auth`](https://www.npmjs.com/package/create-kontrolia-auth) | El instalador (`npx create-kontrolia-auth`) |

Guías por stack (Next.js, React/Vite, Express, NestJS como backend) en [la documentación](apps/documentation).

## Estructura del monorepo

Este repositorio es el código fuente del propio KontrolIA Auth — solo lo necesitas si vas a contribuir o correrlo desde código en vez de usar los paquetes de npm / el instalador.

```
apps/
  auth-server/     # UI de login/registro/recuperación + API de orquestación (Next.js)
  admin-panel/     # Panel de administración (Next.js)
  documentation/   # Este sitio de documentación
  playground/      # Sandbox para probar el SDK en vivo
packages/
  auth-sdk/        # @kontrolia/auth — core sin framework
  react-sdk/       # @kontrolia/react — AuthProvider, guards, useAuth()
  next-sdk/        # @kontrolia/next — middleware y helpers de Next.js
  ui/              # @kontrolia/ui — componentes compartidos
  permissions/     # @kontrolia/permissions — motor de evaluación RBAC
  db/              # @kontrolia/db — migraciones SQL, RLS, Custom Access Token Hook
  shared/          # @kontrolia/shared — tipos y utilidades comunes
  cli/             # create-kontrolia-auth — instalador
  config/          # Presets internos de eslint/tsconfig/tailwind (no se publica)
examples/
  nextjs/ react/ express/ nestjs/
docker/            # docker-compose mínimo (Postgres + GoTrue) para instalación self-hosted
```

### Correr el monorepo localmente

```bash
pnpm install
pnpm dev
```

## Licencia

MIT — úsalo, modifícalo y despliégalo donde quieras.
