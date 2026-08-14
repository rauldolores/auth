export const metadata = { title: "MCP: conecta un agente de IA — KontrolIA Auth" };

export default function McpPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">MCP: conecta un agente de IA</h1>
      <p>
        KontrolIA Auth expone un servidor <a href="https://modelcontextprotocol.io">MCP</a> (Model Context
        Protocol) para que Claude, ChatGPT, o cualquier otro agente compatible pueda consultar y administrar tu
        instalación conversacionalmente — organizaciones, aplicaciones, usuarios, roles, permisos, invitaciones
        y el audit log. No es una capa nueva: cada herramienta MCP llama exactamente a la misma{" "}
        <a href="/docs/guides/admin-api">API de administración</a> que ya existe, con los mismos permisos que tu
        cuenta ya tiene — si tu cuenta no puede eliminar una organización desde el admin-panel, tampoco puede
        hacerlo a través del agente.
      </p>

      <h2>Endpoint</h2>
      <pre>
        <code>{`POST {tu-auth-server}/api/mcp`}</code>
      </pre>
      <p>Implementa el transporte Streamable HTTP del protocolo MCP (una sola conexión, sin sesión persistente en el servidor — cada request se atiende de forma independiente).</p>

      <h2>Autenticación: es tu login, no una llave nueva</h2>
      <p>
        El agente se conecta usando el mismo login OAuth 2.1 + PKCE que ya usan las demás aplicaciones — no hay
        una credencial "todopoderosa" separada. Cada llamada corre con los permisos reales de la persona que
        inició sesión.
      </p>
      <p>Para que un cliente MCP descubra cómo autenticarse, este servidor publica la metadata estándar en:</p>
      <pre>
        <code>{`GET {tu-auth-server}/.well-known/oauth-protected-resource`}</code>
      </pre>
      <p>
        que a su vez apunta al servidor de autorización real de GoTrue, ya publicado en{" "}
        <code>{`{SUPABASE_URL}/auth/v1/.well-known/oauth-authorization-server`}</code> (RFC 8414).
      </p>

      <h3>Registrar el cliente (paso manual, por ahora)</h3>
      <p>
        GoTrue todavía no soporta registro dinámico de clientes OAuth (<code>POST /auth/v1/oauth/register</code>{" "}
        responde 404), así que un agente que espera registrarse solo la primera vez que se conecta no lo va a
        lograr automáticamente. La forma de habilitarlo hoy: un platform admin registra manualmente un cliente
        OAuth para ese agente desde <strong>Aplicaciones → (tu app) → Cliente OAuth</strong> en el admin-panel —
        el mismo mecanismo que ya usa cualquier aplicación para el login SSO — y le da el <code>client_id</code>{" "}
        resultante a quien configure el agente.
      </p>
      <p>
        Si tu cliente MCP soporta apuntar a un <code>client_id</code> fijo en vez de registrarse dinámicamente
        (como Claude Code), no necesitas nada más allá de eso. Ejemplo con Claude Code CLI:
      </p>
      <pre>
        <code>{`claude mcp add --transport http \\
  --client-id TU_CLIENT_ID \\
  --callback-port 8765 \\
  kontrolia-auth https://tu-auth-server/api/mcp

claude mcp login kontrolia-auth   # abre el navegador para el login OAuth real`}</code>
      </pre>
      <p>
        El <code>redirect_uri</code> que registres en el cliente OAuth debe coincidir exacto con el que usa tu
        cliente MCP — en el ejemplo de arriba, <code>http://localhost:8765/callback</code>.
      </p>

      <h2>Cómo se ve una llamada</h2>
      <p>
        Cada herramienta recibe argumentos con nombre (definidos por su propio esquema) y devuelve texto — casi
        siempre el mismo JSON que devolvería el endpoint REST equivalente. Dos ejemplos reales, uno de lectura y
        uno de escritura sin confirmación:
      </p>
      <pre>
        <code>{`list_organization_members({ organizationId: "3f2a..." })

→ {"members":[{"membershipId":"8b1c...","userId":"u-1","email":"ana@empresa.com",
   "status":"active","createdAt":"2026-01-10T12:00:00Z",
   "roles":[{"id":"r-1","name":"Owner","slug":"owner","application_id":null}]}],
   "hasMore":false}`}</code>
      </pre>
      <pre>
        <code>{`invite_user({ organizationId: "3f2a...", email: "nuevo@empresa.com", roleId: "r-9" })

→ {"invitation":{"id":"i-1","email":"nuevo@empresa.com","token":"9f8e...","expires_at":"2026-01-17T12:00:00Z"}}`}</code>
      </pre>
      <p>
        Un error se ve igual que el de la API REST — <code>{`{"error": "mensaje"}`}</code> — marcado además como
        error a nivel de protocolo MCP, para que el agente sepa distinguir un resultado válido de uno fallido sin
        tener que parsear el texto.
      </p>

      <h2>El contrato de confirmación en herramientas destructivas</h2>
      <p>
        Una llamada de herramienta no tiene un diálogo que mostrar antes de ejecutarse — así que cada acción
        irreversible o de alto riesgo exige un argumento <code>confirm*</code> que debe coincidir exactamente con
        el identificador <em>actual</em> del recurso (nombre, slug, correo o email según el caso). La herramienta
        vuelve a consultar ese identificador antes de ejecutar nada; si no coincide, no se ejecuta nada:
      </p>
      <pre>
        <code>{`delete_organization({ organizationId: "3f2a...", confirmSlug: "factuacion-sa" })
→ {"error":"Confirmación inválida: el slug actual es \\"facturacion-sa\\", recibiste \\"factuacion-sa\\". No se eliminó nada."}

delete_organization({ organizationId: "3f2a...", confirmSlug: "facturacion-sa" })
→ 204 (sin cuerpo) — ahora sí se eliminó`}</code>
      </pre>
      <p>
        Esto obliga al agente a haber consultado el estado real del recurso (por ejemplo con{" "}
        <code>list_organizations</code>) antes de poder borrarlo — el equivalente, en una llamada de herramienta,
        al <code>ConfirmDialog</code> que verías en el admin-panel antes de un clic destructivo.
      </p>

      <h2>Herramientas de lectura</h2>
      <p>Sin efectos secundarios — seguras de llamar en cualquier momento.</p>
      <table>
        <thead>
          <tr>
            <th>Herramienta</th>
            <th>Argumentos</th>
            <th>Qué devuelve</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>get_current_user</code></td><td>—</td>
            <td>Perfil, roles y permisos del usuario autenticado en su organización activa</td>
          </tr>
          <tr>
            <td><code>list_organizations</code></td><td>—</td>
            <td>Organizaciones a las que pertenece el usuario</td>
          </tr>
          <tr>
            <td><code>list_organization_members</code></td><td><code>organizationId</code></td>
            <td>Miembros de una organización, con sus roles</td>
          </tr>
          <tr>
            <td><code>list_applications</code></td><td>—</td>
            <td>Catálogo completo de aplicaciones registradas</td>
          </tr>
          <tr>
            <td><code>list_organization_applications</code></td><td><code>organizationId</code></td>
            <td>Aplicaciones que esa organización puede lanzar/asignar</td>
          </tr>
          <tr>
            <td><code>list_permissions</code></td><td><code>applicationId?</code></td>
            <td>Catálogo de permisos, opcionalmente filtrado por aplicación</td>
          </tr>
          <tr>
            <td><code>list_roles</code></td><td><code>organizationId</code></td>
            <td>Roles de sistema + roles personalizados de esa organización</td>
          </tr>
          <tr>
            <td><code>get_role_permissions</code></td><td><code>roleId</code></td>
            <td>Ids de permisos otorgados a un rol</td>
          </tr>
          <tr>
            <td><code>list_invitations</code></td><td><code>organizationId</code></td>
            <td>Invitaciones pendientes y pasadas</td>
          </tr>
          <tr>
            <td><code>list_platform_admins</code></td><td>—</td>
            <td>Usuarios con acceso de plataforma (requiere ser platform admin)</td>
          </tr>
          <tr>
            <td><code>list_application_keys</code></td><td><code>applicationId</code></td>
            <td>Todas las claves (activas y revocadas) de una aplicación — nunca el secreto en sí</td>
          </tr>
          <tr>
            <td><code>query_audit_log</code></td>
            <td><code>organizationId</code>, <code>action?</code>, <code>actorUserId?</code>, <code>from?</code>, <code>to?</code>, <code>offset?</code></td>
            <td>Bitácora paginada y filtrable</td>
          </tr>
        </tbody>
      </table>

      <h2>Escritura sin confirmación</h2>
      <p>Igual que el admin-panel, que tampoco pide confirmar estas acciones.</p>
      <table>
        <thead>
          <tr>
            <th>Herramienta</th>
            <th>Argumentos</th>
            <th>Qué hace</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>create_organization</code></td><td><code>name</code>, <code>slug</code></td>
            <td>Crea una organización; el llamante queda como Owner</td>
          </tr>
          <tr>
            <td><code>rename_organization</code></td><td><code>organizationId</code>, <code>name</code></td>
            <td>Requiere Owner o Admin</td>
          </tr>
          <tr>
            <td><code>invite_user</code></td><td><code>organizationId</code>, <code>email</code>, <code>roleId?</code></td>
            <td>Crea una invitación y devuelve su token/link</td>
          </tr>
          <tr>
            <td><code>resend_invitation</code></td><td><code>invitationId</code></td>
            <td>Regenera token y expiración</td>
          </tr>
          <tr>
            <td><code>change_member_status</code></td><td><code>membershipId</code>, <code>status: "active"</code></td>
            <td>Reactivar un miembro suspendido — suspender usa <code>suspend_user</code>, que sí confirma</td>
          </tr>
          <tr>
            <td><code>grant_membership_role</code></td><td><code>membershipId</code>, <code>roleId</code></td>
            <td>Falla si ya tiene un rol para esa misma aplicación</td>
          </tr>
          <tr>
            <td><code>revoke_membership_role</code></td><td><code>membershipId</code>, <code>roleId</code></td>
            <td>Fácilmente reversible (se puede volver a otorgar) — por eso no pide confirmación</td>
          </tr>
          <tr>
            <td><code>create_custom_role</code></td><td><code>organizationId</code>, <code>applicationId</code>, <code>name</code></td>
            <td>El slug se calcula en el servidor</td>
          </tr>
          <tr>
            <td><code>grant_role_permission</code></td><td><code>roleId</code>, <code>permissionId</code></td>
            <td>Falla en roles de sistema o "grants_all_permissions" — esos se sincronizan solos</td>
          </tr>
          <tr>
            <td><code>enable_application</code></td><td><code>organizationId</code>, <code>applicationId</code></td>
            <td>Habilita una aplicación para lanzarse/asignarse en esa organización</td>
          </tr>
          <tr>
            <td><code>configure_oauth_client</code></td><td><code>applicationId</code>, <code>name</code>, <code>redirectUris</code></td>
            <td>Registra un cliente OAuth nuevo para esa aplicación (login SSO, no MCP)</td>
          </tr>
          <tr>
            <td><code>link_existing_oauth_client</code></td><td><code>applicationId</code>, <code>oauthClientId</code></td>
            <td>Apunta la aplicación a un cliente OAuth ya existente, en vez de crear uno duplicado</td>
          </tr>
          <tr>
            <td><code>create_application_key</code></td><td><code>applicationId</code>, <code>organizationId</code>, <code>name</code>, <code>expiresAt?</code></td>
            <td>Genera una nueva API Key; el texto plano solo se devuelve esta vez</td>
          </tr>
        </tbody>
      </table>

      <h2>Escritura con confirmación obligatoria</h2>
      <p>
        Cada una exige el argumento <code>confirm*</code> descrito arriba. Todas requieren rol Owner/Admin (o
        platform admin, según el caso) además de la confirmación — la confirmación no reemplaza el permiso, solo
        se suma a él.
      </p>
      <table>
        <thead>
          <tr>
            <th>Herramienta</th>
            <th>Argumentos</th>
            <th>Qué hace</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>delete_organization</code></td>
            <td><code>organizationId</code>, <code>confirmSlug</code></td>
            <td>Irreversible — elimina en cascada membresías, roles, invitaciones y su historial de auditoría</td>
          </tr>
          <tr>
            <td><code>remove_user</code></td>
            <td><code>organizationId</code>, <code>membershipId</code>, <code>confirmEmail</code></td>
            <td>Bloqueado por la base de datos si dejaría a la organización sin ningún Owner activo</td>
          </tr>
          <tr>
            <td><code>suspend_user</code></td>
            <td><code>organizationId</code>, <code>membershipId</code>, <code>confirmEmail</code></td>
            <td>Reactivar de vuelta usa <code>change_member_status</code>, que no confirma</td>
          </tr>
          <tr>
            <td><code>revoke_invitation</code></td>
            <td><code>invitationId</code>, <code>confirmEmail</code></td>
            <td>El link deja de funcionar de inmediato</td>
          </tr>
          <tr>
            <td><code>delete_custom_role</code></td>
            <td><code>organizationId</code>, <code>roleId</code>, <code>confirmSlug</code></td>
            <td>Solo roles personalizados — RLS bloquea silenciosamente los de sistema</td>
          </tr>
          <tr>
            <td><code>revoke_role_permission</code></td>
            <td><code>roleId</code>, <code>permissionId</code>, <code>confirmKey</code></td>
            <td>Quita un permiso ya otorgado a un rol — confirma con la clave del permiso, ej. <code>facturacion.facturas.eliminar</code></td>
          </tr>
          <tr>
            <td><code>disable_application</code></td>
            <td><code>organizationId</code>, <code>applicationId</code>, <code>confirmSlug</code></td>
            <td>Quien haya iniciado sesión con esa app deja de poder acceder</td>
          </tr>
          <tr>
            <td><code>claim_application_ownership</code></td>
            <td><code>applicationId</code>, <code>organizationId</code>, <code>confirmSlug</code></td>
            <td>Solo platform admin — no se puede deshacer ni transferir después</td>
          </tr>
          <tr>
            <td><code>revoke_application_key</code></td>
            <td><code>applicationId</code>, <code>keyId</code>, <code>confirmName</code></td>
            <td>Detiene esa clave de inmediato; las demás claves de la app siguen funcionando</td>
          </tr>
          <tr>
            <td><code>grant_platform_admin</code></td>
            <td><code>email</code>, <code>confirmEmail</code></td>
            <td>
              Acceso de solo lectura/escritura cruzado a <strong>toda</strong> la instalación — la acción de
              mayor riesgo que expone este servidor. Confirma aunque el admin-panel mismo no lo pida, una
              decisión deliberada de este servidor
            </td>
          </tr>
          <tr>
            <td><code>revoke_platform_admin</code></td>
            <td><code>userId</code>, <code>confirmEmail</code></td>
            <td>Bloqueado si dejaría la instalación sin ningún platform admin</td>
          </tr>
        </tbody>
      </table>

      <h2>Límites y observabilidad</h2>
      <p>
        Cada llamada de escritura pasa por un límite de solicitudes por usuario (no por IP, ya que un conector
        alojado como Claude.ai o ChatGPT puede mandar el tráfico de muchos usuarios distintos desde pocas IPs) y
        queda registrada en los logs del servidor con la herramienta, el usuario, y si tuvo éxito o no. Si excedes
        el límite, la herramienta devuelve un error de texto pidiendo reintentar más tarde — no hay reintento
        automático.
      </p>
    </article>
  );
}
