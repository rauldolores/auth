export const metadata = { title: "Login social — KontrolIA Auth" };

export default function SocialLoginPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Login social (Google y otros)</h1>
      <p>
        Las credenciales OAuth de cada proveedor son configuración <strong>por instalación</strong>, nunca algo
        que vive en el código de KontrolIA Auth. Cada empresa que instale el producto crea su propio proyecto
        en el proveedor (Google Cloud, Azure AD, etc.), registra su propia redirect URI, y mete su
        client_id/secret en su propio Supabase.
      </p>

      <h2>Configurar Google</h2>
      <h3>Supabase CLI (desarrollo local)</h3>
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
      <h3>Docker self-hosted</h3>
      <p>
        En <code>docker/.env</code>:
      </p>
      <pre>
        <code>{`GOOGLE_LOGIN_ENABLED=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...`}</code>
      </pre>
      <h3>Supabase Cloud</h3>
      <p>Dashboard → Authentication → Providers → Google.</p>

      <h3>Paso obligatorio en Google Cloud Console</h3>
      <p>
        En las credenciales de tu OAuth client, agrega a &quot;Authorized redirect URIs&quot; la URL exacta de
        tu instalación: <code>{"<SUPABASE_URL>"}/auth/v1/callback</code>. Sin esto Google rechaza el callback
        con <code>redirect_uri_mismatch</code>. Es un paso manual — no hay API pública de Google para
        automatizarlo.
      </p>

      <h2>Configurar Microsoft (Azure AD)</h2>
      <h3>Supabase CLI (desarrollo local)</h3>
      <pre>
        <code>{`[auth.external.azure]
enabled = true
client_id = "env(AZURE_CLIENT_ID)"
secret = "env(AZURE_CLIENT_SECRET)"
url = "env(AZURE_URL)"  # opcional — fija el tenant, ej. https://login.microsoftonline.com/<tenant-id>/v2.0. Omítelo para multi-tenant.
redirect_uri = ""`}</code>
      </pre>
      <h3>Docker self-hosted</h3>
      <pre>
        <code>{`MICROSOFT_LOGIN_ENABLED=true
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_URL=...   # opcional, mismo tenant que arriba`}</code>
      </pre>
      <h3>Supabase Cloud</h3>
      <p>Dashboard → Authentication → Providers → Azure.</p>
      <h3>Paso obligatorio en Azure Portal</h3>
      <p>
        En el registro de tu aplicación (Azure Active Directory → App registrations), agrega a &quot;Redirect
        URIs&quot; (tipo Web) la misma URL que para Google: <code>{"<SUPABASE_URL>"}/auth/v1/callback</code>.
      </p>

      <h2>Activar el botón en la UI</h2>
      <p>
        Los botones &quot;Continuar con Google&quot;/&quot;Continuar con Microsoft&quot; en{" "}
        <code>LoginForm</code>/<code>RegisterForm</code> solo aparecen si la app lo pide explícitamente — para
        que instalaciones sin el proveedor configurado no muestren un botón roto:
      </p>
      <pre>
        <code>{`<LoginForm
  showGoogle={process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true"}
  showMicrosoft={process.env.NEXT_PUBLIC_MICROSOFT_LOGIN_ENABLED === "true"}
/>`}</code>
      </pre>

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
