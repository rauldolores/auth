export const metadata = { title: "API de administración — KontrolIA Auth" };

export default function AdminApiPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">API de administración</h1>
      <p>
        Todo lo que puedes hacer desde el admin-panel — organizaciones, aplicaciones, usuarios, roles, permisos,
        invitaciones, audit log — también existe como API REST. Es la misma lógica exacta, no una copia: cada
        endpoint corre el mismo código y las mismas políticas de acceso (RLS) que ya protegen al admin-panel, así
        que un script o una integración externa no puede hacer nada que tu propia cuenta no pueda hacer ya desde
        el navegador.
      </p>
      <p>
        <strong>¿Buscas conectar un agente de IA (Claude, ChatGPT) en vez de escribir un script?</strong> Esta
        API también es la base del servidor MCP — ver <a href="/docs/mcp">MCP: conecta un agente de IA</a>.
      </p>

      <h2>Dos formas de autenticarte</h2>
      <table>
        <thead>
          <tr>
            <th>Credencial</th>
            <th>Alcance</th>
            <th>Para qué sirve</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              API Key de aplicación (<code>kapp_...</code>)
            </td>
            <td>
              Una sola aplicación. Cada clave individual está atada a una organización — la que la generó, no
              necesariamente la propietaria de la aplicación — y una misma app puede tener varias claves activas
              a la vez, una por cada organización que la usa
            </td>
            <td>
              El backend de tu app sincroniza su catálogo de permisos (con cualquier clave activa) o gestiona los
              miembros de la organización específica dueña de la clave usada — ver{" "}
              <a href="/docs/guides/application-registration">Registro de aplicaciones</a>. Se genera/revoca desde
              el admin-panel: Aplicaciones → tu app → API Keys.
            </td>
          </tr>
          <tr>
            <td>Tu propia sesión (token de KontrolIA Auth)</td>
            <td>Exactamente lo que tu cuenta puede ver/hacer en el admin-panel</td>
            <td>
              Automatizar cualquier operación administrativa — crear una organización, invitar gente, ajustar
              roles, consultar el audit log — como si lo hicieras tú mismo desde el navegador.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Ambas se mandan igual, como header <code>Authorization: Bearer &lt;token&gt;</code>. Los endpoints de
        esta guía usan la sesión propia salvo que se indique lo contrario.
      </p>

      <h2>Formato de errores</h2>
      <p>
        Todo error es <code>{`{ "error": "mensaje" }`}</code>, en el status HTTP correspondiente. Tres casos se
        repiten en casi todos los endpoints — no se documentan de nuevo en cada sección:
      </p>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Cuándo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>401</td>
            <td>
              Falta el header <code>Authorization</code>, o el token no es válido/expiró.{" "}
              <code>{`{ "error": "No autenticado" }`}</code>
            </td>
          </tr>
          <tr>
            <td>403</td>
            <td>
              El token es válido, pero RLS bloqueó la operación (no eres Owner/Admin de esa organización, o el
              recurso no existe desde tu punto de vista). Varios endpoints traducen esto a un mensaje explicando
              qué rol se necesita.
            </td>
          </tr>
          <tr>
            <td>500</td>
            <td>Error inesperado de base de datos — el mensaje viene tal cual de Postgres.</td>
          </tr>
        </tbody>
      </table>

      <h2>Organizaciones</h2>
      <p>
        <code>GET /organizations</code> lista solo las organizaciones donde tienes una membresía activa —{" "}
        <code>PATCH</code>/<code>DELETE</code> requieren Owner o Admin (RLS lo aplica, no la app).
      </p>
      <pre>
        <code>{`curl "$AUTH_SERVER_URL/api/organizations" \\
  -H "Authorization: Bearer $TOKEN"

# 200
{
  "organizations": [
    { "id": "3f2a...", "name": "Facturación SA", "slug": "facturacion-sa" }
  ]
}`}</code>
      </pre>
      <pre>
        <code>{`curl -X POST "$AUTH_SERVER_URL/api/organizations" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"name": "Facturación SA", "slug": "facturacion-sa"}'

# 201
{ "organization": { "id": "3f2a...", "name": "Facturación SA", "slug": "facturacion-sa" } }`}</code>
      </pre>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Body / query</th>
            <th>Éxito</th>
            <th>Errores propios</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>PATCH /organizations/:id</code>
            </td>
            <td>
              body <code>{`{ name }`}</code>
            </td>
            <td>
              200 <code>{`{ organization }`}</code>
            </td>
            <td>
              400 si falta <code>name</code>; 403 "No tienes permiso para editar esta organización (solo Owner y
              Admin pueden), o ya no existe."
            </td>
          </tr>
          <tr>
            <td>
              <code>DELETE /organizations/:id</code>
            </td>
            <td>—</td>
            <td>204</td>
            <td>403 "No tienes permiso para eliminar esta organización (solo el Owner puede), o ya no existe."</td>
          </tr>
        </tbody>
      </table>

      <h2>Miembros de una organización</h2>
      <pre>
        <code>{`curl "$AUTH_SERVER_URL/api/organization-members?organizationId=3f2a..." \\
  -H "Authorization: Bearer $TOKEN"

# 200
{
  "members": [
    {
      "membershipId": "8b1c...", "userId": "u-1", "email": "ana@empresa.com", "name": "Ana Pérez",
      "status": "active", "createdAt": "2026-01-10T12:00:00Z",
      "roles": [{ "id": "r-1", "name": "Owner", "slug": "owner", "application_id": null, "application": null }]
    }
  ],
  "hasMore": false,
  "total": 1
}`}</code>
      </pre>
      <p>
        <code>name</code> viene de <code>user_metadata.full_name</code> (capturado al registrarse) —{" "}
        <code>null</code> si nunca se proporcionó. <code>total</code> siempre está presente: el total de
        miembros de la organización (o de los que coinciden con <code>search</code>, si lo mandas),
        independiente de la paginación.
      </p>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Query / body</th>
            <th>Éxito</th>
            <th>Errores propios</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>GET /organization-members</code>
            </td>
            <td>
              <code>?organizationId=</code> (requerido), <code>&amp;membershipId=</code> (opcional, una sola
              fila), <code>&amp;offset=</code>
            </td>
            <td>
              200 <code>{`{ members, hasMore, total }`}</code> — 100 por página
            </td>
            <td>400 si falta organizationId</td>
          </tr>
          <tr>
            <td>
              <code>GET /organization-members?organizationId=&amp;search=</code>
            </td>
            <td>
              <code>&amp;search=</code> — coincidencia sin distinguir mayúsculas, contra email o nombre
            </td>
            <td>
              200 igual que arriba, pero <code>total</code>/<code>hasMore</code> reflejan solo lo que coincide
              con la búsqueda
            </td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <code>GET /organization-members?organizationId=&amp;count=true</code>
            </td>
            <td>—</td>
            <td>
              200 <code>{`{ members: [], hasMore: false, total }`}</code> — camino rápido, no resuelve emails ni
              nombres, solo cuenta
            </td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <code>PATCH /organization-members?membershipId=</code>
            </td>
            <td>
              body <code>{`{ status: "active" | "suspended" }`}</code>
            </td>
            <td>204</td>
            <td>
              400 "No puedes suspender al único Owner de la organización." — mismo bloqueo que la UI, aplicado
              aquí como último respaldo
            </td>
          </tr>
          <tr>
            <td>
              <code>DELETE /organization-members?membershipId=</code>
            </td>
            <td>—</td>
            <td>204</td>
            <td>400 "No puedes quitar al único Owner de la organización."</td>
          </tr>
          <tr>
            <td>
              <code>POST /organization-members/roles</code>
            </td>
            <td>
              body <code>{`{ membershipId, roleId }`}</code>
            </td>
            <td>201, sin cuerpo</td>
            <td>400 con el mensaje de Postgres si la persona ya tiene un rol en esa misma aplicación</td>
          </tr>
          <tr>
            <td>
              <code>DELETE /organization-members/roles?membershipId=&amp;roleId=</code>
            </td>
            <td>—</td>
            <td>204</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>

      <h2>Aplicaciones y sus API Keys</h2>
      <p>
        <code>GET /applications</code> es el catálogo completo (toda la instalación, no solo tu organización).
        Habilitar/deshabilitar una app para tu organización específica es{" "}
        <code>POST</code>/<code>DELETE /organizations/:id/applications</code> — ver{" "}
        <a href="/docs/guides/organizations-and-permissions">Organizaciones y permisos</a>.
      </p>
      <p>
        Cada aplicación puede tener varias API Keys activas, cada una atada a una organización — ver{" "}
        <a href="/docs/guides/application-registration">Registro de aplicaciones</a> para el detalle completo del
        modelo. Generar una:
      </p>
      <pre>
        <code>{`curl -X POST "$AUTH_SERVER_URL/api/applications/$APP_ID/keys" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"organizationId": "3f2a...", "name": "Integración Zapier", "expiresAt": null}'

# 201 — "apiKey" solo viene esta vez, nunca se puede volver a mostrar
{
  "id": "k-1", "name": "Integración Zapier", "organizationId": "3f2a...",
  "keyPrefix": "kapp_a1b2c3", "expiresAt": null, "createdAt": "2026-01-10T12:00:00Z",
  "apiKey": "kapp_a1b2c3d4e5f6..."
}`}</code>
      </pre>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Query / body</th>
            <th>Éxito</th>
            <th>Errores propios</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>GET /applications?offset=</code>
            </td>
            <td>—</td>
            <td>
              200 <code>{`{ applications, hasMore }`}</code> — 100 por página
            </td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <code>PATCH /applications/:id</code>
            </td>
            <td>
              body <code>{`{ homepageUrl? , oauthClientId? }`}</code> (al menos uno)
            </td>
            <td>
              200 <code>{`{ application }`}</code>
            </td>
            <td>400 si no mandas ninguno de los dos campos</td>
          </tr>
          <tr>
            <td>
              <code>GET /applications/:id/keys</code>
            </td>
            <td>—</td>
            <td>
              200 <code>{`{ keys: [...] }`}</code> — nunca incluye el secreto, solo <code>keyPrefix</code>
            </td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <code>POST /applications/:id/keys</code>
            </td>
            <td>
              body <code>{`{ organizationId, name, expiresAt? }`}</code>
            </td>
            <td>
              201, ver ejemplo arriba
            </td>
            <td>
              400 <code>expiresAt</code> inválido; 403 "No tienes permiso para crear una clave para esa
              organización — confirma que la administras y que tiene esta aplicación habilitada." (esa org no
              administra, o no tiene la app habilitada)
            </td>
          </tr>
          <tr>
            <td>
              <code>DELETE /applications/:id/keys/:keyId</code>
            </td>
            <td>—</td>
            <td>204</td>
            <td>404 "Clave no encontrada, ya revocada, o no tienes permiso sobre su organización."</td>
          </tr>
        </tbody>
      </table>

      <h2>Roles y permisos</h2>
      <pre>
        <code>{`curl -X POST "$AUTH_SERVER_URL/api/roles" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"organizationId": "3f2a...", "applicationId": "app-1", "name": "Contador"}'

# 201 — el slug se calcula en el servidor a partir de "name", nunca lo mandes tú
{ "role": { "id": "r-9", "name": "Contador", "slug": "contador", "is_system_role": false, "grants_all_permissions": false, "organization_id": "3f2a...", "application_id": "app-1" } }`}</code>
      </pre>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Query / body</th>
            <th>Éxito</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>GET /roles?organizationId=</code>
            </td>
            <td>—</td>
            <td>
              200 <code>{`{ roles: [...] }`}</code> — roles de sistema + los de esa organización
            </td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <code>DELETE /roles/:id</code>
            </td>
            <td>—</td>
            <td>204</td>
            <td>
              RLS bloquea roles de sistema o de otra organización de forma silenciosa (no borra nada, no marca
              error) — confirma con un <code>GET</code> si de verdad se eliminó
            </td>
          </tr>
          <tr>
            <td>
              <code>GET /roles/:id/permissions</code>
            </td>
            <td>—</td>
            <td>
              200 <code>{`{ permissionIds: [...] }`}</code>
            </td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <code>POST /roles/:id/permissions</code>
            </td>
            <td>
              body <code>{`{ permissionId }`}</code>
            </td>
            <td>201, sin cuerpo</td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <code>DELETE /roles/:id/permissions?permissionId=</code>
            </td>
            <td>—</td>
            <td>204</td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <code>GET /permissions?applicationId=&amp;offset=</code>
            </td>
            <td>ambos opcionales</td>
            <td>
              200 <code>{`{ permissions, hasMore }`}</code> — 200 por página
            </td>
            <td>Solo lectura — los permisos los declara cada app vía su propio sync, nunca a mano</td>
          </tr>
        </tbody>
      </table>

      <h2>Invitaciones</h2>
      <pre>
        <code>{`curl -X POST "$AUTH_SERVER_URL/api/invitations" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"organizationId": "3f2a...", "email": "nuevo@empresa.com", "roleId": "r-9"}'

# 201 — no envía correo: el token es tuyo para armar el link como prefieras
{ "invitation": { "id": "i-1", "email": "nuevo@empresa.com", "token": "9f8e...", "expires_at": "2026-01-17T12:00:00Z" } }`}</code>
      </pre>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Query / body</th>
            <th>Éxito</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>GET /invitations?organizationId=&amp;offset=</code>
            </td>
            <td>—</td>
            <td>
              200 <code>{`{ invitations, hasMore }`}</code> — 50 por página
            </td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <code>PATCH /invitations/:id</code>
            </td>
            <td>sin body</td>
            <td>
              200 <code>{`{ invitation: { token, expires_at } }`}</code>
            </td>
            <td>"Reenviar" en realidad regenera el token y extiende 7 días desde ahora — el link viejo deja de servir</td>
          </tr>
          <tr>
            <td>
              <code>DELETE /invitations/:id</code>
            </td>
            <td>—</td>
            <td>204</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
      <p>
        Aceptar una invitación (<code>POST /invitations/accept</code>) no requiere sesión — la usa quien recibió
        el link, ver <a href="/docs/guides/invitations-and-sessions">Invitaciones y sesiones</a>.
      </p>

      <h2>Audit log</h2>
      <pre>
        <code>{`curl "$AUTH_SERVER_URL/api/audit-logs?organizationId=3f2a...&action=organization.member_removed&from=2026-01-01T00:00:00Z" \\
  -H "Authorization: Bearer $TOKEN"

# 200
{
  "logs": [
    {
      "id": "l-1", "actor_user_id": "u-1", "actorEmail": "ana@empresa.com",
      "action": "organization.member_removed", "target_type": "membership", "target_id": "m-2",
      "metadata": { "removed_email": "bob@empresa.com" }, "created_at": "2026-01-05T09:00:00Z"
    }
  ],
  "hasMore": false
}`}</code>
      </pre>
      <p>
        <code>GET /audit-logs</code> acepta <code>organizationId</code> (requerido), y opcionalmente{" "}
        <code>action</code> (coincidencia exacta, ej. <code>role.created</code>), <code>actorUserId</code>,{" "}
        <code>from</code>/<code>to</code> (ISO, filtran por <code>created_at</code>), y <code>offset</code> (50
        por página). Cada fila la escribe un trigger de base de datos, no la ruta — el log existe sin importar si
        el cambio vino del admin-panel, esta API, o MCP.
      </p>

      <h2>Platform admins</h2>
      <p>
        Requiere ser platform admin — no basta con Owner/Admin de una organización. Es el único grupo de
        endpoints gateado explícitamente en código (<code>claims.is_platform_admin</code>) en vez de dejarlo
        todo a RLS.
      </p>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Query / body</th>
            <th>Éxito</th>
            <th>Errores propios</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>GET /platform-admins?userId=</code>
            </td>
            <td>consulta puntual</td>
            <td>
              200 <code>{`{ isPlatformAdmin, grantedAt }`}</code>
            </td>
            <td>403 "Se requiere ser platform admin"</td>
          </tr>
          <tr>
            <td>
              <code>GET /platform-admins?offset=</code>
            </td>
            <td>listado</td>
            <td>
              200 <code>{`{ admins, hasMore }`}</code> — 50 por página
            </td>
            <td>403 "Se requiere ser platform admin"</td>
          </tr>
          <tr>
            <td>
              <code>POST /platform-admins</code>
            </td>
            <td>
              body <code>{`{ email }`}</code>
            </td>
            <td>
              201 <code>{`{ userId, email }`}</code>
            </td>
            <td>404 "No hay ningún usuario registrado con ese correo."</td>
          </tr>
          <tr>
            <td>
              <code>DELETE /platform-admins?userId=</code>
            </td>
            <td>—</td>
            <td>204</td>
            <td>
              400 "No puedes quitar al último platform admin — la instalación se quedaría sin ninguno."
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Clientes OAuth (SSO y MCP)</h2>
      <p>
        También platform-admin-gated. A diferencia de todo lo anterior, <code>GET</code>/<code>POST</code>/
        <code>PUT</code>/<code>DELETE</code> son un proxy delgado hacia la API de administración de GoTrue — el
        status y el cuerpo que ves son, casi siempre, los que GoTrue mismo devolvió, no algo que esta API invente.
        Además llevan límite de solicitudes: 30 cada 5 minutos por IP.
      </p>
      <pre>
        <code>{`curl -X POST "$AUTH_SERVER_URL/api/oauth-clients" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"client_name": "Facturación", "redirect_uris": ["https://facturacion.miempresa.com/oauth/callback"]}'

# 201 (lo que GoTrue haya devuelto)
{ "client_id": "c9f...", "client_name": "Facturación", "redirect_uris": [...] }`}</code>
      </pre>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Query / body</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>GET /oauth-clients</code>
            </td>
            <td>—</td>
            <td>Lista los clientes ya registrados en GoTrue</td>
          </tr>
          <tr>
            <td>
              <code>POST /oauth-clients</code>
            </td>
            <td>
              body <code>{`{ client_name, redirect_uris: string[] }`}</code>
            </td>
            <td>
              Siempre se crea como cliente público (<code>token_endpoint_auth_method: "none"</code>) — el mismo
              tipo que usa el resto del ecosistema
            </td>
          </tr>
          <tr>
            <td>
              <code>PUT /oauth-clients?clientId=</code>
            </td>
            <td>
              body <code>{`{ client_name, redirect_uris: string[] }`}</code>
            </td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <code>DELETE /oauth-clients?clientId=</code>
            </td>
            <td>—</td>
            <td>
              204. Antes de tocar GoTrue, esta API (no GoTrue) rechaza el borrado con 403 si es el cliente
              reservado para MCP, o con 409 si sigue vinculado a una aplicación (<code>oauth_client_id</code>{" "}
              en <code>applications</code>) — desvincúlala primero con{" "}
              <code>PATCH /applications/:id {`{ oauthClientId: null }`}</code>
            </td>
          </tr>
          <tr>
            <td>
              <code>POST /oauth-clients/mcp-bootstrap</code>
            </td>
            <td>—</td>
            <td>
              Idempotente: crea el cliente reservado <em>"MCP — Agentes de IA"</em> solo la primera vez (pre-cargado
              con el <code>redirect_uri</code> fijo de Claude.ai/Desktop) y guarda su <code>client_id</code> en{" "}
              <code>instance_settings.mcp_oauth_client_id</code>; cualquier llamada posterior solo devuelve ese
              mismo <code>clientId</code> sin crear nada de nuevo. Ver <a href="/docs/mcp">MCP</a>.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Errores propios: 429 <code>{`{ "error": "Demasiadas solicitudes. Intenta de nuevo más tarde." }`}</code>{" "}
        (con header <code>Retry-After</code>) si excedes el límite; 502{" "}
        <code>{`{ "error": "No se pudo contactar a Supabase: ..." }`}</code> si GoTrue no responde en 10 segundos
        o hay un problema de red. Cualquier otro error viene tal cual de GoTrue, con su propio status.
      </p>

      <h2>Login social (Google/Microsoft)</h2>
      <p>
        También platform-admin-gated, límite de 30 cada 5 minutos por IP. Ver la{" "}
        <a href="/docs/guides/social-login">guía de login social</a> para el contexto completo.
      </p>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Query / body</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>GET /social-login</code>
            </td>
            <td>—</td>
            <td>
              Estado real de Google/Azure (leído en vivo de GoTrue) más lo que hay configurado vía la Management
              API de Supabase, si está disponible (<code>managementApiAvailable</code>)
            </td>
          </tr>
          <tr>
            <td>
              <code>PATCH /social-login?provider=google|azure</code>
            </td>
            <td>
              body <code>{`{ enabled, clientId?, secret?, tenantUrl? }`}</code>
            </td>
            <td>
              <code>clientId</code>/<code>secret</code> requeridos solo la primera vez que se activa un proveedor;
              omitirlos en una actualización posterior los deja como estaban. 400 si ninguna de las dos
              autenticaciones hacia la Management API está configurada (ver abajo)
            </td>
          </tr>
          <tr>
            <td>
              <code>GET /supabase-connection</code>
            </td>
            <td>—</td>
            <td>
              <code>{`{ oauthConfigured, connected, connectedAt, clientId }`}</code> — estado de la conexión OAuth
              de esta instalación con la Management API de Supabase
            </td>
          </tr>
          <tr>
            <td>
              <code>DELETE /supabase-connection</code>
            </td>
            <td>—</td>
            <td>204. Borra los tokens guardados; no afecta nada ya activado en GoTrue</td>
          </tr>
          <tr>
            <td>
              <code>POST /supabase-connection/callback</code>
            </td>
            <td>
              body <code>{`{ code, codeVerifier, redirectUri }`}</code>
            </td>
            <td>
              El paso de intercambio de código de la conexión OAuth — llamado por admin-panel después de que
              Supabase redirige de vuelta con un <code>code</code>, nunca directo desde un navegador
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Cómo conseguir tu token</h2>
      <p>
        Si estás automatizando algo como tú mismo (no como una aplicación cliente), usa el token de sesión que ya
        tienes al iniciar sesión — el mismo SDK (<code>@kontrolia/auth</code>) que usa el admin-panel expone{" "}
        <code>getToken()</code> para obtenerlo. Para un script fuera del navegador, la forma más simple hoy es
        copiar el <code>access_token</code> desde las herramientas de desarrollo del navegador mientras tienes
        sesión iniciada en el admin-panel — no hay todavía una pantalla dedicada para generar un token de larga
        duración fuera de una sesión de navegador.
      </p>
    </article>
  );
}
