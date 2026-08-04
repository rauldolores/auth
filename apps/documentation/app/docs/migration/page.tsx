export const metadata = { title: "Migración — KontrolIA Auth" };

export default function MigrationPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Migrar una app existente</h1>
      <p>
        No hay una herramienta de migración automática de datos todavía — esta guía cubre el camino manual,
        razonable para la mayoría de los casos porque KontrolIA Auth no reemplaza tu base de datos de negocio,
        solo la de usuarios/autenticación.
      </p>

      <h2>1. Usuarios con contraseña</h2>
      <p>
        Supabase Auth no acepta hashes de contraseña de otro sistema directamente. Dos caminos:
      </p>
      <ul>
        <li>
          <strong>Reset forzado</strong>: crea los usuarios vía la Admin API de Supabase (
          <code>auth.admin.createUser</code>) sin contraseña utilizable, y dispara un correo de
          &quot;recupera tu contraseña&quot; a todos en el primer login.
        </li>
        <li>
          <strong>Migración de hash</strong>: si tu sistema anterior usa bcrypt (el mismo algoritmo que
          GoTrue), es posible insertar el hash directo en <code>auth.users.encrypted_password</code> vía acceso
          directo a Postgres — evalúa esto caso por caso, no es una ruta soportada por API.
        </li>
      </ul>

      <h2>2. Organizaciones y membresías</h2>
      <p>
        Mapea tus tenants/equipos actuales a <code>kontrolia.organizations</code>, y las relaciones
        usuario-tenant a <code>kontrolia.memberships</code> + <code>membership_roles</code>. Como son tablas
        Postgres normales (dentro del schema <code>kontrolia</code>), un script de migración es un INSERT
        masivo directo, respetando las foreign keys.
      </p>

      <h2>3. Permisos</h2>
      <p>
        Diseña tu catálogo de permisos como claves jerárquicas <code>aplicación.recurso.acción</code> (ver{" "}
        <a href="/docs/guides/organizations-and-permissions">Organizaciones y permisos</a>) antes de migrar
        roles — es más fácil mapear un sistema de permisos plano hacia esta jerarquía que al revés.
      </p>

      <h2>4. Tu aplicación</h2>
      <p>
        Reemplaza tu lógica de auth actual por el SDK: <code>npm install @kontrolia/react</code>, envuelve tu
        app en <code>&lt;AuthProvider&gt;</code>, cambia tus checks de permisos a{" "}
        <code>&lt;RequirePermission&gt;</code>/<code>hasPermission()</code>. Si tienes un backend propio, agrega{" "}
        <code>requirePermission()</code> de <code>@kontrolia/auth/server</code> en las rutas que antes
        verificaban sesión a mano.
      </p>

      <h2>5. Corre ambos sistemas en paralelo (recomendado)</h2>
      <p>
        Para una migración sin downtime: despliega KontrolIA Auth, migra usuarios progresivamente (por
        ejemplo, en el primer login exitoso con el sistema viejo), y solo apaga el sistema anterior cuando la
        cola de usuarios sin migrar sea manejable.
      </p>
    </article>
  );
}
