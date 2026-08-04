# Ejemplo: React (Vite)

Mismo `@kontrolia/react` que el ejemplo de Next.js, pero en una SPA pura — sin `@kontrolia/next`, sin middleware, sin servidor propio.

```bash
cp .env.example .env.local   # apunta al Supabase de tu instalación KontrolIA
pnpm install
pnpm --filter @kontrolia/example-react dev
```

`http://localhost:4001` → inicia sesión con la misma cuenta de los otros ejemplos → "Facturas" muestra "Crear factura" si tienes el permiso `facturacion.facturas.crear`.

## Diferencia importante con el ejemplo de Next.js

Aquí no hay middleware protegiendo rutas en el servidor, porque una SPA no tiene servidor propio — `<RequirePermission>` protege qué se **renderiza**, pero el bundle de JS sigue siendo público. Si esta app llamara a un backend propio para leer/escribir datos de facturación, ese backend tiene que verificar el token él mismo — ver [`examples/express`](../express) y [`examples/nestjs`](../nestjs), que usan `verifyRequest()`/`requirePermission()` de `@kontrolia/auth/server` exactamente para eso.
