export const metadata = { title: "Registro de aplicaciones — KontrolIA Auth" };

export default function ApplicationRegistrationPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Registro de aplicaciones</h1>
      <p>
        Cada aplicación cliente (Facturación, CRM, Inventarios...) declara su propio catálogo de permisos
        jerárquicos — por ejemplo <code>facturacion.facturas.crear</code>. Esta guía es para quien mantiene esa
        aplicación: cómo darla de alta la primera vez, y cómo mantener su catálogo sincronizado cada vez que
        agrega o cambia permisos, sin depender de que un operador de KontrolIA Auth toque la base de datos por
        ti.
      </p>

      <h2>Primera vez: alta desde el instalador</h2>
      <p>
        Quien instala/administra KontrolIA Auth registra tu aplicación una sola vez, con el paso opcional "3 de
        3" de <code>npx create-kontrolia-auth</code> (o llamando <code>registerApplication()</code> de{" "}
        <code>@kontrolia/db</code> directo, si prefiere scriptearlo). Ese paso genera y muestra{" "}
        <strong>una sola vez</strong> una clave de sincronización — solo se guarda su hash, no hay forma de
        recuperarla después. Esa clave es lo único que tu aplicación necesita para actualizar su propio catálogo
        de ahí en adelante.
      </p>
      <p>Guárdala como variable de entorno en tu aplicación, por ejemplo:</p>
      <pre>
        <code>KONTROLIA_APPLICATION_API_KEY=kapp_...</code>
      </pre>

      <h3>Alternativa: registrarla con un script</h3>
      <p>
        Si prefieres no pasar por el wizard interactivo (por ejemplo, para automatizar el alta como parte de tu
        propio setup), llama a <code>registerApplication()</code> directo — es exactamente la misma función que
        usa el instalador. Necesita conectarse a la base con el mismo <code>DATABASE_URL</code> que usaste para
        correr las migraciones:
      </p>
      <pre>
        <code>{`import { registerApplication } from "@kontrolia/db";

const { applicationId, permissionKeys, apiKey } = await registerApplication({
  connectionString: process.env.DATABASE_URL!,
  name: "Facturación",
  slug: "facturacion",
  environment: "production",
  permissions: [
    { resource: "facturas", action: "crear", description: "Crear facturas" },
    { resource: "facturas", action: "aprobar", description: "Aprobar facturas" },
  ],
});

console.log({ applicationId, permissionKeys, apiKey });
// apiKey solo viene la primera vez que se registra este slug — guárdala ahora,
// no hay forma de recuperarla después (solo se guarda su hash).`}</code>
      </pre>
      <p>
        Es seguro volver a correrlo con el mismo <code>slug</code>: los permisos se actualizan (upsert), y{" "}
        <code>apiKey</code> viene <code>null</code> en vez de una clave nueva — la clave existente nunca se
        rota por accidente. Si necesitas una clave nueva, no hay forma de "regenerarla" todavía; hay que borrar
        la aplicación y volver a registrarla.
      </p>

      <h2>Mantener el catálogo sincronizado</h2>
      <p>
        Cada vez que tu aplicación agrega, quita de uso, o cambia la descripción de un permiso, llama a este
        endpoint de auth-server — normalmente como un paso más de tu pipeline de despliegue (CI/CD), no algo que
        dispare una persona a mano:
      </p>
      <pre>
        <code>{`POST {tu-auth-server}/api/applications/sync
Authorization: Bearer kapp_...
Content-Type: application/json

{
  "slug": "facturacion",
  "permissions": [
    { "resource": "facturas", "action": "crear", "description": "Crear facturas" },
    { "resource": "facturas", "action": "aprobar", "description": "Aprobar facturas" }
  ]
}`}</code>
      </pre>
      <p>Respuesta (200):</p>
      <pre>
        <code>{`{
  "applicationId": "…",
  "permissionKeys": ["facturacion.facturas.crear", "facturacion.facturas.aprobar"]
}`}</code>
      </pre>

      <h3>Ejemplo en Node</h3>
      <pre>
        <code>{`await fetch(\`\${process.env.AUTH_SERVER_URL}/api/applications/sync\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.KONTROLIA_APPLICATION_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    slug: "facturacion",
    permissions: [
      { resource: "facturas", action: "crear", description: "Crear facturas" },
      { resource: "facturas", action: "aprobar", description: "Aprobar facturas" },
    ],
  }),
});`}</code>
      </pre>

      <h3>Ejemplo en curl (para probarlo a mano o desde un step de CI)</h3>
      <pre>
        <code>{`curl -X POST "$AUTH_SERVER_URL/api/applications/sync" \\
  -H "Authorization: Bearer $KONTROLIA_APPLICATION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "facturacion",
    "permissions": [
      { "resource": "facturas", "action": "crear", "description": "Crear facturas" }
    ]
  }'`}</code>
      </pre>

      <h2>Qué hace y qué no hace este endpoint</h2>
      <ul>
        <li>
          <strong>Agrega y actualiza, nunca borra.</strong> Un permiso que dejaste fuera del payload de esta vez
          no se elimina — evita que un despliegue que se le olvidó incluir un permiso rompa en silencio un rol
          que ya lo tenía otorgado. Si de verdad necesitas quitar un permiso, hazlo aparte y a propósito
          (directo contra la base, por ahora).
        </li>
        <li>
          Cada permiso queda como <code>{`{slug}.{resource}.{action}`}</code>. Repetir el mismo{" "}
          <code>resource</code>/<code>action</code> actualiza su <code>description</code>, no crea uno duplicado.
        </li>
        <li>
          Opcionalmente puedes mandar <code>name</code> y/o <code>environment</code> en el mismo body para
          actualizar esos campos de la aplicación.
        </li>
        <li>
          <strong>No</strong> habilita tu aplicación en ninguna organización ni la asigna a ningún rol — eso
          sigue siendo una decisión de cada organización, hecha por sus administradores. Este endpoint solo
          mantiene el catálogo de qué permisos <em>existen</em>.
        </li>
      </ul>

      <h2>Errores</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Causa</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>401</td>
            <td>
              Falta el header <code>Authorization</code>, o la clave no coincide.
            </td>
          </tr>
          <tr>
            <td>403</td>
            <td>
              La aplicación existe pero no tiene una clave de sincronización (registrada antes de que esta
              función existiera). Vuelve a registrarla desde el instalador para generar una.
            </td>
          </tr>
          <tr>
            <td>404</td>
            <td>
              No existe ninguna aplicación con ese <code>slug</code> — regístrala primero (ver arriba).
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        Ver también <a href="/docs/guides/organizations-and-permissions">Organizaciones y permisos</a> para cómo
        una organización habilita tu aplicación y asigna sus permisos a un rol una vez que el catálogo existe.
      </p>
    </article>
  );
}
