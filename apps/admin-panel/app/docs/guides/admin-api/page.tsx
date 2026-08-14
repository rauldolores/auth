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
        Ambas se mandan igual, como header <code>Authorization: Bearer &lt;token&gt;</code>.
      </p>

      <h2>Endpoints principales</h2>
      <p>
        Todos viven bajo <code>{"{tu-auth-server}/api"}</code>. Los que devuelven listas soportan paginación con{" "}
        <code>?offset=</code>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Recurso</th>
            <th>Rutas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Organizaciones</td>
            <td>
              <code>GET/POST /organizations</code>, <code>PATCH/DELETE /organizations/:id</code>
            </td>
          </tr>
          <tr>
            <td>Miembros de una organización</td>
            <td>
              <code>GET/PATCH/DELETE /organization-members</code>,{" "}
              <code>POST/DELETE /organization-members/roles</code>
            </td>
          </tr>
          <tr>
            <td>Aplicaciones</td>
            <td>
              <code>GET /applications</code>, <code>PATCH /applications/:id</code>,{" "}
              <code>GET/POST /applications/:id/keys</code>, <code>DELETE /applications/:id/keys/:keyId</code>,{" "}
              <code>POST/DELETE /organizations/:id/applications</code>
            </td>
          </tr>
          <tr>
            <td>Roles y permisos</td>
            <td>
              <code>GET/POST /roles</code>, <code>DELETE /roles/:id</code>,{" "}
              <code>GET/POST/DELETE /roles/:id/permissions</code>, <code>GET /permissions</code>
            </td>
          </tr>
          <tr>
            <td>Invitaciones</td>
            <td>
              <code>GET/POST /invitations</code>, <code>PATCH/DELETE /invitations/:id</code>
            </td>
          </tr>
          <tr>
            <td>Audit log</td>
            <td>
              <code>GET /audit-logs</code> — filtros: <code>action</code>, <code>actorUserId</code>,{" "}
              <code>from</code>, <code>to</code>
            </td>
          </tr>
          <tr>
            <td>Platform admins</td>
            <td>
              <code>GET/POST/DELETE /platform-admins</code> (requiere ser platform admin)
            </td>
          </tr>
          <tr>
            <td>Cliente OAuth de una app (SSO)</td>
            <td>
              <code>GET/POST/PUT /oauth-clients</code> (requiere ser platform admin)
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Ejemplo</h2>
      <pre>
        <code>{`curl "$AUTH_SERVER_URL/api/organizations" \\
  -H "Authorization: Bearer $TU_TOKEN"`}</code>
      </pre>

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
