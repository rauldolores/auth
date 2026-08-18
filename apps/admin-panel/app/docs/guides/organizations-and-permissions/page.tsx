export const metadata = { title: "Organizaciones y permisos — KontrolIA Auth" };

export default function OrganizationsAndPermissionsPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Organizaciones y permisos</h1>

      <h2>Crear y cambiar de organización</h2>
      <p>
        La lista de organizaciones a las que pertenece un usuario <strong>no</strong> viene en el JWT (ver{" "}
        <a href="/docs/architecture">Arquitectura</a>) — <code>getMemberships()</code> la consulta aparte, con
        el rol y estado (<code>active</code>/<code>invited</code>/<code>suspended</code>) que tiene en cada una:
      </p>
      <pre>
        <code>{`const { organization, getMemberships, switchOrganization } = useAuth();

const memberships = await getMemberships();
// [{ id, organizationId, status, roles, organization: { id, name, slug, settings } }, ...]

await switchOrganization(memberships[0].organizationId); // refresca la sesión, el JWT trae los nuevos permisos`}</code>
      </pre>
      <pre>
        <code>{`import { OrgSwitcher } from "@kontrolia/ui";

<OrgSwitcher organizations={memberships.map(m => m.organization)} onSwitched={() => reload()} />`}</code>
      </pre>
      <p>
        Un backend separado que solo tiene el bearer token del usuario (sin cookies, sin sesión de navegador)
        puede pedir lo mismo con <code>listMemberships()</code> de <code>@kontrolia/auth/server</code> — el
        token mismo autentica la consulta contra Postgres vía Row Level Security, sin necesitar la service-role
        key:
      </p>
      <pre>
        <code>{`import { listMemberships } from "@kontrolia/auth/server";

const memberships = await listMemberships(request, { supabaseUrl, supabaseAnonKey });`}</code>
      </pre>

      <h2>Editar y eliminar una organización</h2>
      <p>
        Desde admin-panel (&quot;Organizaciones&quot;), un Owner o Admin puede renombrar cualquier organización a
        la que pertenece (<code>PATCH /api/organizations/&#123;id&#125;</code> — RLS lo aplica del lado del
        servidor, no solo la UI). Eliminarla es más delicado — borra en cascada todos sus miembros, roles,
        invitaciones y su historial de auditoría, sin poder deshacerse — así que está reservado solo al{" "}
        <code>Owner</code> (<code>DELETE /api/organizations/&#123;id&#125;</code>), con una confirmación que
        exige escribir el nombre exacto de la organización. auth-server ya no tiene su propia pantalla de
        inicio para esto — su ruta raíz redirige directo a admin-panel.
      </p>
      <p>
        <strong>Nota:</strong> antes había un lanzador de aplicaciones (mostrando solo las apps a las que un
        miembro tenía acceso) en la pantalla de inicio de auth-server. Al quitarla, un <code>Member</code> sin
        rol de Owner/Admin/platform admin se queda hoy sin ninguna forma de ver o lanzar sus aplicaciones desde
        la UI — admin-panel solo sirve a Owner/Admin/platform admin. Gap conocido, sin resolver todavía.
      </p>

      <h2>Listar, buscar y contar los miembros de una organización</h2>
      <p>
        Para una app externa (no admin-panel) que necesita mostrar quién pertenece a una organización —
        pensado para selectores de usuario, autocompletado, o solo un contador — sin construir el fetch al API
        REST a mano. Requiere configurar <code>authServerUrl</code> al crear el cliente (solo lo usan estos
        tres métodos; el resto del SDK no lo necesita, ya que hablan con Supabase directo):
      </p>
      <pre>
        <code>{`const client = createKontroliaClient({
  supabaseUrl, supabaseAnonKey,
  authServerUrl: "https://auth.tuempresa.com", // nuevo — requerido solo para lo de abajo
});`}</code>
      </pre>
      <pre>
        <code>{`const { listOrganizationMembers, searchOrganizationMembers, getOrganizationMemberCount } = useAuth();

const page = await listOrganizationMembers(organizationId);
// { members: [{ id, email, name }, ...], hasMore, total }

const results = await searchOrganizationMembers(organizationId, "ana");
// mismo shape, filtrado por coincidencia en email o nombre (sin distinguir mayúsculas)

const total = await getOrganizationMemberCount(organizationId); // número, camino rápido (no trae filas)`}</code>
      </pre>
      <p>
        <code>id</code> es el user id (<code>auth.users.id</code>), no el id de la membresía. <code>name</code>{" "}
        viene de <code>user_metadata.full_name</code> — <code>null</code> si la persona nunca lo capturó. Por
        debajo, los tres llaman a <code>GET /api/organization-members</code> con el token de sesión de quien
        esté logueado — solo ve organizaciones a las que ya pertenece (RLS), igual que{" "}
        <code>getMemberships()</code> arriba. Sin sesión iniciada, los tres regresan vacío/cero en vez de
        lanzar un error.
      </p>

      <h2>Roles: 3 de sistema + uno por aplicación por persona</h2>
      <p>
        <code>Owner</code>, <code>Admin</code> y <code>Member</code> son los 3 roles de sistema — generales de
        toda la instalación, no de una aplicación en particular, y sus permisos no se editan. Cualquier otro rol
        (personalizado o el "Administrador de &lt;app&gt;" que se crea solo) pertenece a exactamente una
        aplicación habilitada — así cada aplicación puede tener su propio catálogo de roles (por ejemplo,
        "Facturación → Contador") sin pisar los de otra. Una persona puede tener un rol distinto en cada
        aplicación (nunca dos roles a la vez para la misma aplicación — el segundo intento se rechaza), además
        de su rol de sistema.
      </p>
      <p>
        <strong>Solo Owner y Admin entran al admin-panel</strong> — es la consola que gestiona los accesos de
        toda la instalación, así que un <code>Member</code> no lo ve, aunque tenga un rol de "Administrador de
        &lt;app&gt;" en alguna aplicación específica (ese rol da permisos dentro de esa app, no acceso a esta
        consola). Los platform admins entran sin importar su rol de sistema en la organización activa.
      </p>
      <p>
        Al habilitar una aplicación para una organización (ver "Registrar el catálogo de permisos" más abajo),
        se crea automáticamente un rol "Administrador de &lt;app&gt;" con todos los permisos que esa aplicación
        declara — se mantiene sincronizado solo cada vez que la aplicación agrega un permiso nuevo a su catálogo,
        sin que nadie tenga que ir a marcarlo a mano. Owners/admins pueden crear roles personalizados adicionales
        para esa aplicación desde "Roles" en admin-panel, y gestionar quién tiene cuál desde "Usuarios".
      </p>

      <h2>Permisos jerárquicos</h2>
      <p>
        Cada permiso es una clave de tres segmentos: <code>aplicación.recurso.acción</code> — por ejemplo{" "}
        <code>facturacion.facturas.crear</code>. El motor en <code>@kontrolia/permissions</code> soporta dos
        formas de wildcard en el lado <em>otorgado</em>:
      </p>
      <ul>
        <li>
          <code>facturacion.facturas.*</code> — cualquier acción sobre facturas.
        </li>
        <li>
          <code>facturacion.**</code> — todo bajo facturación.
        </li>
      </ul>

      <h3>Proteger una ruta o componente</h3>
      <pre>
        <code>{`import { RequirePermission } from "@kontrolia/react";

<RequirePermission permission="facturacion.facturas.crear" fallback={<p>Sin permiso</p>}>
  <CrearFacturaForm />
</RequirePermission>`}</code>
      </pre>

      <h3>Proteger un backend propio</h3>
      <p>
        Un componente protegido en el frontend no protege datos — cualquiera puede leer el bundle de JS. Si tu
        app llama a un backend propio, ese backend tiene que verificar el token él mismo:
      </p>
      <pre>
        <code>{`import { requirePermission } from "@kontrolia/auth/server";

const { claims, checker, user } = await requirePermission(request, { supabaseUrl }, "facturacion.facturas.crear");
// lanza un Response 401/403 si no pasa`}</code>
      </pre>
      <p>
        Mismo patrón para Next.js Route Handlers, Express (ver{" "}
        <a href="/docs/examples">examples/express</a>) o NestJS (
        <a href="/docs/examples">examples/nestjs</a>) — el único código específico de cada framework es adaptar
        su objeto de request a un <code>Request</code> estándar.
      </p>
      <p>
        <code>user</code> viene con <code>email</code>, <code>fullName</code>, <code>avatarUrl</code>,{" "}
        <code>locale</code> y <code>timezone</code> — sin ninguna consulta extra, porque esos campos ya vienen
        en el token de Supabase. Es exactamente lo que necesita una ruta tipo <code>/api/auth/me</code> que arma
        el perfil del usuario del lado del servidor. La única excepción es <code>lastSeenAt</code>, que siempre
        viene <code>null</code> aquí — ese campo no vive en el JWT, solo en el objeto de sesión del navegador (
        <code>useAuth().user</code>).
      </p>

      <h2>Registrar el catálogo de permisos de una aplicación</h2>
      <p>
        Los permisos se declaran contra una fila en <code>kontrolia_auth.applications</code>. Una organización solo
        puede asignar, en sus roles, permisos de aplicaciones que tiene habilitadas (
        <code>application_organizations</code>).
      </p>
      <p>
        La primera vez, una aplicación se registra desde el instalador (paso opcional "3 de 3"), que además
        entrega una clave de sincronización. Con esa clave, la propia aplicación (Facturación, CRM, lo que sea)
        puede actualizar su catálogo de permisos desde su propio pipeline de despliegue cada vez que cambia — sin
        volver a tocar la base de datos de KontrolIA Auth ni re-correr el instalador. Ver la guía{" "}
        <a href="/docs/guides/application-registration">Registro de aplicaciones</a> para el contrato completo
        (formato del request, ejemplos en curl/Node) que tu aplicación necesita implementar.
      </p>
      <p>
        Registrar una aplicación la agrega al catálogo global — todavía no la habilita para ninguna
        organización en particular. Cualquier owner/admin de una organización entra a admin-panel → "Aplicaciones"
        y la habilita con un clic (misma idea que instalar una app de Slack en un workspace): recién ahí sus
        permisos aparecen en "Permisos" y se pueden asignar desde "Roles". Es una decisión de cada organización,
        no del platform admin — dos organizaciones distintas en la misma instalación pueden tener habilitadas
        aplicaciones completamente distintas.
      </p>
      <p>
        Esto es un concepto distinto al servidor OAuth 2.1 de GoTrue que ya usa KontrolIA Auth internamente para
        mantener auth-server y admin-panel con la sesión sincronizada entre dominios (ver{" "}
        <a href="/docs/architecture">Arquitectura</a>). Registrar una app como cliente OAuth (para que inicie
        sesión contra KontrolIA Auth) se hace desde admin-panel — sección "Clientes OAuth" del menú, visible
        solo para platform admins — sin necesitar acceso directo a la base de datos ni la service-role key. Ver{" "}
        <a href="/docs/guides/connect-your-app">Conectar tu aplicación</a>.
      </p>

      <h2>Revocación de permisos: por qué no es instantánea</h2>
      <p>
        Los permisos viven en el JWT, que es de vida corta (por defecto 1 hora) pero sigue siendo válido hasta
        que expira — la limitación estándar de cualquier sistema basado en JWT stateless (Auth0 y Clerk tienen
        la misma). Para una acción especialmente sensible (borrar datos, cambiar de plan, etc.), no confíes solo
        en el claim del token: vuelve a consultar <code>kontrolia_auth.role_permissions</code>/
        <code>user_permissions</code> directo en la base antes de ejecutarla.
      </p>
    </article>
  );
}
