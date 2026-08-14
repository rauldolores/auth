export const metadata = { title: "Ejemplos — KontrolIA Auth" };

export default function ExamplesPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Ejemplos</h1>
      <p>
        Cuatro apps de referencia en <code>examples/</code>, todas protegiendo la misma ruta por el mismo
        permiso (<code>facturacion.facturas.crear</code>) para que sea fácil comparar el patrón entre stacks.
      </p>

      <h2>examples/nextjs</h2>
      <p>
        La integración de referencia. <code>middleware.ts</code> con <code>createAuthMiddleware()</code>,{" "}
        <code>&lt;AuthProvider&gt;</code>, y <code>&lt;RequirePermission&gt;</code> en la página protegida.
        Ningún archivo importa <code>supabase-js</code> ni maneja un JWT directamente.
      </p>

      <h2>examples/react</h2>
      <p>
        Mismo <code>@kontrolia/react</code>, pero en una SPA de Vite — sin <code>@kontrolia/next</code>, sin
        middleware, sin servidor propio. Protección de rutas puramente del lado del cliente: el componente no
        se renderiza sin el permiso, pero el bundle de JS sigue siendo público. Motiva los dos ejemplos
        siguientes.
      </p>

      <h2>examples/express</h2>
      <p>
        Un backend Express que protege una ruta con <code>requirePermission()</code> de{" "}
        <code>@kontrolia/auth/server</code> — la misma función que usaría un Route Handler de Next.js, sin
        depender de Next.js para nada. El único código específico de Express es un adaptador de ~10 líneas de{" "}
        <code>req</code> a un <code>Request</code> estándar.
      </p>

      <h2>examples/nestjs</h2>
      <p>
        Un <code>KontroliaAuthGuard</code> + decorator <code>@RequirePermission()</code> sobre el mismo
        primitivo, en el patrón idiomático de Nest (<code>@UseGuards</code>).
      </p>

      <h2>Probar un backend con curl</h2>
      <p>Consigue un access token real (por ejemplo desde el `getToken()` del SDK en cualquiera de los ejemplos de frontend), luego:</p>
      <pre>
        <code>{`curl http://localhost:5001/api/facturas -H "Authorization: Bearer <token>"
# 401 sin token, 403 sin el permiso, 200 con el permiso`}</code>
      </pre>
    </article>
  );
}
