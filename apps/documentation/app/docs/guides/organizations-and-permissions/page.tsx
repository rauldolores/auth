export const metadata = { title: "Organizaciones y permisos — KontrolIA Auth" };

export default function OrganizationsAndPermissionsPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Organizaciones y permisos</h1>

      <h2>Crear y cambiar de organización</h2>
      <pre>
        <code>{`const { organization, switchOrganization } = useAuth();

await switchOrganization(otherOrgId); // refresca la sesión, el JWT trae los nuevos permisos`}</code>
      </pre>
      <p>
        La lista de organizaciones a las que pertenece un usuario <strong>no</strong> viene en el JWT (ver{" "}
        <a href="/docs/architecture">Arquitectura</a>) — se consulta aparte. <code>auth-server</code> expone{" "}
        <code>GET /api/organizations</code>; en <code>admin-panel</code> se consulta directo el schema{" "}
        <code>kontrolia</code> vía RLS.
      </p>
      <pre>
        <code>{`import { OrgSwitcher } from "@kontrolia/ui";

<OrgSwitcher organizations={organizations} onSwitched={() => reload()} />`}</code>
      </pre>

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

const { claims } = await requirePermission(request, { supabaseUrl }, "facturacion.facturas.crear");
// lanza un Response 401/403 si no pasa`}</code>
      </pre>
      <p>
        Mismo patrón para Next.js Route Handlers, Express (ver{" "}
        <a href="/docs/examples">examples/express</a>) o NestJS (
        <a href="/docs/examples">examples/nestjs</a>) — el único código específico de cada framework es adaptar
        su objeto de request a un <code>Request</code> estándar.
      </p>

      <h2>Registrar el catálogo de permisos de una aplicación</h2>
      <p>
        Los permisos se declaran contra una fila en <code>kontrolia.applications</code>. Una organización solo
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
        Esto es un concepto distinto al servidor OAuth 2.1 de GoTrue que ya usa KontrolIA Auth internamente para
        mantener auth-server y admin-panel con la sesión sincronizada entre dominios (ver{" "}
        <a href="/docs/architecture">Arquitectura</a>). Una pantalla en admin-panel para que una organización
        registre <em>sus propias</em> aplicaciones de terceros como clientes OAuth (client_id/secret, para que
        inicien sesión contra KontrolIA) sigue en el roadmap — hoy ese registro se hace a mano contra la API de
        GoTrue (ver el comando <code>curl</code> en <a href="/docs/getting-started">Instalación</a>).
      </p>

      <h2>Revocación de permisos: por qué no es instantánea</h2>
      <p>
        Los permisos viven en el JWT, que es de vida corta (por defecto 1 hora) pero sigue siendo válido hasta
        que expira — la limitación estándar de cualquier sistema basado en JWT stateless (Auth0 y Clerk tienen
        la misma). Para una acción especialmente sensible (borrar datos, cambiar de plan, etc.), no confíes solo
        en el claim del token: vuelve a consultar <code>kontrolia.role_permissions</code>/
        <code>user_permissions</code> directo en la base antes de ejecutarla.
      </p>
    </article>
  );
}
