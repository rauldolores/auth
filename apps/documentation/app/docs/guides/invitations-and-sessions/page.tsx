export const metadata = { title: "Invitaciones y sesiones — KontrolIA Auth" };

export default function InvitationsAndSessionsPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Invitaciones y sesiones</h1>

      <h2>Invitar a alguien</h2>
      <p>
        Desde <code>admin-panel</code> → Invitaciones: correo + rol. El insert va directo contra{" "}
        <code>kontrolia.invitations</code> desde el navegador — la policy RLS{" "}
        <code>&quot;org admins manage invitations&quot;</code> es lo único que decide si el insert pasa, no
        código de aplicación.
      </p>

      <h2>Aceptar una invitación</h2>
      <p>
        El flujo vive en <code>auth-server</code>'s <code>/invitations/accept?token=...</code>:
      </p>
      <ol>
        <li>
          <code>GET /api/invitations/accept?token=</code> — preview (organización, rol, correo esperado), vía
          service role porque quien visita el link todavía no está autenticado.
        </li>
        <li>Si no hay sesión, la página muestra login/registro embebidos, prellenados con el correo esperado.</li>
        <li>
          En cuanto hay sesión, <code>POST /api/invitations/accept</code> valida que el correo coincida con la
          invitación, crea el membership + rol, y marca la invitación como aceptada — todo automático, sin que
          el usuario tenga que hacer nada más.
        </li>
      </ol>
      <p>
        El envío real del correo (SMTP) es responsabilidad de tu instalación — la invitación queda creada con
        un token; conectar un proveedor de correo es una integración aparte.
      </p>

      <h2>Dispositivos y sesiones</h2>
      <p>
        Cada sesión de Supabase queda registrada como un dispositivo (<code>kontrolia.devices</code>), a partir
        del claim <code>session_id</code> del JWT — no hay nada que instalar aparte, <code>auth-server</code>{" "}
        llama a <code>POST /api/devices/touch</code> una vez por sesión.
      </p>
      <pre>
        <code>{`GET  /api/devices          // lista tus propios dispositivos
POST /api/devices/revoke   // cierra una sesión específica`}</code>
      </pre>
      <p>
        Revocar usa <code>kontrolia.revoke_session()</code> — verifica que la sesión te pertenezca antes de
        borrarla de <code>auth.sessions</code>. El access token de esa sesión sigue siendo técnicamente válido
        hasta que expira (igual que la revocación de permisos), pero ya no se puede refrescar.
      </p>

      <h2>Audit log</h2>
      <p>
        <code>admin-panel</code> → Audit log muestra la actividad de la organización activa: organizaciones
        creadas, miembros agregados/eliminados, invitaciones enviadas/aceptadas, roles asignados, sesiones
        revocadas. Se llena solo — son triggers de Postgres, no llamadas que el código de la aplicación tenga
        que recordar hacer.
      </p>
    </article>
  );
}
