export const metadata = { title: "Arquitectura — KontrolIA Auth" };

export default function ArchitecturePage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Arquitectura</h1>

      <h2>El schema kontrolia_auth</h2>
      <p>
        Todas las tablas propias viven en un schema Postgres dedicado, <code>kontrolia_auth</code>, nunca en{" "}
        <code>public</code>. Eso hace que instalar sobre un proyecto Supabase que ya tiene tablas de tu
        aplicación sea no-destructivo, y que desinstalar sea un <code>drop schema kontrolia_auth cascade</code>.
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
        <code>kontrolia_auth.custom_access_token_hook</code> dentro de la misma transacción, sin round-trip de red.
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

      <h2>Platform admins: la única claim cross-tenant</h2>
      <p>
        Todo lo anterior es deliberadamente scoped a una sola organización — no hay forma de que{" "}
        <code>roles</code>/<code>permissions</code> digan nada sobre más de una a la vez. Pero una consola
        operativa (soporte, monitoreo, facturación de la plataforma) sí necesita ver <em>todas</em> las
        organizaciones. En vez de que cada aplicación invente su propio permiso tipo{" "}
        <code>facturacion.admin.ver_todo</code> — cada uno con su propio criterio de qué significa "admin" — hay
        una única claim reservada, fuera del namespace <code>&lt;app&gt;.&lt;recurso&gt;.&lt;acción&gt;</code>:
      </p>
      <pre>
        <code>{`is_platform_admin: boolean`}</code>
      </pre>
      <p>
        Alimentada por <code>kontrolia_auth.platform_admins</code> (un <code>user_id</code> por fila). El primer
        usuario que se registra en una instalación nueva queda ahí automáticamente — un trigger en{" "}
        <code>auth.users</code> (<code>bootstrap_first_platform_admin()</code>, migración 0017) lo detecta
        contando que es literalmente el primer signup de la instalación, no solo "la tabla está vacía", para que
        revocar al único admin más adelante no se lo regale en silencio a quien se registre después. De ahí en
        adelante, agregar o quitar a alguien más se hace desde admin-panel → "Platform admins" (ver{" "}
        <a href="/docs/guides/connect-your-app">Conectar tu aplicación</a>) — nadie necesita tocar la base de
        datos, ni para el primer admin ni para los siguientes. El hook calcula la claim igual que{" "}
        <code>roles</code>/<code>permissions</code>, así que también queda tan fresca como el token (hasta su
        TTL). Del lado del cliente: <code>client.isPlatformAdmin()</code>; del lado del servidor,{" "}
        <code>claims.is_platform_admin</code> de <code>verifyRequest()</code>. Qué hace tu aplicación con ese
        booleano — qué endpoints desbloquea, qué bypassea RLS vía service-role — sigue siendo decisión tuya;
        KontrolIA Auth solo garantiza que la identidad es confiable.
      </p>

      <h2>RLS: quién puede ver/escribir qué</h2>
      <p>
        Cada tabla tiene Row Level Security. El patrón general: los miembros de una organización pueden ver
        sus propios datos; solo Owner/Admin pueden escribir. Dos funciones helper (
        <code>kontrolia_auth.is_org_member(org_id)</code>, <code>kontrolia_auth.is_org_admin(org_id)</code>) evalúan esto
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

      <h2>SSO entre auth-server y cualquier app cliente</h2>
      <p>
        auth-server y admin-panel son dos apps Next.js separadas (ver{" "}
        <a href="/docs/faq">FAQ, "¿por qué dos proyectos?"</a>) que necesitan compartir la misma sesión — pero
        el mecanismo que las conecta no es exclusivo de ellas dos. Cualquier aplicación (propia, o un SaaS de
        terceros dentro de tu ecosistema) que quiera que sus usuarios inicien sesión vía auth-server usa
        exactamente el mismo camino; admin-panel es solo el ejemplo que ya viene resuelto de fábrica. Ver{" "}
        <a href="/docs/guides/connect-your-app">Conectar tu aplicación</a> para el paso a paso genérico. Hay dos
        mecanismos, y cuál se usa depende de dónde viva la app cliente:
      </p>
      <ul>
        <li>
          <strong>Mismo host o subdominios de un mismo dominio</strong>: la cookie de sesión (ver arriba) ya
          alcanza. Con subdominios distintos hace falta fijar <code>NEXT_PUBLIC_COOKIE_DOMAIN</code> a{" "}
          <code>.tudominio.com</code> en ambas apps para que el navegador la comparta entre ellas. Cuando
          admin-panel no encuentra sesión, redirige de inmediato (sin pantalla intermedia) a{" "}
          <code>{`{authServerUrl}/login?redirect_to={url_actual}`}</code>; auth-server valida ese{" "}
          <code>redirect_to</code> contra una lista de orígenes conocidos (
          <code>apps/auth-server/lib/redirect.ts</code>) antes de navegar ahí — nunca sigue una URL arbitraria de
          la query string, para no abrir un open-redirect.
        </li>
        <li>
          <strong>Dominios genuinamente distintos</strong>: una cookie no puede cruzar esa frontera bajo ninguna
          configuración — es el modelo de seguridad del navegador, no algo que este proyecto pueda evitar. Para
          ese caso, admin-panel actúa como cliente OAuth 2.1 del servidor de autorización nativo de GoTrue
          (Supabase Auth): genera un par PKCE, redirige a{" "}
          <code>{`{supabaseUrl}/auth/v1/oauth/authorize`}</code>, auth-server muestra{" "}
          <code>/oauth/consent</code> (auto-aprobado si el <code>redirect_uri</code> es del propio admin-panel;
          con pantalla de aprobar/denegar si es un cliente de verdad de terceros), y admin-panel cambia el código
          por su propia sesión en <code>/oauth/callback</code>. El token emitido por este flujo lleva los mismos
          claims custom (<code>organization_id</code>, <code>roles</code>, <code>permissions</code>) que uno
          emitido por login normal, porque corre por el mismo Custom Access Token Hook.
        </li>
      </ul>
      <p>
        El instalador registra automáticamente admin-panel como cliente OAuth durante la instalación (ver{" "}
        <a href="/docs/getting-started">Instalación</a>) y elige el mecanismo disponible; si el proyecto Supabase
        no tiene el servidor OAuth habilitado, cae de vuelta al primer mecanismo sin romper nada.
      </p>

      <h2>Revocar una sesión específica</h2>
      <p>
        No existe un método admin de <code>supabase-js</code> para revocar un <code>session_id</code>{" "}
        arbitrario. La forma documentada es correlacionar el claim <code>session_id</code> del JWT con{" "}
        <code>auth.sessions.id</code> y borrar ese renglón directamente.{" "}
        <code>kontrolia_auth.revoke_session(session_id)</code> hace exactamente eso — verifica que la sesión
        pertenezca al llamador (vía <code>kontrolia_auth.devices</code>) antes de borrar, expuesta como RPC.
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
