export const metadata = { title: "Login social — KontrolIA Auth" };

export default function SocialLoginPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Login social (Google y Microsoft)</h1>
      <p>
        La forma más simple de activar esto: <strong>Configuración → Inicio de sesión social</strong> en el
        admin-panel. Ahí un platform admin activa cada proveedor con un switch, captura el Client ID/Secret, y
        el botón aparece en el login de inmediato — sin tocar ningún dashboard ni redesplegar nada. Esta página
        documenta qué hace esa pantalla por dentro y las alternativas manuales para cuando no está disponible.
      </p>

      <h2>Qué necesitas de todos modos: el registro en el proveedor</h2>
      <p>
        Ni esta pantalla ni ninguna API puede automatizar esta parte — es un paso que solo tú puedes hacer, una
        vez por proveedor, en la consola de Google o Microsoft:
      </p>
      <ol>
        <li>
          Crea un OAuth client en{" "}
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
            Google Cloud Console
          </a>{" "}
          o registra una aplicación en{" "}
          <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noreferrer">
            Azure Portal
          </a>
          .
        </li>
        <li>
          Agrega a sus "Authorized redirect URIs" / "Redirect URIs" la URL exacta{" "}
          <code>{"<SUPABASE_URL>"}/auth/v1/callback</code> de tu instalación — la pantalla de Inicio de sesión
          social te la muestra ya armada, con botón de copiar. Sin este paso el proveedor rechaza el callback
          con <code>redirect_uri_mismatch</code>.
        </li>
        <li>Copia el Client ID y el Client Secret que te da esa consola — eso es lo que vas a capturar en KontrolIA Auth.</li>
      </ol>

      <h2>Camino 1: la pantalla de Inicio de sesión social (recomendado)</h2>
      <p>
        Con el Client ID/Secret ya en mano, ve a <strong>Configuración → Inicio de sesión social</strong>,
        actívalo y guarda. Por dentro, esa pantalla llama a la{" "}
        <a href="https://supabase.com/docs/reference/api/introduction" target="_blank" rel="noreferrer">
          Management API de Supabase
        </a>{" "}
        (<code>PATCH /v1/projects/{"{ref}"}/config/auth</code>) para escribir la configuración directamente en tu
        proyecto — el mismo efecto que editarlo a mano en el dashboard, pero desde la app. Para que esa llamada
        funcione, el servidor necesita autenticarse ante esa API primero — dos formas, en orden de preferencia:
      </p>

      <h3>Conexión OAuth (se renueva sola, recomendado)</h3>
      <p>
        La misma pantalla tiene una tarjeta "Conexión con Supabase" arriba de los proveedores, con un botón
        "Conectar con Supabase". Antes de usarlo, quien administra el servidor registra una vez una{" "}
        <em>OAuth App</em> de Supabase:
      </p>
      <ol>
        <li>
          Entra a{" "}
          <a href="https://supabase.com/dashboard/org/_/apps" target="_blank" rel="noreferrer">
            tu organización → Settings → OAuth Apps
          </a>{" "}
          y da de alta una aplicación (el nombre no importa).
        </li>
        <li>
          Como redirect URI, usa exactamente <code>{"<NEXT_PUBLIC_ADMIN_PANEL_URL>"}/oauth/supabase-callback</code>{" "}
          — la URL de tu admin-panel, sin barra final.
        </li>
        <li>
          Copia el <code>client_id</code>/<code>client_secret</code> que te da y ponlos como{" "}
          <code>SUPABASE_OAUTH_CLIENT_ID</code>/<code>SUPABASE_OAUTH_CLIENT_SECRET</code> en las variables de
          entorno de auth-server (ver <code>.env.example</code>).
        </li>
      </ol>
      <p>
        Desde ahí, cualquier platform admin le da clic a "Conectar con Supabase" una sola vez — inicia sesión en
        Supabase, autoriza el acceso, y listo. El acceso se renueva solo (access_token + refresh_token, OAuth 2.1
        estándar) para siempre, sin volver a pedir nada, hasta que alguien lo desconecte desde esta misma pantalla
        o revoque el acceso desde su cuenta de Supabase.
      </p>

      <h3>Personal Access Token (alternativa, expira)</h3>
      <p>
        Si prefieres no hacer el registro de la OAuth App, puedes usar en su lugar un token de acceso personal,
        generado una sola vez desde{" "}
        <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer">
          supabase.com/dashboard/account/tokens
        </a>{" "}
        y puesto como <code>SUPABASE_MANAGEMENT_API_TOKEN</code>. La diferencia importante: este token expira según
        lo que elijas al crearlo (o antes, si Supabase lo revoca), y nada en el sistema puede renovarlo solo —
        cuando expire, tendrás que generar uno nuevo y volver a pegarlo. Solo se usa cuando la conexión OAuth de
        arriba no está activa.
      </p>
      <p>
        A diferencia de las demás llaves que usa esta app, tanto el token como el par OAuth pueden administrar{" "}
        <strong>toda tu cuenta de Supabase</strong>, no solo este proyecto — trátalos con ese cuidado. Si ninguno
        está configurado (o la instalación es self-hosted, donde este mecanismo no existe), la pantalla sigue
        mostrando el estado real de cada proveedor, solo que en modo de solo lectura, con instrucciones para
        activarlo por el camino manual de abajo.
      </p>

      <h2>Camino 2: configuración manual (self-hosted, o sin el token)</h2>
      <h3>Google — Supabase CLI (desarrollo local)</h3>
      <p>
        Agrega en <code>supabase/config.toml</code> (usando variables de entorno, nunca el secret en texto
        plano dentro del archivo):
      </p>
      <pre>
        <code>{`[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"
redirect_uri = ""
skip_nonce_check = true  # requerido para login local con Google`}</code>
      </pre>
      <p>
        Reinicia con las variables en el entorno del comando: <code>supabase stop &amp;&amp; supabase start</code>.
      </p>
      <h3>Google — Docker self-hosted</h3>
      <p>
        En <code>docker/.env</code>:
      </p>
      <pre>
        <code>{`GOOGLE_LOGIN_ENABLED=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...`}</code>
      </pre>
      <h3>Google — Supabase Cloud sin el token de Management API</h3>
      <p>Dashboard → Authentication → Providers → Google.</p>

      <h3>Microsoft (Azure AD) — Supabase CLI (desarrollo local)</h3>
      <pre>
        <code>{`[auth.external.azure]
enabled = true
client_id = "env(AZURE_CLIENT_ID)"
secret = "env(AZURE_CLIENT_SECRET)"
url = "env(AZURE_URL)"  # opcional — fija el tenant, ej. https://login.microsoftonline.com/<tenant-id>/v2.0. Omítelo para multi-tenant.
redirect_uri = ""`}</code>
      </pre>
      <h3>Microsoft — Docker self-hosted</h3>
      <pre>
        <code>{`MICROSOFT_LOGIN_ENABLED=true
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_URL=...   # opcional, mismo tenant que arriba`}</code>
      </pre>
      <h3>Microsoft — Supabase Cloud sin el token de Management API</h3>
      <p>Dashboard → Authentication → Providers → Azure.</p>

      <h2>El botón en la UI: automático, no configuración</h2>
      <p>
        Los botones "Continuar con Google"/"Continuar con Microsoft" en <code>LoginForm</code>/
        <code>RegisterForm</code> ya no dependen de una variable de entorno que alguien tenga que recordar
        cambiar — auth-server consulta el endpoint público <code>{"{SUPABASE_URL}"}/auth/v1/settings</code> de
        GoTrue en cada carga de página, así que el botón refleja el estado real del proveedor siempre, sin
        importar por cuál de los dos caminos de arriba se haya activado.
      </p>

      <h2>Cómo funciona por dentro</h2>
      <p>
        <code>loginWithOAuth(&quot;google&quot;)</code> (o <code>&quot;azure&quot;</code> para Microsoft) llama a{" "}
        <code>signInWithOAuth()</code> de Supabase con{" "}
        <code>redirectTo</code> apuntando a <code>/auth/callback</code>. Esa ruta, del lado del servidor,
        intercambia el código PKCE por una sesión — necesario porque las sesiones viven en cookies (ver{" "}
        <a href="/docs/architecture">Arquitectura</a>), y ese intercambio no puede pasar solo en el cliente.
      </p>
    </article>
  );
}
