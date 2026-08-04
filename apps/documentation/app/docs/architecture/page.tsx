export const metadata = { title: "Arquitectura — KontrolIA Auth" };

export default function ArchitecturePage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Arquitectura</h1>

      <h2>El schema kontrolia</h2>
      <p>
        Todas las tablas propias viven en un schema Postgres dedicado, <code>kontrolia</code>, nunca en{" "}
        <code>public</code>. Eso hace que instalar sobre un proyecto Supabase que ya tiene tablas de tu
        aplicación sea no-destructivo, y que desinstalar sea un <code>drop schema kontrolia cascade</code>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Tabla</th>
            <th>Qué guarda</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>organizations</code>
            </td>
            <td>Tenants — un usuario pertenece a varias vía <code>memberships</code></td>
          </tr>
          <tr>
            <td>
              <code>applications</code> / <code>permissions</code>
            </td>
            <td>Catálogo de permisos jerárquicos, declarado por aplicación registrada</td>
          </tr>
          <tr>
            <td>
              <code>roles</code> / <code>role_permissions</code>
            </td>
            <td>Roles de sistema (Owner/Admin/Member, compartidos) y roles custom por organización</td>
          </tr>
          <tr>
            <td>
              <code>memberships</code> / <code>membership_roles</code>
            </td>
            <td>Pertenencia de un usuario a una organización, y qué roles tiene ahí</td>
          </tr>
          <tr>
            <td>
              <code>user_permissions</code>
            </td>
            <td>Overrides puntuales allow/deny sobre lo que otorgan los roles</td>
          </tr>
          <tr>
            <td>
              <code>invitations</code>
            </td>
            <td>Invitaciones pendientes/aceptadas/expiradas</td>
          </tr>
          <tr>
            <td>
              <code>sessions_context</code>
            </td>
            <td>Qué organización está activa para cada usuario ahora mismo</td>
          </tr>
          <tr>
            <td>
              <code>devices</code>
            </td>
            <td>Un renglón por sesión de Supabase, para listar/revocar dispositivos</td>
          </tr>
          <tr>
            <td>
              <code>audit_logs</code>
            </td>
            <td>Trail de auditoría, escrito solo por triggers (ninguna app puede insertar directo)</td>
          </tr>
        </tbody>
      </table>

      <h2>El Custom Access Token Hook</h2>
      <p>
        Cada vez que Supabase Auth emite un JWT (login o refresh), Postgres ejecuta{" "}
        <code>kontrolia.custom_access_token_hook</code> dentro de la misma transacción, sin round-trip de red.
        Agrega tres claims:
      </p>
      <ul>
        <li>
          <code>organization_id</code> — la organización <em>activa</em> del usuario, nunca todas las que
          pertenece.
        </li>
        <li>
          <code>roles</code> — los roles de esa membresía.
        </li>
        <li>
          <code>permissions</code> — la unión de permisos de esos roles, más overrides <code>allow</code>,
          menos overrides <code>deny</code>.
        </li>
      </ul>
      <p>
        <strong>Por qué solo la organización activa, no todas:</strong> un usuario en 50 organizaciones no
        necesita un JWT con los permisos de las 50 — eso infla el token y filtra qué organizaciones existen
        entre tenants. <code>switchOrganization()</code> actualiza <code>sessions_context</code> y fuerza un
        refresh de sesión, así que el hook vuelve a correr con la nueva organización activa.
      </p>

      <h2>RLS: quién puede ver/escribir qué</h2>
      <p>
        Cada tabla tiene Row Level Security. El patrón general: los miembros de una organización pueden ver
        sus propios datos; solo Owner/Admin pueden escribir. Dos funciones helper (
        <code>kontrolia.is_org_member(org_id)</code>, <code>kontrolia.is_org_admin(org_id)</code>) evalúan esto
        contra <code>auth.uid()</code>.
      </p>
      <p>
        <code>audit_logs</code> es la excepción deliberada: no tiene ninguna policy de <code>INSERT</code> para
        ningún rol — solo las funciones <code>SECURITY DEFINER</code> de los triggers pueden escribir ahí, así
        que ni siquiera un admin puede insertar un renglón de auditoría falso desde la aplicación.
      </p>

      <h2>Bootstrapping de organizaciones</h2>
      <p>
        Crear una organización tiene un problema de huevo-y-gallina: la policy de <code>INSERT</code> en{" "}
        <code>memberships</code> exige ser admin de esa organización, pero al crearla todavía no existe ningún
        membership. Un trigger <code>after insert</code> en <code>organizations</code> resuelve esto
        automáticamente: inscribe al creador como <code>Owner</code> en la misma transacción.
      </p>

      <h2>Sesión compartida: cookies, no localStorage</h2>
      <p>
        El SDK usa <code>@supabase/ssr</code>'s <code>createBrowserClient</code> (no el <code>createClient</code>{" "}
        plano de <code>supabase-js</code>), porque la sesión tiene que vivir en cookies para que{" "}
        <code>@kontrolia/next</code>'s middleware y los Route Handlers del servidor la puedan leer. Un cliente
        basado en <code>localStorage</code> deja al servidor completamente ciego a que el usuario está
        autenticado.
      </p>

      <h2>Revocar una sesión específica</h2>
      <p>
        No existe un método admin de <code>supabase-js</code> para revocar un <code>session_id</code>{" "}
        arbitrario. La forma documentada es correlacionar el claim <code>session_id</code> del JWT con{" "}
        <code>auth.sessions.id</code> y borrar ese renglón directamente.{" "}
        <code>kontrolia.revoke_session(session_id)</code> hace exactamente eso — verifica que la sesión
        pertenezca al llamador (vía <code>kontrolia.devices</code>) antes de borrar, expuesta como RPC.
      </p>

      <h2>Auditoría: triggers, no llamadas desde la aplicación</h2>
      <p>
        <code>audit_logs</code> se llena por triggers <code>AFTER INSERT/UPDATE/DELETE</code> en las tablas
        relevantes, no porque cada endpoint recuerde llamar una función de logging. Es la diferencia entre un
        registro de auditoría confiable y uno que se rompe silenciosamente el día que alguien olvida la llamada.
      </p>
    </article>
  );
}
