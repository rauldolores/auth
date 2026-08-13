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
        cuenta ya tiene.
      </p>

      <h2>Endpoint</h2>
      <pre>
        <code>{`POST {tu-auth-server}/api/mcp`}</code>
      </pre>
      <p>Implementa el transporte Streamable HTTP del protocolo MCP (una sola conexión, sin sesión persistente en el servidor).</p>

      <h2>Autenticación: es tu login, no una llave nueva</h2>
      <p>
        El agente se conecta usando el mismo login OAuth 2.1 + PKCE que ya usan las demás aplicaciones — no hay
        una credencial "todopoderosa" separada. Cada llamada corre con los permisos reales de la persona que
        inició sesión: si tu cuenta no puede eliminar una organización desde el admin-panel, tampoco puede
        hacerlo a través del agente.
      </p>
      <p>
        Para que un cliente MCP descubra cómo autenticarse, este servidor publica la metadata estándar en:
      </p>
      <pre>
        <code>{`GET {tu-auth-server}/.well-known/oauth-protected-resource`}</code>
      </pre>

      <h3>Registrar el cliente (paso manual, por ahora)</h3>
      <p>
        El servidor de autenticación (GoTrue) todavía no soporta registro dinámico de clientes OAuth, así que un
        agente que espera registrarse solo la primera vez que se conecta puede no lograrlo automáticamente. La
        forma de habilitarlo hoy: un platform admin registra manualmente un cliente OAuth para ese agente desde{" "}
        <strong>Aplicaciones → (tu app) → Cliente OAuth</strong> en el admin-panel — el mismo mecanismo que ya
        usa cualquier aplicación para el login SSO — y le da el <code>client_id</code> resultante a quien
        configure el agente. Si tu cliente MCP sí soporta apuntar a un <code>client_id</code> fijo en vez de
        registrarse dinámicamente, no necesitas nada especial más allá de eso.
      </p>
      <p>
        La configuración exacta (URL del servidor + client_id) depende de cada cliente MCP — revisa la
        documentación de Claude Code, Claude.ai Connectors o ChatGPT para el formato que usan para un servidor
        MCP remoto con OAuth.
      </p>

      <h2>Herramientas disponibles</h2>
      <p>
        <strong>Lectura</strong> (sin efectos secundarios): <code>get_current_user</code>,{" "}
        <code>list_organizations</code>, <code>list_organization_members</code>, <code>list_applications</code>,{" "}
        <code>list_organization_applications</code>, <code>list_permissions</code>, <code>list_roles</code>,{" "}
        <code>get_role_permissions</code>, <code>list_invitations</code>, <code>list_platform_admins</code>,{" "}
        <code>query_audit_log</code>.
      </p>
      <p>
        <strong>Escritura, sin confirmación</strong> (igual que el admin-panel, que tampoco pide confirmar estas):{" "}
        <code>create_organization</code>, <code>rename_organization</code>, <code>invite_user</code>,{" "}
        <code>resend_invitation</code>, <code>change_member_status</code>, <code>grant_membership_role</code>,{" "}
        <code>revoke_membership_role</code>, <code>create_custom_role</code>, <code>grant_role_permission</code>,{" "}
        <code>enable_application</code>, <code>configure_oauth_client</code>,{" "}
        <code>link_existing_oauth_client</code>.
      </p>
      <p>
        <strong>Escritura, con confirmación obligatoria</strong> — cada una exige un argumento{" "}
        <code>confirm*</code> que debe coincidir exactamente con el identificador actual del recurso (nombre,
        slug o correo); si no coincide, no se ejecuta nada:{" "}
        <code>delete_organization</code>, <code>remove_user</code>, <code>suspend_user</code>,{" "}
        <code>revoke_invitation</code>, <code>delete_custom_role</code>, <code>revoke_role_permission</code>,{" "}
        <code>disable_application</code>, <code>claim_application_ownership</code>,{" "}
        <code>rotate_application_sync_key</code>, <code>revoke_application_sync_key</code>,{" "}
        <code>grant_platform_admin</code>, <code>revoke_platform_admin</code>.
      </p>
      <p>
        Por ejemplo, para eliminar una organización el agente tiene que volver a consultar cuál es su{" "}
        <code>slug</code> actual y pasarlo de vuelta como <code>confirmSlug</code> — el equivalente, en una
        llamada de herramienta, al diálogo de confirmación que verías en el admin-panel antes de un clic
        destructivo.
      </p>

      <h2>Límites y observabilidad</h2>
      <p>
        Cada llamada de escritura pasa por un límite de solicitudes por usuario (no por IP, ya que un conector
        alojado como Claude.ai o ChatGPT puede mandar el tráfico de muchos usuarios distintos desde pocas IPs) y
        queda registrada en los logs del servidor con la herramienta, el usuario, y si tuvo éxito o no.
      </p>
    </article>
  );
}
