export const metadata = { title: "Conectar tu aplicación — KontrolIA Auth" };

export default function ConnectYourAppPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Conectar tu aplicación</h1>
      <p>
        Esta guía es para cuando tienes una aplicación (tuya, o de un tercero — otro SaaS de tu ecosistema) que
        necesita que sus usuarios inicien sesión a través de auth-server, y esa aplicación vive en un dominio
        distinto al de auth-server. Si tu app ya está en el mismo repo que admin-panel/auth-server, no necesitas
        nada de esto — el SDK ya maneja la sesión compartida automáticamente.
      </p>
      <p>
        <strong>Esto no es lo mismo que "Registro de aplicaciones".</strong> Esa otra guía (
        <a href="/docs/guides/application-registration">Registro de aplicaciones</a>) es sobre el catálogo de{" "}
        <em>permisos</em> de tu app (<code>facturacion.facturas.crear</code>) — no tiene nada que ver con cómo
        tus usuarios inician sesión. Puedes necesitar una, la otra, o ambas — son registros independientes con
        nombres parecidos que se confunden fácil.
      </p>

      <h2>¿Necesito el flujo OAuth 2.1, o me alcanza con una cookie compartida?</h2>
      <ul>
        <li>
          <strong>Tu app vive en un subdominio del mismo dominio</strong> que auth-server (ej.{" "}
          <code>auth.tuempresa.com</code> y <code>facturacion.tuempresa.com</code>): te alcanza con configurar{" "}
          <code>cookieDomain: ".tuempresa.com"</code> en <code>@kontrolia/auth</code>. No sigas leyendo esta
          guía — ver <a href="/docs/architecture">Arquitectura</a>, sección "Sesión compartida".
        </li>
        <li>
          <strong>Tu app vive en un dominio genuinamente distinto</strong> (ej.{" "}
          <code>login.kontrolia.com</code> y <code>facturacion.otraempresa.com</code>): una cookie no puede
          cruzar esa frontera bajo ninguna configuración — es el modelo de seguridad del navegador. Necesitas el
          flujo OAuth 2.1 de esta guía.
        </li>
      </ul>

      <h2>Paso 1 — Registra tu app como cliente OAuth</h2>
      <p>
        Quien administra KontrolIA Auth registra tu app <strong>una vez</strong>. Dos formas de hacerlo:
      </p>
      <h3>Opción A — desde admin-panel (recomendada)</h3>
      <p>
        Un <a href="/docs/architecture">platform admin</a> entra a admin-panel → "Clientes OAuth" (solo visible
        para platform admins) → nombre de la app + redirect URIs → Registrar. Nadie fuera de auth-server toca
        nunca la <code>service_role</code> key — la pantalla la usa server-side y solo devuelve el{" "}
        <code>client_id</code> resultante.
      </p>
      <h3>Opción B — a mano contra la API de GoTrue</h3>
      <p>
        Útil si prefieres scriptearlo o automatizarlo. Requiere la <code>service_role</code> key — un secreto
        administrativo de KontrolIA Auth, no algo que tu aplicación deba guardar ni conocer después de este
        paso:
      </p>
      <pre>
        <code>{`curl -X POST "$SUPABASE_URL/auth/v1/admin/oauth/clients" \\
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_name": "Facturación",
    "redirect_uris": ["https://facturacion.tuempresa.com/oauth/callback"],
    "client_type": "public",
    "token_endpoint_auth_method": "none"
  }'`}</code>
      </pre>
      <ul>
        <li>
          <code>client_name</code> — el nombre de tu app (aparece en la pantalla de "Autorizar acceso" si no es
          de primera parte, ver más abajo).
        </li>
        <li>
          <code>redirect_uris</code> — la URL exacta donde tu app recibirá el código de autorización. Puedes
          poner varias (una por entorno: dev, staging, producción).
        </li>
        <li>
          <code>client_type: "public"</code> + <code>token_endpoint_auth_method: "none"</code> — correcto para
          cualquier app que corre en el navegador (usa PKCE, nunca necesita un client_secret). Este es el mismo
          tipo de cliente que usa admin-panel para su propio SSO.
        </li>
      </ul>
      <p>
        Cualquiera de las dos opciones te da un <code>client_id</code> — ese sí es tuyo, guárdalo como variable
        de entorno de tu app (por ejemplo <code>NEXT_PUBLIC_OAUTH_CLIENT_ID</code>). No es secreto — un cliente
        público como este no tiene ningún valor que deba mantenerse privado.
      </p>

      <h2>Paso 2 — Redirige cuando no haya sesión</h2>
      <pre>
        <code>{`import { useAuth } from "@kontrolia/react";

const { isAuthenticated, isLoading, buildOAuthServerAuthorizeUrl } = useAuth();

useEffect(() => {
  if (isLoading || isAuthenticated) return;

  void (async () => {
    const { url, codeVerifier } = await buildOAuthServerAuthorizeUrl({
      clientId: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID!,
      redirectUri: \`\${window.location.origin}/oauth/callback\`,
      state: window.location.pathname, // a dónde regresar después de firmar
    });
    sessionStorage.setItem("kontrolia_oauth_code_verifier", codeVerifier);
    window.location.href = url; // navegación real del navegador, no un router.push
  })();
}, [isLoading, isAuthenticated]);`}</code>
      </pre>
      <p>
        Esto manda al usuario a auth-server. Si no tiene sesión ahí tampoco, ve la pantalla de login normal
        (email/password, Google, Microsoft, MFA si aplica) — auth-server sigue siendo el único lugar donde se
        piden credenciales, tu app nunca las toca.
      </p>

      <h2>Paso 3 — Recibe el código en tu propio callback</h2>
      <p>
        Crea una ruta en tu app que coincida exactamente con el <code>redirect_uri</code> que registraste (
        <code>/oauth/callback</code> en el ejemplo):
      </p>
      <pre>
        <code>{`import { useAuth } from "@kontrolia/react";
import { useSearchParams } from "next/navigation";

const { exchangeOAuthServerCode } = useAuth();
const searchParams = useSearchParams();

useEffect(() => {
  const code = searchParams.get("code");
  const codeVerifier = sessionStorage.getItem("kontrolia_oauth_code_verifier");
  if (!code || !codeVerifier) return;

  void (async () => {
    await exchangeOAuthServerCode({
      clientId: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID!,
      redirectUri: \`\${window.location.origin}/oauth/callback\`,
      code,
      codeVerifier,
    });
    sessionStorage.removeItem("kontrolia_oauth_code_verifier");
    router.push(searchParams.get("state") || "/"); // a donde estaba antes de irse a auth-server
  })();
}, []);`}</code>
      </pre>
      <p>
        <code>exchangeOAuthServerCode()</code> cambia el código por tu propia sesión (misma llamada que hace
        cualquier login normal por debajo) y la deja lista en <code>useAuth()</code> — de ahí en adelante tu app
        funciona exactamente igual que si el usuario hubiera iniciado sesión directo contigo.
      </p>

      <h2>¿Aprobación automática o pantalla de "Autorizar"?</h2>
      <p>
        Si tu app es de <strong>primera parte</strong> — un producto propio, del mismo operador que instaló
        KontrolIA Auth — auth-server aprueba la autorización automáticamente, sin que el usuario vea ni haga
        clic en nada extra (así funciona admin-panel). Si es una app de un <strong>tercero</strong> real, el
        usuario ve una pantalla "{`{client_name}`} quiere acceder a tu cuenta — Autorizar/Denegar" antes de
        continuar. Cuál de las dos aplica depende de si el <code>redirect_uri</code> coincide con la URL
        configurada como app de confianza (<code>NEXT_PUBLIC_ADMIN_PANEL_URL</code> hoy — generalizar esta
        lista a más de una app de confianza es un paso pendiente, ver{" "}
        <a href="/docs/architecture">Arquitectura</a>).
      </p>

      <h2>El token que recibes es un token completo de KontrolIA Auth</h2>
      <p>
        Trae los mismos claims que un login normal (<code>organization_id</code>, <code>roles</code>,{" "}
        <code>permissions</code>, perfil — ver <a href="/docs/architecture">Arquitectura</a>). Tu backend lo
        valida exactamente igual que cualquier otro: <code>requirePermission()</code>/<code>verifyRequest()</code>{" "}
        de <code>@kontrolia/auth/server</code>, sin lógica especial por venir de este flujo en vez de un login
        directo.
      </p>
    </article>
  );
}
